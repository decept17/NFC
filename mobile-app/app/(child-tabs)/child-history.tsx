// mobile-app/app/(child-tabs)/child-history.tsx
import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
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
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const accountRes = await fetchApi('/child/my-account');
      if (!accountRes.ok) return;
      const accountData = await accountRes.json();

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
        <View style={styles.txIcon}>
          <Ionicons
            name={isTopUp ? 'arrow-down-outline' : 'arrow-up-outline'}
            size={16}
            color={isTopUp ? Colors.successGreen : Colors.dangerRed}
          />
        </View>
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
        <Text style={[styles.transactionAmount, { color: isTopUp ? Colors.successGreen : Colors.dangerRed }]}>
          {isTopUp ? '+' : '-'}£{Math.abs(item.amount).toFixed(2)}
        </Text>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={Colors.electricBlue} style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>Transaction History</Text>
      </View>

      {transactions.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="receipt-outline" size={52} color={Colors.textMuted} />
          <Text style={styles.emptyText}>No transactions yet</Text>
        </View>
      ) : (
        <FlatList
          data={transactions}
          renderItem={renderTransaction}
          keyExtractor={(_, index) => index.toString()}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.deepNavy,
  },
  titleRow: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.glassDivider,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
    color: Colors.textWhite,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 120,
  },
  transactionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.glassCard,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    padding: 16,
    borderRadius: 18,
    marginBottom: 10,
    gap: 12,
  },
  txIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(77,143,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  transactionLeft: {
    flex: 1,
  },
  transactionDesc: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textWhite,
    marginBottom: 3,
  },
  transactionDate: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
