// mobile-app/app/(tabs)/home.tsx
import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions, FlatList, TouchableOpacity, } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colours';
import { SafeAreaView } from "react-native-safe-area-context";

const { width } = Dimensions.get('window');

// --- 1. MOCK DATA (Matches your API structure) ---
const INITIAL_ACCOUNTS = [
  { id: '1', name: 'Sarah', role: 'Child', balance: 20.00, status: 'Active' },
  { id: '2', name: 'James', role: 'Child', balance: 5.50, status: 'Frozen' },
];

export default function HomeScreen() {
  const [accounts, setAccounts] = useState(INITIAL_ACCOUNTS);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Get the current child being viewed
  const currentAccount = accounts[currentIndex];
  
  // Determine screen colors based on status
  const isFrozen = currentAccount.status === 'Frozen';
  const backgroundColor = isFrozen ? Colors.backgroundPeach : Colors.backgroundBlue;
  
  // Toggle Button styles (Opposite of background for contrast)
  const toggleBtnColor = isFrozen ? Colors.backgroundBlue : Colors.backgroundPeach;
  const toggleBtnText = isFrozen ? "Activate" : "Freeze";

  // --- 2. HANDLERS ---
  
  // Updates the index when the user swipes to a new card
  const handleScroll = (event: any) => {
    const slideSize = event.nativeEvent.layoutMeasurement.width;
    const index = event.nativeEvent.contentOffset.x / slideSize;
    const roundIndex = Math.round(index);
    if (roundIndex !== currentIndex) {
      setCurrentIndex(roundIndex);
    }
  };

  // Toggles the freeze/active state of the current account
  const handleToggleStatus = () => {
    const updatedAccounts = [...accounts];
    updatedAccounts[currentIndex].status = isFrozen ? 'Active' : 'Frozen';
    setAccounts(updatedAccounts);
    // TODO: Later, we will send an API request here to update the DB
  };

  // --- 3. RENDER COMPONENTS ---

  const renderChildCard = ({ item }: { item: typeof INITIAL_ACCOUNTS[0] }) => (
    <View style={styles.cardContainer}>
      <View style={styles.card}>
        <Text style={styles.cardSubtitle}>{item.name} · {item.role}</Text>
        <Text style={styles.cardBalance}>£ {item.balance.toFixed(2)}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor }]}>
      
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity>
          <Ionicons name="person-outline" size={28} color={Colors.buttonDark} />
        </TouchableOpacity>
        
        <Text style={styles.headerLogo}>N3XO</Text>
        
        <TouchableOpacity>
          <Ionicons name="ellipsis-vertical" size={28} color={Colors.buttonDark} />
        </TouchableOpacity>
      </View>

      {/* SWIPEABLE CARDS */}
      <View style={styles.carouselSection}>
        <FlatList
          data={accounts}
          renderItem={renderChildCard}
          keyExtractor={(item) => item.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleScroll}
          bounces={false}
        />
        
        {/* Pagination Dots */}
        <View style={styles.pagination}>
          {accounts.map((_, index) => (
            <View 
              key={index} 
              style={[
                styles.dot, 
                { backgroundColor: index === currentIndex ? Colors.textWhite : 'rgba(255,255,255,0.4)' }
              ]} 
            />
          ))}
        </View>
      </View>

      {/* TOGGLE BUTTON (Freeze / Activate) */}
      <View style={styles.toggleSection}>
        <TouchableOpacity 
          style={[styles.toggleButton, { backgroundColor: toggleBtnColor }]}
          onPress={handleToggleStatus}
          activeOpacity={0.8}
        />
        <Text style={styles.toggleText}>{toggleBtnText}</Text>
      </View>
    </SafeAreaView>
  );
}

// --- 4. STYLES ---
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    // transition background color smoothly (optional enhancement later)
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
  
  // Carousel Styles
  carouselSection: {
    height: 300,
    justifyContent: 'center',
    marginTop: 60,
  },
  cardContainer: {
    width: width, // Takes up full screen width so paging works perfectly
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: '#E8F4FA', // Soft off-white/blueish tint
    width: '80%',
    paddingVertical: 60,
    borderRadius: 30,
    alignItems: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
  },
  cardSubtitle: {
    fontSize: 18,
    color: '#555',
    marginBottom: 15,
  },
  cardBalance: {
    fontSize: 45,
    fontWeight: '500',
    color: '#000',
  },
  
  // Pagination Styles
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginHorizontal: 6,
  },

  // Toggle Section
  toggleSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  toggleButton: {
    width: 75,
    height: 75,
    borderRadius: 40, // Makes it a perfect circle
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
    marginBottom: 10,
  },
  toggleText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#222',
  },

  // Bottom Actions
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    paddingBottom: 40, // Keeps it off the bottom edge
  },
  actionItem: {
    alignItems: 'center',
  },
  actionCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#D9D9D9', // Light grey from your mockup
    marginBottom: 8,
  },
  actionText: {
    fontSize: 14,
    color: '#222',
    fontWeight: '500',
  }
});