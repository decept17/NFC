// mobile-app/app/(child-tabs)/child-history.tsx
import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/Colours';
import { fetchApi } from '@/services/api';
import { useFocusEffect } from 'expo-router';

interface Transaction {
  amount: number;
  description: string;
  timestamp: string;
  category: string | null;
  type: string;
}

export default function ChildHistoryScreen() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      // First get the child's account ID
      const accountRes = await fetchApi('/child/my-account');
      if (!accountRes.ok) return;
      const accountData = await accountRes.json();
      setAccountId(accountData.account_id);

      // Then fetch history for that account
      const historyRes = await fetchApi(`/accounts/${accountData.account_id}/history`);
      if (historyRes.ok) {
        const data = await historyRes.json();
        setTransactions(data);
      }
    } catch (e) {
      console.error('Failed to fetch history', e);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [])
  );

  const renderTransaction = ({ item }: { item: Transaction }) => {
    const isTopUp = item.type === 'TopUp';
    return (
      <View style={styles.transactionRow}>
        <View style={styles.transactionLeft}>
          <Text style={styles.transactionDesc}>
            {item.description || (isTopUp ? 'Top Up' : 'Payment')}
          </Text>
          <Text style={styles.transactionDate}>
            {new Date(item.timestamp).toLocaleDateString('en-GB', {
              day: 'numeric', month: 'short', year: 'numeric',
            })}
          </Text>
        </View>
        <Text
          style={[
            styles.transactionAmount,
            { color: isTopUp ? '#1a7f37' : '#c44' },
          ]}
        >
          {isTopUp ? '+' : '-'}£{Math.abs(item.amount).toFixed(2)}
        </Text>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={Colors.textWhite} style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Transaction History</Text>

      {transactions.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No transactions yet</Text>
        </View>
      ) : (
        <FlatList
          data={transactions}
          renderItem={renderTransaction}
          keyExtractor={(_, index) => index.toString()}
          contentContainerStyle={styles.listContent}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundBlue,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.textWhite,
    textAlign: 'center',
    paddingTop: 16,
    paddingBottom: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.6)',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  transactionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    padding: 16,
    borderRadius: 16,
    marginBottom: 10,
  },
  transactionLeft: {
    flex: 1,
  },
  transactionDesc: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textWhite,
    marginBottom: 4,
  },
  transactionDate: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
  },
  transactionAmount: {
    fontSize: 18,
    fontWeight: '700',
  },
});
