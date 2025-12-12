// Will recieve the web request from the POS terminal and call the service
const express = require('express');
const router = express.Router();
const transactionservice = require('../services/TransactionService');
const { error } = require('console');

router.post('/pay', async(req, res) => {
    const {nfcTokenId, amount, merchantId, category} = req.body;

    try{
        const result = await transactionservice.processTransaction(nfcTokenId,amount, merchantId, category);

        if (result.success){
            res.join({status: 'approved', balance: result.newBalance});
        } else {
            res.status(403).json({status: 'declined', reason: result.message});
        }
    } catch (err){
        console.error(err);
        res.status(500).json({error: 'System Error'});
    }
});

module.exports = router;