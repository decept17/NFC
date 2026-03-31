import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/Colours';
import { useFamily } from '@/context/FamilyContext';
import { useAuth } from '@/context/AuthContext';

// Helper component for individual rows
const SettingsRow = ({ title, isLast = false, onPress }: { title: string, isLast?: boolean, onPress: () => void }) => (
  <TouchableOpacity style={styles.rowItem} onPress={onPress}>
    <Text style={styles.rowText}>{title}</Text>
    {!isLast && <View style={styles.divider} />}
  </TouchableOpacity>
);

// Toggle row with a switch
const SettingsToggleRow = ({ title, value, onToggle, isLast = false }: {
  title: string, value: boolean, onToggle: (val: boolean) => void, isLast?: boolean
}) => (
  <View style={styles.rowItem}>
    <View style={styles.toggleRow}>
      <Text style={styles.rowText}>{title}</Text>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: '#ccc', true: Colors.backgroundBlue }}
        thumbColor="#fff"
      />
    </View>
    {!isLast && <View style={styles.divider} />}
  </View>
);


export default function SettingsScreen() {
  const router = useRouter();
  const { selectedAccount } = useFamily();
  const { biometricsAvailable, biometricsEnabled, enableBiometrics, disableBiometrics, logout } = useAuth();

  const handleBiometricToggle = async (value: boolean) => {
    if (value) {
      await enableBiometrics();
    } else {
      await disableBiometrics();
    }
  };

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out', style: 'destructive', onPress: async () => {
          await logout();
          router.replace('/');
        }
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={32} color="#000" />
        </TouchableOpacity>
        
        <Text style={styles.headerLogo}>N3XO</Text>
        
        <TouchableOpacity>
          <Ionicons name="person-outline" size={28} color="#000" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* TITLE */}
        <Text style={styles.pageTitle}>Settings</Text>

        {/* GROUP 1: Account Controls */}
        <View style={styles.cardGroup}>
          <SettingsRow 
            title="Blocked categories" 
            onPress={() => router.push('/limits')} 
          />
          <SettingsRow 
            title="Limits" 
            onPress={() => router.push('/limits')} 
          />
          <SettingsRow 
            title="Recurring payments" 
            isLast={true} 
            onPress={() => console.log('Recurring pressed')} 
          />
        </View>

        {/* GROUP 2: Security */}
        <View style={styles.cardGroup}>
          {biometricsAvailable && (
            <SettingsToggleRow
              title="Biometric Login"
              value={biometricsEnabled}
              onToggle={handleBiometricToggle}
            />
          )}
          <SettingsRow 
            title="Notifications" 
            onPress={() => router.push('/notifications')} 
          />
          <SettingsRow 
            title="Leave a review" 
            isLast={true} 
            onPress={() => console.log('Review pressed')} 
          />
        </View>

        {/* GROUP 3: Support */}
        <View style={styles.cardGroup}>
          <SettingsRow 
            title="Contact us" 
            isLast={true} 
            onPress={() => console.log('Contact pressed')} 
          />
        </View>

        {/* LOG OUT */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={20} color="#E53935" />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>

      </ScrollView>


    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.backgroundBlue,
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
    fontWeight: 'bold',
    color: Colors.textOrange,
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  scrollContent: {
    paddingHorizontal: 25,
    paddingBottom: 40,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 20,
  },
  
  // Settings Card Styles
  cardGroup: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 20,
    marginBottom: 25,
    paddingVertical: 5,
    paddingHorizontal: 20,
  },
  rowItem: {
    paddingVertical: 15,
  },
  rowText: {
    fontSize: 18,
    color: '#000',
    fontWeight: '500',
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: '#000',
    marginTop: 15,
  },

  // Logout button
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E53935',
  },
});