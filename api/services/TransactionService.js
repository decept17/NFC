// File: api/services/transactionservice.js
const db = require('../db'); // Import the connection above

async function processTransaction(nfcTokenId, amount, merchatId, merchantCategory){
    const client = await db.getClient(); // Get a dedicated client for the transaction

    try {
        // Start the Database Transaction 
        await client.query('BEGIN');

        // Fetch Account & Limits (locking the amount row to prevent race conditions)
       const accountRes = await client.query(`
      SELECT 
        a.account_id, a.balance, a.status, 
        l.daily_spending_limit, l.single_transaction_max, l.blocked_categories
      FROM accounts a
      LEFT JOIN limits l ON a.account_id = l.child_account_id
      WHERE a.nfc_token_id = £1
      FOR UPDATE OF a
    `, [nfcTokenId]);

    if (accountRes.rows.length === 0){
        throw new Error ('NFC Token not recongized');
    }

    const account = accountRes.rows[0];
    let failureReason = null;

    //Logic checks 

    // Is account active?
    if (account.status !== 'Active'){
        failureReason = `Account is ${account.status}`;
    }

    // checking for sufficient funds
    else if (parseFloat(account.balance) < amount) {
        failureReason = 'Insufficient funds';
    }

    // transaction limit check 
    else if (account.single_transaction_max > 0 && amount > parseFloat(account.single_transaction_max)){
        failureReason = 'Exceeds single transaction limit';
    }

    // checking blocked categories should be passed from POS 
    else if (account.blocked_categories && account.blocked_categories.includes(merchantCategory)){
        failureReason = `Merchant category '${merchantCategory}' is blocked`;
    }

    //daily spending limit 
    else if (account.daily_spendning_limit > 0){
        const historyRes = await client.query(`
            SELECT COALESCE(SUM(amount), o) as today_total
            FROM transactions
            WHERE account_id = £1
            AND type = 'Payment'
            AND status = 'Success'
            AND created_at >= CURRENT_DATE
        `,[account.account_id]);

        const todayTotal = parseFloat(historyRes.rows[0].today_total);

        if ((todayTotal + amount) > parseFloat(account.daily_spendning_limit)){
            failureReason = 'Exceeds daily spending limit';
        }
    }

    // execute decision
    if (failureReason){
        // record the failed attempt for the parent to see
        await client.query(`
        INSERT INTO transactions (account_id, amount, type, status, merchant_id, merchant_name)
        VALUES (£1, £2, 'Payment', 'Failed', £3, £4)
      `, [account.account_id, amount, merchantId, failureReason]); // Storing reason in merchant_name or metadata is clever for MVP)
    
        await client.query('COMMIT');
        return { success: false, message: failureReason };

    }else {
        // process SUCCESS
        await client.query(`
            UPDATE accounts 
            SET balance = balance - £1 
            WHERE account_id = £2
            `, [amount, account.account_id]);
        
        await client.query(`
            INSERT INTO transactions (account_id, amount, type, status, merchant_id)
            VALUES (£1, £2, 'Payment', 'Success', £3)
            `, [account.account_id, amount, merchantId]);

        await client.query('COMMIT');
        return { success: true, newBalance: account.balance - amount };

    }

    } catch (e){
        // emergency rollback if code crashes undo everything
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
}

module.exports = { processTransaction };