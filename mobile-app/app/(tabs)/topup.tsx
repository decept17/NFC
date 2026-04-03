// mobile-app/app/(tabs)/topup.tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard, Alert, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFamily } from '@/context/FamilyContext';
import { fetchApi } from '@/services/api';

import { Colors } from '@/constants/Colours';
import { PillButton } from '@/components/PillButton';
import { PillInput } from '@/components/PillInput';

// Quick-amount presets
const QUICK_AMOUNTS = ['5', '10', '20', '50'];

export default function TopUpScreen() {
  const router = useRouter();
  const { selectedAccount } = useFamily();
  const [amount, setAmount] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const handleTopUp = async () => {
    const numericAmount = parseFloat(amount);
    if (!amount || isNaN(numericAmount) || numericAmount <= 0) {
      Alert.alert("Invalid Amount", "Please enter a valid amount to top up.");
      return;
    }

    setLoading(true);
    try {
      const redirectUrl = Linking.createURL('/stripe-redirect');
      const returnUrlSuccess = `${redirectUrl}?payment=success`;
      const returnUrlCancel = `${redirectUrl}?payment=cancel`;

      const response = await fetchApi(`/accounts/${selectedAccount?.id}/create-checkout-session`, {
        method: 'POST',
        body: JSON.stringify({
          amount: numericAmount,
          success_url: returnUrlSuccess,
          cancel_url: returnUrlCancel,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to initialise payment");
      }

      const { url } = await response.json();
      const result = await WebBrowser.openAuthSessionAsync(url, redirectUrl);

      if (result.type === 'success') {
        if (result.url.includes('payment=success')) {
          setTimeout(() => {
            Alert.alert(
              "Success!",
              `£${numericAmount.toFixed(2)} has been added to ${selectedAccount?.name}'s account.`,
              [{ text: "OK", onPress: () => router.push('/(tabs)/home') }]
            );
          }, 500);
        } else {
          setTimeout(() => Alert.alert("Cancelled", "Payment was cancelled."), 500);
        }
      } else if (result.type === 'cancel' || result.type === 'dismiss') {
        setTimeout(() => Alert.alert("Cancelled", "Payment was closed."), 500);
      }
    } catch (err) {
      console.error(err);
      setTimeout(() => Alert.alert("Error", "Something went wrong."), 500);
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.container}
        >
          {/* HEADER */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.push('/(tabs)/home')} style={styles.headerBack}>
              <Ionicons name="arrow-back" size={20} color={Colors.textWhite} />
            </TouchableOpacity>
            <View style={{ alignItems: 'center' }}>
              <Text style={styles.headerLogo}>N3XO</Text>
              <Text style={styles.headerSub}>Top Up</Text>
            </View>
            <View style={{ width: 38 }} />
          </View>

          <View style={styles.content}>
            {/* Account badge */}
            <View style={styles.accountBadge}>
              <View style={styles.accountIcon}>
                <Ionicons name="person-outline" size={22} color={Colors.electricBlue} />
              </View>
              <View>
                <Text style={styles.accountName}>{selectedAccount?.name}</Text>
                <Text style={styles.accountBalance}>£{selectedAccount?.balance.toFixed(2)} balance</Text>
              </View>
            </View>

            {/* Quick amount selector */}
            <Text style={styles.label}>Quick Select</Text>
            <View style={styles.quickRow}>
              {QUICK_AMOUNTS.map((q) => (
                <TouchableOpacity
                  key={q}
                  style={[styles.quickChip, amount === q && styles.quickChipActive]}
                  onPress={() => setAmount(q)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.quickChipText, amount === q && styles.quickChipTextActive]}>
                    £{q}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Custom Amount (£)</Text>
            <PillInput
              placeholder="0.00"
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
            />

            <View style={styles.buttonWrapper}>
              <PillButton
                title={`Pay £${amount ? parseFloat(amount).toFixed(2) : '0.00'}`}
                onPress={handleTopUp}
                isLoading={loading}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.deepNavy,
  },
  container: {
    flex: 1,
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
  headerSub: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginTop: 1,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 24,
    paddingHorizontal: 24,
  },
  accountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    width: '100%',
    backgroundColor: Colors.glassCard,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    borderRadius: 28,
    paddingVertical: 18,
    paddingHorizontal: 22,
    marginBottom: 28,
  },
  accountIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(77,143,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountName: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textWhite,
  },
  accountBalance: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  label: {
    alignSelf: 'flex-start',
    fontSize: 12,
    fontWeight: '700',
    color: Colors.electricBlue,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  quickRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
    width: '100%',
  },
  quickChip: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 22,
    alignItems: 'center',
    backgroundColor: Colors.glassCard,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  quickChipActive: {
    backgroundColor: Colors.eclipseBlue,
    borderColor: Colors.electricBlue,
    shadowColor: Colors.electricBlue,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  quickChipText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  quickChipTextActive: {
    color: Colors.textWhite,
  },
  buttonWrapper: {
    marginTop: 36,
    width: '80%',
    alignItems: 'center',
  },
});