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

  // get child
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

  // --- 2. HELPER FUNCTION: Group data by date ---
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

  // --- 3. RENDER COMPONENTS ---

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.transactionRow}>
      <Text style={styles.itemDescription} numberOfLines={1}>
        {item.description}
      </Text>

      {/* Dashed Line spacer */}
      <View style={styles.dashedLineContainer}>
        <View style={styles.dashedLine} />
      </View>

      <Text style={styles.itemAmount}>
        £{item.amount.toFixed(2)}
      </Text>
    </View>
  );

  const renderSectionHeader = ({ section: { title } }: any) => (
    <Text style={styles.sectionHeader}>{title}</Text>
  );

  return (
    <SafeAreaView style={styles.safeArea}>

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.push('/(tabs)/home')}>
          <Ionicons name="person-outline" size={32} color={Colors.buttonDark} />
        </TouchableOpacity>

        {/* 5. SHOW WHOSE HISTORY THIS IS */}
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.headerLogo}>N3XO</Text>
          <Text style={styles.subHeader}>{selectedAccount?.name}'s History</Text>
        </View>

        <TouchableOpacity onPress={() => router.push('/settings')}>
          <Ionicons name="ellipsis-vertical" size={28} color={Colors.buttonDark} />
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
        ListEmptyComponent={<Text style={styles.emptyText}>No recent transactions.</Text>}
      />
      <View style={styles.bottomButtonContainer}>
        <TouchableOpacity style={styles.viewAllButton}>
          <Text style={styles.viewAllText}>View Entire History</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// --- 4. STYLES ---
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.backgroundPeach,
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
    fontSize: 34,
    fontWeight: 'bold',
    color: Colors.textOrange,
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: { width: 5, height: 5 },
    textShadowRadius: 2,
  },

  // List Styles
  listContent: {
    paddingHorizontal: 30,
    paddingTop: 20,
    paddingBottom: 120, // CRITICAL: Keeps the "View All" button above your floating tab bar!
  },
  sectionHeader: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 20,
    marginBottom: 15,
  },
  // Transaction Row Styles
  transactionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  itemDescription: {
    fontSize: 15,
    color: '#222',
    maxWidth: '40%', // Prevents long names from pushing the price off screen
  },
  dashedLineContainer: {
    flex: 1,
    height: 1,
    marginHorizontal: 10,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  dashedLine: {
    width: '100%',
    height: 1,
    borderWidth: 1,
    borderColor: '#555',
    borderStyle: 'dashed',
    opacity: 0.5,
  },
  itemAmount: {
    fontSize: 15,
    color: '#222',
    fontWeight: '500',
  },

  // View All Button
  viewAllButton: {
    marginTop: 'auto',
    alignItems: 'center',
    paddingVertical: 15,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.3)', // Subtle translucent background
  },
  viewAllText: {
    color: '#222',
    fontSize: 16,
    fontWeight: '600',
  },
  bottomButtonContainer: {
    paddingHorizontal: 30,
    paddingTop: 10,
    paddingBottom: 120, // CRITICAL: This 110px padding pushes the button up so your custom floating tab bar doesn't cover it
    backgroundColor: Colors.backgroundPeach, // Solid background so scrolling list items hide cleanly behind it
  },
  subHeader: {
    fontSize: 12,
    color: '#838383',
    fontWeight: '600',
    marginTop: 2,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 40,
    fontSize: 16,
    color: '#555',
  },
});