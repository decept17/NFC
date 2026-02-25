import React, { useState } from 'react';
import { View, Text, StyleSheet, SectionList, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colours';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

// --- 1. MOCK DATA (Mirrors your TransactionResponse from main.py) ---
// We use dynamic dates so "Today" always works when you test it.
const today = new Date();
const lastWeek = new Date();
lastWeek.setDate(today.getDate() - 7);

const MOCK_TRANSACTIONS = [
  { id: '1', description: 'School Lunch', amount: 5.99, timestamp: today.toISOString(), category: 'Food' },
  { id: '2', description: 'Stationery', amount: 2.99, timestamp: today.toISOString(), category: 'Supplies' },
  { id: '3', description: 'Bus Fare', amount: 5.96, timestamp: lastWeek.toISOString(), category: 'Transport' },
  { id: '4', description: 'School Trip', amount: 9.99, timestamp: lastWeek.toISOString(), category: 'Activities' },
  { id: '5', description: 'Vending Machine', amount: 5.00, timestamp: lastWeek.toISOString(), category: 'Food' },
];

export default function HistoryScreen() {
  const router = useRouter();

  // --- 2. HELPER FUNCTION: Group data by date ---
  const groupTransactions = (transactions: typeof MOCK_TRANSACTIONS) => {
    // In a real app, you'd use a date library like date-fns or moment.js
    // For now, we manually group them into "Today" and "Last Week"
    const todayItems = transactions.filter(t => new Date(t.timestamp).toDateString() === today.toDateString());
    const olderItems = transactions.filter(t => new Date(t.timestamp).toDateString() !== today.toDateString());

    return [
      { title: 'Today', data: todayItems },
      { title: 'This Week', data: olderItems },
    ];
  };

  const sections = groupTransactions(MOCK_TRANSACTIONS);

  // --- 3. RENDER COMPONENTS ---

  const renderItem = ({ item }: { item: typeof MOCK_TRANSACTIONS[0] }) => (
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
          <Ionicons name="arrow-back" size={32} color={Colors.buttonDark} />
        </TouchableOpacity>
        
        <Text style={styles.headerLogo}>N3XO</Text>
        
        <TouchableOpacity>
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
        // "View All" button at the bottom
        // ListFooterComponent={() => (
        //   <TouchableOpacity style={styles.viewAllButton}>
        //     <Text style={styles.viewAllText}>View Entire History</Text>
        //   </TouchableOpacity>
        // )}
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
    backgroundColor: Colors.backgroundPeach, // Using the salmon/peach color from your mockup
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
});