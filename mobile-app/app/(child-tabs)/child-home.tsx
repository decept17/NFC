// mobile-app/app/(child-tabs)/child-home.tsx
import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colours';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fetchApi } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { useFocusEffect, useRouter } from 'expo-router';

const { width } = Dimensions.get('window');

interface ChildAccount {
  child_name: string;
  balance: number;
  account_id: string;
  status: string;
}

export default function ChildHomeScreen() {
  const router = useRouter();
  const { logout } = useAuth();
  const [account, setAccount] = useState<ChildAccount | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAccount = async () => {
    try {
      const response = await fetchApi('/child/my-account');
      if (response.ok) {
        const data = await response.json();
        setAccount(data);
      }
    } catch (e) {
      console.error('Failed to fetch child account', e);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchAccount();
    }, [])
  );

  const handlePingParent = async () => {
    try {
      const response = await fetchApi('/notifications/ping', {
        method: 'POST',
        body: JSON.stringify({ message: 'Can I have some money?' }),
      });
      if (response.ok) {
        Alert.alert('Done!', 'Your parent has been notified!');
      } else {
        Alert.alert('Error', 'Could not send notification.');
      }
    } catch (e) {
      Alert.alert('Error', 'Something went wrong.');
    }
  };

  const handleToggleFreeze = async () => {
    if (!account) return;
    try {
      const response = await fetchApi(`/accounts/${account.account_id}/freeze`, { method: 'POST' });
      if (response.ok) {
        const data = await response.json();
        setAccount({ ...account, status: data.status });
      } else {
        Alert.alert('Error', 'Failed to update account status.');
      }
    } catch (e) {
      Alert.alert('Error', 'Something went wrong.');
    }
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/');
  };

  const isFrozen = account?.status === 'Frozen';
  const backgroundColor = isFrozen ? Colors.frozenTeal : Colors.deepNavy;

  if (loading) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: Colors.deepNavy }]}>
        <View style={styles.loadingContainer}>
          <View style={styles.loadingRing}>
            <Ionicons name="hourglass-outline" size={32} color={Colors.electricBlue} />
          </View>
          <Text style={styles.loadingText}>Loading…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor }]}>

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleLogout} style={styles.headerIconBtn}>
          <Ionicons name="log-out-outline" size={22} color={Colors.electricBlue} />
        </TouchableOpacity>
        <Text style={styles.headerLogo}>N3XO</Text>
        <View style={{ width: 38 }} />
      </View>

      {/* BALANCE CARD */}
      <View style={styles.cardSection}>
        <View style={[styles.card, isFrozen && styles.cardFrozen]}>
          {isFrozen && (
            <View style={styles.frozenBadge}>
              <Ionicons name="snow-outline" size={12} color={Colors.textWhite} />
              <Text style={styles.frozenBadgeText}>Frozen</Text>
            </View>
          )}
          <Text style={styles.cardName}>
            {account?.child_name || 'My Account'}
          </Text>
          <Text style={styles.cardBalance}>
            £ {account?.balance.toFixed(2) || '0.00'}
          </Text>
          <Text style={styles.cardStatus}>
            {isFrozen ? '❄️  Account Frozen' : '✓  Account Active'}
          </Text>
        </View>
      </View>

      {/* ACTIONS */}
      <View style={styles.actionsSection}>
        {/* Ping Parent */}
        <TouchableOpacity
          style={[styles.actionButton, isFrozen && styles.actionButtonFrozen]}
          onPress={handlePingParent}
          activeOpacity={0.8}
        >
          <Ionicons name="notifications-outline" size={22} color={Colors.textWhite} />
          <Text style={styles.actionButtonText}>Ping Parent for Money</Text>
        </TouchableOpacity>

        {/* Freeze / Activate */}
        <TouchableOpacity
          style={[
            styles.actionButton,
            {
              backgroundColor: isFrozen
                ? Colors.successGreen
                : 'rgba(255,77,106,0.18)',
              borderColor: isFrozen
                ? Colors.successGreen
                : 'rgba(255,77,106,0.40)',
            },
          ]}
          onPress={handleToggleFreeze}
          activeOpacity={0.8}
        >
          <Ionicons
            name={isFrozen ? 'play-circle-outline' : 'snow-outline'}
            size={22}
            color={isFrozen ? Colors.textWhite : Colors.dangerRed}
          />
          <Text style={[styles.actionButtonText, !isFrozen && { color: Colors.dangerRed }]}>
            {isFrozen ? 'Activate Account' : 'Freeze Account'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 14,
  },
  loadingRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.glassCard,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: Colors.textSecondary,
    fontWeight: '500',
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
  headerIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.glassCard,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
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

  // Balance Card
  cardSection: {
    alignItems: 'center',
    marginTop: 40,
  },
  card: {
    backgroundColor: '#131C30',   // Solid opaque — matches home.tsx
    width: '82%',
    paddingVertical: 48,
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
    gap: 8,
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
  cardName: {
    fontSize: 18,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  cardBalance: {
    fontSize: 50,
    fontWeight: '600',
    color: Colors.textWhite,
    letterSpacing: -1,
  },
  cardStatus: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500',
  },

  // Actions
  actionsSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 28,
    paddingBottom: 100,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.eclipseBlue,
    paddingVertical: 17,
    paddingHorizontal: 28,
    borderRadius: 30,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(77,143,255,0.30)',
    shadowColor: Colors.electricBlue,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 5,
  },
  actionButtonFrozen: {
    backgroundColor: 'rgba(27,47,232,0.30)',
    shadowOpacity: 0.15,
  },
  actionButtonText: {
    color: Colors.textWhite,
    fontSize: 16,
    fontWeight: '700',
  },
});
