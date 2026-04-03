// mobile-app/app/(tabs)/settings.tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/Colours';
import { useFamily } from '@/context/FamilyContext';
import { useAuth } from '@/context/AuthContext';

// ── Sub-components ────────────────────────────────────────────────────────────

const SettingsRow = ({
  title,
  icon,
  isLast = false,
  onPress,
}: {
  title: string;
  icon?: string;
  isLast?: boolean;
  onPress: () => void;
}) => (
  <TouchableOpacity style={[styles.rowItem, !isLast && styles.rowItemBorder]} onPress={onPress} activeOpacity={0.7}>
    <View style={styles.rowLeft}>
      {icon && (
        <View style={styles.rowIconRing}>
          <Ionicons name={icon as any} size={16} color={Colors.electricBlue} />
        </View>
      )}
      <Text style={styles.rowText}>{title}</Text>
    </View>
    <Ionicons name="chevron-forward" size={18} color={Colors.textSecondary} />
  </TouchableOpacity>
);

const SettingsToggleRow = ({
  title,
  icon,
  value,
  onToggle,
  isLast = false,
}: {
  title: string;
  icon?: string;
  value: boolean;
  onToggle: (val: boolean) => void;
  isLast?: boolean;
}) => (
  <View style={[styles.rowItem, !isLast && styles.rowItemBorder]}>
    <View style={styles.rowLeft}>
      {icon && (
        <View style={styles.rowIconRing}>
          <Ionicons name={icon as any} size={16} color={Colors.electricBlue} />
        </View>
      )}
      <Text style={styles.rowText}>{title}</Text>
    </View>
    <Switch
      value={value}
      onValueChange={onToggle}
      trackColor={{ false: 'rgba(255,255,255,0.12)', true: Colors.eclipseBlue }}
      thumbColor={Colors.textWhite}
    />
  </View>
);

// ── Main Screen ───────────────────────────────────────────────────────────────

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
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/');
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea}>

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBack}>
          <Ionicons name="arrow-back" size={22} color={Colors.textWhite} />
        </TouchableOpacity>
        <Text style={styles.headerLogo}>N3XO</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        <Text style={styles.pageTitle}>Settings</Text>

        {/* GROUP 1: Account Controls */}
        <Text style={styles.groupLabel}>Account</Text>
        <View style={styles.cardGroup}>
          <SettingsRow
            title="Blocked categories"
            icon="ban-outline"
            onPress={() => router.push('/limits')}
          />
          <SettingsRow
            title="Limits"
            icon="speedometer-outline"
            onPress={() => router.push('/limits')}
          />
          <SettingsRow
            title="Recurring payments"
            icon="repeat-outline"
            isLast
            onPress={() => console.log('Recurring pressed')}
          />
        </View>

        {/* GROUP 2: Security */}
        <Text style={styles.groupLabel}>Security & Privacy</Text>
        <View style={styles.cardGroup}>
          {biometricsAvailable && (
            <SettingsToggleRow
              title="Biometric Login"
              icon="finger-print-outline"
              value={biometricsEnabled}
              onToggle={handleBiometricToggle}
            />
          )}
          <SettingsRow
            title="Notifications"
            icon="notifications-outline"
            onPress={() => router.push('/notifications')}
          />
          <SettingsRow
            title="Leave a review"
            icon="star-outline"
            isLast
            onPress={() => console.log('Review pressed')}
          />
        </View>

        {/* GROUP 3: Support */}
        <Text style={styles.groupLabel}>Support</Text>
        <View style={styles.cardGroup}>
          <SettingsRow
            title="Contact us"
            icon="chatbubble-outline"
            isLast
            onPress={() => console.log('Contact pressed')}
          />
        </View>

        {/* LOG OUT */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={20} color={Colors.dangerRed} />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>

        <Text style={styles.versionText}>N3XO · v1.0.0</Text>

      </ScrollView>
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
  headerBack: {
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
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
    color: Colors.textWhite,
    textShadowColor: Colors.electricBlue,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  scrollContent: {
    paddingHorizontal: 22,
    paddingBottom: 60,
  },
  pageTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: Colors.textWhite,
    marginBottom: 28,
    letterSpacing: -0.5,
  },
  groupLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.electricBlue,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 10,
    marginLeft: 4,
  },
  // Card Group
  cardGroup: {
    backgroundColor: Colors.glassCard,
    borderRadius: 20,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    overflow: 'hidden',
  },
  rowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  rowItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.glassDivider,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowIconRing: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(77,143,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    fontSize: 16,
    color: Colors.textWhite,
    fontWeight: '500',
  },

  // Logout
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(255,77,106,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,77,106,0.25)',
    marginBottom: 24,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.dangerRed,
  },
  versionText: {
    textAlign: 'center',
    fontSize: 12,
    color: Colors.textMuted,
    letterSpacing: 0.5,
  },
});