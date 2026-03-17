import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFamily } from '@/context/FamilyContext';
import { fetchApi } from '@/services/api';

// Reusing existing UI components
import { Colors } from '@/constants/Colours';
import { PillButton } from '@/components/PillButton';
import { PillInput } from '@/components/PillInput';
import { TouchableOpacity } from 'react-native';

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
      // Create deep links to automatically return to the app
      const returnUrlSuccess = Linking.createURL('/(tabs)/home', { queryParams: { payment: 'success' } });
      const returnUrlCancel = Linking.createURL('/(tabs)/home', { queryParams: { payment: 'cancel' } });

      // Step 1: Ask our backend to create a Stripe Checkout Session
      const response = await fetchApi(`/accounts/${selectedAccount?.id}/create-checkout-session`, {
        method: 'POST',
        body: JSON.stringify({ 
          amount: numericAmount,
          success_url: returnUrlSuccess,
          cancel_url: returnUrlCancel
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to initialise payment");
      }

      const { url } = await response.json();

      // Step 2: Open the Stripe Checkout page
      // openAuthSessionAsync handles the redirect URL. Once Stripe redirects to `mobileapp://...` 
      // the browser safely closes and brings the user back into the app natively.
      const result = await WebBrowser.openAuthSessionAsync(url, Linking.createURL('/'));

      if (result.type === 'success') {
        if (result.url.includes('payment=success')) {
          Alert.alert(
            "Success!",
            `£${numericAmount.toFixed(2)} has been added to ${selectedAccount?.name}'s account.`
          );
          router.push('/(tabs)/home');
        } else {
          Alert.alert("Cancelled", "Payment was cancelled.");
        }
      } else if (result.type === 'cancel' || result.type === 'dismiss') {
        Alert.alert("Cancelled", "Payment was closed.");
      }

    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Something went wrong.");
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
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.push('/(tabs)/home')}>
              <Ionicons name="person-outline" size={32} color={Colors.buttonDark} />
            </TouchableOpacity>
            {/* DYNAMIC TITLE */}
            <Text style={styles.headerTitle}>Top Up {selectedAccount?.name}</Text>
            <View style={{ width: 32 }} />
          </View>

          <View style={styles.content}>
            <Text style={styles.label}>Enter Amount (£)</Text>
            <PillInput
              placeholder="0.00"
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
            />

            <View style={styles.buttonWrapper}>
              <PillButton
                title={`Pay £${amount ? amount : '0.00'}`}
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
    backgroundColor: Colors.backgroundBlue,
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
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#222',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 40,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    alignSelf: 'flex-start',
    marginLeft: '10%',
    marginBottom: 10,
    marginTop: 20,
  },
  buttonWrapper: {
    marginTop: 50,
    width: '80%',
    alignItems: 'center',
  }
});