// mobile-app/app/(tabs)/history.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SectionList, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colours';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFamily } from '@/context/FamilyContext';
import { fetchApi } from '@/services/api';

export default function HistoryScreen() {
  const router = useRouter();
  const { selectedAccount } = useFamily();
  const [historyItems, setHistoryItems] = useState<any[]>([]);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!selectedAccount?.id) return;
      try {
        const response = await fetchApi(`/accounts/${selectedAccount.id}/history`);
        if (response.ok) {
          const data = await response.json();
          setHistoryItems(data);
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchHistory();
  }, [selectedAccount?.id]);

  const groupTransactions = (transactions: any[]) => {
    const today = new Date();
    const todayItems = transactions.filter(t => new Date(t.timestamp).toDateString() === today.toDateString());
    const olderItems = transactions.filter(t => new Date(t.timestamp).toDateString() !== today.toDateString());
    return [
      { title: 'Today', data: todayItems },
      { title: 'Older', data: olderItems },
    ].filter(section => section.data.length > 0);
  };

  const sections = groupTransactions(historyItems);

  const renderItem = ({ item }: { item: any }) => {
    const isCredit = item.type === 'TopUp';
    return (
      <View style={styles.transactionRow}>
        {/* Icon */}
        <View style={styles.txIcon}>
          <Ionicons
            name={isCredit ? 'arrow-down-outline' : 'arrow-up-outline'}
            size={16}
            color={isCredit ? Colors.successGreen : Colors.dangerRed}
          />
        </View>

        <View style={styles.txDetails}>
          <Text style={styles.itemDescription} numberOfLines={1}>
            {item.description}
          </Text>
          <Text style={styles.itemTimestamp}>
            {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>

        <Text style={[
          styles.itemAmount,
          { color: isCredit ? Colors.successGreen : Colors.dangerRed }
        ]}>
          {isCredit ? '+' : '-'}£{Math.abs(item.amount).toFixed(2)}
        </Text>
      </View>
    );
  };

  const renderSectionHeader = ({ section: { title } }: any) => (
    <View style={styles.sectionHeaderRow}>
      <Text style={styles.sectionHeader}>{title}</Text>
      <View style={styles.sectionLine} />
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.push('/(tabs)/home')}>
          <Ionicons name="person-outline" size={28} color={Colors.electricBlue} />
        </TouchableOpacity>

        <View style={{ alignItems: 'center' }}>
          <Text style={styles.headerLogo}>N3XO</Text>
          <Text style={styles.subHeader}>{selectedAccount?.name}'s History</Text>
        </View>

        <TouchableOpacity onPress={() => router.push('/settings')}>
          <Ionicons name="ellipsis-vertical" size={28} color={Colors.electricBlue} />
        </TouchableOpacity>
      </View>

      {/* TRANSACTION LIST */}
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="receipt-outline" size={52} color={Colors.textMuted} />
            <Text style={styles.emptyText}>No recent transactions.</Text>
          </View>
        }
      />

      <View style={styles.bottomButtonContainer}>
        <TouchableOpacity style={styles.viewAllButton} activeOpacity={0.8}>
          <Text style={styles.viewAllText}>View Entire History</Text>
          <Ionicons name="chevron-forward" size={16} color={Colors.electricBlue} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.deepNavy,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
  },
  headerLogo: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -1,
    color: Colors.textWhite,
    textShadowColor: Colors.electricBlue,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 14,
  },
  subHeader: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '600',
    marginTop: 2,
    letterSpacing: 0.3,
  },

  // List
  listContent: {
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 120,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 24,
    marginBottom: 14,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.electricBlue,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  sectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.glassDivider,
  },

  // Transaction Row
  transactionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.glassCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  txIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(77,143,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  txDetails: {
    flex: 1,
  },
  itemDescription: {
    fontSize: 15,
    color: Colors.textWhite,
    fontWeight: '500',
  },
  itemTimestamp: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  itemAmount: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // Empty state
  emptyContainer: {
    alignItems: 'center',
    marginTop: 60,
    gap: 12,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 16,
    color: Colors.textSecondary,
  },

  // View All button
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 16,
    borderRadius: 20,
    backgroundColor: Colors.glassCard,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  viewAllText: {
    color: Colors.textWhite,
    fontSize: 15,
    fontWeight: '600',
  },
  bottomButtonContainer: {
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 120,
    backgroundColor: Colors.deepNavy,
  },
});