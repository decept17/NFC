// mobile-app/app/(tabs)/home.tsx
import React, { useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Dimensions, FlatList, TouchableOpacity, } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colours';
import { SafeAreaView } from "react-native-safe-area-context";
import { useFamily, Account } from '@/context/FamilyContext';
import { fetchApi } from '@/services/api';
import { router, useFocusEffect, useNavigation } from 'expo-router';

const { width } = Dimensions.get('window');

export default function HomeScreen() {
  // 1. Hook into the Global Context instead of local state!
  const { accounts, setAccounts, selectedAccountId, setSelectedAccountId, selectedAccount, refreshAccounts } = useFamily();
  const navigation = useNavigation();

  React.useEffect(() => {
    const unsubscribe = (navigation as any).addListener('tabPress', (e: any) => {
      // Trigger a refresh when the home tab icon is pressed (even if already on the home screen)
      refreshAccounts();
    });

    return unsubscribe;
  }, [navigation, refreshAccounts]);

  useFocusEffect(
    useCallback(() => {
      refreshAccounts();
    }, [])
  );

  // Find the index of the selected account for the carousel
  const currentIndex = accounts.findIndex(acc => acc.id === selectedAccountId);

  // Safe fallback - show empty state if the parent has no children yet
  if (!selectedAccount) {
    return (
      <SafeAreaView style={styles.emptyState}>
        <View style={styles.header}>
          <TouchableOpacity>
            <Ionicons name="person-outline" size={28} color={Colors.buttonDark} />
          </TouchableOpacity>
          <Text style={styles.headerLogo}>N3XO</Text>
          <TouchableOpacity onPress={() => router.push('/settings')}>
            <Ionicons name="ellipsis-vertical" size={28} color={Colors.buttonDark} />
          </TouchableOpacity>
        </View>
        <View style={styles.emptyContent}>
          <Ionicons name="people-outline" size={80} color={Colors.textOrange} />
          <Text style={styles.emptyTitle}>No Accounts Yet</Text>
          <Text style={styles.emptySubtitle}>
            Add a child account to get started. They'll be able to use their NFC wristband to make payments.
          </Text>
          <TouchableOpacity
            style={styles.addChildBtn}
            onPress={() => router.push('/add-child')}
            activeOpacity={0.8}
          >
            <Ionicons name="person-add-outline" size={20} color={Colors.textWhite} />
            <Text style={styles.addChildBtnText}>Add Child</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const isFrozen = selectedAccount.status === 'Frozen';
  const backgroundColor = isFrozen ? Colors.backgroundPeach : Colors.backgroundBlue;
  const toggleBtnColor = isFrozen ? Colors.backgroundBlue : Colors.backgroundPeach;
  const toggleBtnText = isFrozen ? "Activate" : "Freeze";

  // 2. Update Global Context when swiping
  const handleScroll = (event: any) => {
    const slideSize = event.nativeEvent.layoutMeasurement.width;
    const index = event.nativeEvent.contentOffset.x / slideSize;
    const roundIndex = Math.round(index);

    if (roundIndex !== currentIndex && accounts[roundIndex]) {
      // The user swiped! Tell the whole app that a new child is selected.
      setSelectedAccountId(accounts[roundIndex].id);
    }
  };

  // 3. Toggle Status (calls backend, updates global state)
  const handleToggleStatus = async () => {
    if (!selectedAccountId) return;
    try {
      const response = await fetchApi(`/accounts/${selectedAccountId}/freeze`, {
        method: 'POST',
      });
      if (response.ok) {
        const data = await response.json();
        const updatedAccounts = accounts.map(acc => {
          if (acc.id === selectedAccountId) {
            return { ...acc, status: data.status };
          }
          return acc;
        });
        setAccounts(updatedAccounts);
      } else {
        alert("Failed to update status");
      }
    } catch (error) {
      console.error(error);
      alert("An error occurred while communicating with the server");
    }
  };

  // --- 3. RENDER COMPONENTS ---

  const renderChildCard = ({ item }: { item: Account }) => (
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

        <TouchableOpacity onPress={() => router.push('/settings')}>
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

        {/* Add child shortcut */}
        <TouchableOpacity
          style={styles.addChildBtn}
          onPress={() => router.push('/add-child')}
          activeOpacity={0.8}
        >
          <Ionicons name="person-add-outline" size={20} color={Colors.textWhite} />
          <Text style={styles.addChildBtnText}>Add Child</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// --- 4. STYLES ---
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    backgroundColor: Colors.backgroundBlue,
  },
  emptyContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    gap: 16,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.textWhite,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    lineHeight: 22,
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
  addChildBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 24,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  addChildBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textWhite,
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