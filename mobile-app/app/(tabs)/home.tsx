// mobile-app/app/(tabs)/home.tsx
import React, { useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Dimensions, FlatList, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colours';
import { SafeAreaView } from "react-native-safe-area-context";
import { useFamily, Account } from '@/context/FamilyContext';
import { fetchApi } from '@/services/api';
import { router, useFocusEffect, useNavigation } from 'expo-router';

const { width } = Dimensions.get('window');

export default function HomeScreen() {
  const { accounts, setAccounts, selectedAccountId, setSelectedAccountId, selectedAccount, refreshAccounts } = useFamily();
  const navigation = useNavigation();
  const [unreadCount, setUnreadCount] = useState(0);

  React.useEffect(() => {
    const unsubscribe = (navigation as any).addListener('tabPress', (e: any) => {
      refreshAccounts();
    });
    return unsubscribe;
  }, [navigation, refreshAccounts]);

  useFocusEffect(
    useCallback(() => {
      refreshAccounts();
      const fetchNotifCount = async () => {
        try {
          const response = await fetchApi('/notifications');
          if (response.ok) {
            const data = await response.json();
            const active = data.filter((n: any) => n.status !== 'dismissed');
            setUnreadCount(active.length);
          }
        } catch (e) { /* silent */ }
      };
      fetchNotifCount();
    }, [])
  );

  const currentIndex = accounts.findIndex(acc => acc.id === selectedAccountId);

  // ── Empty state ───────────────────────────────────────────────────────────
  if (!selectedAccount) {
    return (
      <SafeAreaView style={styles.emptyState}>
        <View style={styles.header}>
          <TouchableOpacity>
            <Ionicons name="person-outline" size={28} color={Colors.electricBlue} />
          </TouchableOpacity>
          <Text style={styles.headerLogo}>N3XO</Text>
          <TouchableOpacity onPress={() => router.push('/settings')}>
            <Ionicons name="ellipsis-vertical" size={28} color={Colors.electricBlue} />
          </TouchableOpacity>
        </View>
        <View style={styles.emptyContent}>
          <View style={styles.emptyIconRing}>
            <Ionicons name="people-outline" size={44} color={Colors.electricBlue} />
          </View>
          <Text style={styles.emptyTitle}>No Accounts Yet</Text>
          <Text style={styles.emptySubtitle}>
            Add a child account to get started. They'll be able to use their NFC wristband to make payments.
          </Text>
          <TouchableOpacity
            style={styles.addChildBtn}
            onPress={() => router.push('/add-child')}
            activeOpacity={0.8}
          >
            <Ionicons name="person-add-outline" size={18} color={Colors.textWhite} />
            <Text style={styles.addChildBtnText}>Add Child</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const isFrozen = selectedAccount.status === 'Frozen';
  const backgroundColor = isFrozen ? Colors.frozenTeal : Colors.deepNavy;
  const toggleBtnColor = isFrozen ? Colors.eclipseBlue : Colors.frozenTeal;
  const toggleBtnText = isFrozen ? "Activate" : "Freeze";

  const handleScroll = (event: any) => {
    const slideSize = event.nativeEvent.layoutMeasurement.width;
    const index = event.nativeEvent.contentOffset.x / slideSize;
    const roundIndex = Math.round(index);
    if (roundIndex !== currentIndex && accounts[roundIndex]) {
      setSelectedAccountId(accounts[roundIndex].id);
    }
  };

  const handleToggleStatus = async () => {
    if (!selectedAccountId) return;
    try {
      const response = await fetchApi(`/accounts/${selectedAccountId}/freeze`, { method: 'POST' });
      if (response.ok) {
        const data = await response.json();
        const updatedAccounts = accounts.map(acc =>
          acc.id === selectedAccountId ? { ...acc, status: data.status } : acc
        );
        setAccounts(updatedAccounts);
      } else {
        alert("Failed to update status");
      }
    } catch (error) {
      console.error(error);
      alert("An error occurred while communicating with the server");
    }
  };

  const renderChildCard = ({ item }: { item: Account }) => (
    <View style={styles.cardContainer}>
      <View style={[styles.card, isFrozen && styles.cardFrozen]}>
        {/* Status badge */}
        {isFrozen && (
          <View style={styles.frozenBadge}>
            <Ionicons name="snow-outline" size={12} color={Colors.deepNavy} />
            <Text style={styles.frozenBadgeText}>Frozen</Text>
          </View>
        )}
        <Text style={styles.cardSubtitle}>{item.name} · {item.role}</Text>
        <Text style={[styles.cardBalance, isFrozen && styles.cardBalanceFrozen]}>
          £ {item.balance.toFixed(2)}
        </Text>
        <Text style={styles.cardAvailable}>Available balance</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor }]}>

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.push('/notifications')} style={styles.bellContainer}>
          <Ionicons name="notifications-outline" size={28} color={Colors.electricBlue} />
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>

        <Text style={styles.headerLogo}>N3XO</Text>

        <TouchableOpacity onPress={() => router.push('/settings')}>
          <Ionicons name="ellipsis-vertical" size={28} color={Colors.electricBlue} />
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
                {
                  backgroundColor: index === currentIndex
                    ? (isFrozen ? Colors.deepNavy : Colors.electricBlue)
                    : (isFrozen ? 'rgba(10,14,26,0.3)' : 'rgba(255,255,255,0.25)')
                }
              ]}
            />
          ))}
        </View>
      </View>

      {/* TOGGLE + ADD CHILD */}
      <View style={styles.toggleSection}>
        <TouchableOpacity
          style={[styles.toggleButton, { backgroundColor: toggleBtnColor }]}
          onPress={handleToggleStatus}
          activeOpacity={0.8}
        >
          <Ionicons
            name={isFrozen ? "play-circle-outline" : "snow-outline"}
            size={32}
            color={isFrozen ? Colors.textWhite : Colors.deepNavy}
          />
        </TouchableOpacity>
        <Text style={styles.toggleText}>
          {toggleBtnText}
        </Text>

        <TouchableOpacity
          style={styles.addChildBtn}
          onPress={() => router.push('/add-child')}
          activeOpacity={0.8}
        >
          <Ionicons name="person-add-outline" size={18} color={Colors.textWhite} />
          <Text style={styles.addChildBtnText}>Add Child</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    backgroundColor: Colors.deepNavy,
  },
  emptyContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    gap: 18,
  },
  emptyIconRing: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: Colors.glassCard,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.textWhite,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },

  // Header
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
    fontWeight: '800',
    letterSpacing: -1,
    color: Colors.textWhite,
    textShadowColor: Colors.electricBlue,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 16,
  },
  headerLogoFrozen: {
    color: Colors.textWhite,
    textShadowColor: 'transparent',
  },

  // Carousel
  carouselSection: {
    height: 300,
    justifyContent: 'center',
    marginTop: 60,
  },
  cardContainer: {
    width: width,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: '#131C30',   // Solid dark navy — opaque, no glass
    width: '80%',
    paddingVertical: 50,
    paddingHorizontal: 28,
    borderRadius: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(77,143,255,0.20)',
    shadowColor: Colors.electricBlue,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
    position: 'relative',
  },
  cardFrozen: {
    backgroundColor: 'transparent',       // Flush with frozen blue background — one colour
    borderColor: 'rgba(255,255,255,0.22)',
    shadowOpacity: 0,
    elevation: 0,
  },
  frozenBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  frozenBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textWhite,
  },
  cardSubtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginBottom: 18,
    fontWeight: '500',
  },
  cardBalance: {
    fontSize: 46,
    fontWeight: '600',
    color: Colors.textWhite,
    letterSpacing: -1,
  },
  cardBalanceFrozen: {
    color: Colors.textWhite,  // White stays readable on frozen blue
  },
  cardAvailable: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 8,
    letterSpacing: 0.5,
  },

  // Pagination
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginHorizontal: 5,
  },

  // Toggle section
  toggleSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  toggleButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
    marginBottom: 10,
  },
  toggleText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  addChildBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 24,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 30,
    backgroundColor: Colors.glassCard,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  addChildBtnFrozen: {
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderColor: 'rgba(10,14,26,0.25)',
  },
  addChildBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textWhite,
  },

  // Notification bell
  bellContainer: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -6,
    backgroundColor: Colors.dangerRed,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
});