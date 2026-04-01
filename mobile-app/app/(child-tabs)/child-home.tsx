// mobile-app/app/(child-tabs)/child-home.tsx
import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colours';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fetchApi } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { useFocusEffect } from 'expo-router';

const { width } = Dimensions.get('window');

interface ChildAccount {
  child_name: string;
  balance: number;
  account_id: string;
  status: string;
}

export default function ChildHomeScreen() {
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
      const response = await fetchApi(`/accounts/${account.account_id}/freeze`, {
        method: 'POST',
      });
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
  };

  const isFrozen = account?.status === 'Frozen';
  const backgroundColor = isFrozen ? Colors.backgroundPeach : Colors.backgroundBlue;

  if (loading) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: Colors.backgroundBlue }]}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor }]}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={28} color={Colors.buttonDark} />
        </TouchableOpacity>
        <Text style={styles.headerLogo}>N3XO</Text>
        <View style={{ width: 28 }} />
      </View>

      {/* BALANCE CARD */}
      <View style={styles.cardSection}>
        <View style={styles.card}>
          <Text style={styles.cardName}>{account?.child_name || 'My Account'}</Text>
          <Text style={styles.cardBalance}>£ {account?.balance.toFixed(2) || '0.00'}</Text>
          <Text style={styles.cardStatus}>
            {isFrozen ? 'Account Frozen' : 'Account Active'}
          </Text>
        </View>
      </View>

      {/* ACTIONS */}
      <View style={styles.actionsSection}>
        {/* Ping Parent */}
        <TouchableOpacity
          style={styles.actionButton}
          onPress={handlePingParent}
          activeOpacity={0.8}
        >
          <Ionicons name="notifications-outline" size={24} color={Colors.textWhite} />
          <Text style={styles.actionButtonText}>Ping Parent for Money</Text>
        </TouchableOpacity>

        {/* Freeze / Activate */}
        <TouchableOpacity
          style={[
            styles.actionButton,
            { backgroundColor: isFrozen ? '#1a7f37' : '#c44' },
          ]}
          onPress={handleToggleFreeze}
          activeOpacity={0.8}
        >
          <Ionicons
            name={isFrozen ? 'play-circle-outline' : 'snow-outline'}
            size={24}
            color={Colors.textWhite}
          />
          <Text style={styles.actionButtonText}>
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
  },
  loadingText: {
    fontSize: 18,
    color: Colors.textWhite,
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
  cardSection: {
    alignItems: 'center',
    marginTop: 40,
  },
  card: {
    backgroundColor: '#E8F4FA',
    width: '80%',
    paddingVertical: 50,
    borderRadius: 30,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
  },
  cardName: {
    fontSize: 20,
    color: '#555',
    marginBottom: 10,
    fontWeight: '600',
  },
  cardBalance: {
    fontSize: 45,
    fontWeight: '500',
    color: '#000',
    marginBottom: 10,
  },
  cardStatus: {
    fontSize: 14,
    color: '#777',
    fontWeight: '500',
  },
  actionsSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 30,
    paddingBottom: 100,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.buttonDark,
    paddingVertical: 16,
    paddingHorizontal: 28,
    borderRadius: 30,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  actionButtonText: {
    color: Colors.textWhite,
    fontSize: 16,
    fontWeight: '600',
  },
});
