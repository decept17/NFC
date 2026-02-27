import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard, Alert} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useStripe, CardField } from '@stripe/stripe-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Reuse your existing UI components
import { Colors } from '@/constants/Colours';
import { PillButton } from '@/components/PillButton';
import { PillInput } from '@/components/PillInput';
import { TouchableOpacity } from 'react-native';

export default function TopUpScreen() {
  const router = useRouter();
  const { createPaymentMethod } = useStripe();
  
  const [amount, setAmount] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [isCardComplete, setIsCardComplete] = useState<boolean>(false);

  const handleTopUp = async () => {
    // 1. Basic Validation
    const numericAmount = parseFloat(amount);
    if (!amount || isNaN(numericAmount) || numericAmount <= 0) {
      Alert.alert("Invalid Amount", "Please enter a valid amount to top up.");
      return;
    }

    if (!isCardComplete) {
      Alert.alert("Incomplete Details", "Please fill out all card details.");
      return;
    }

    setLoading(true);

    try {
      // 2. Ask Stripe to tokenize the card details securely
      const { paymentMethod, error } = await createPaymentMethod({
        paymentMethodType: 'Card',
      });

      if (error) {
        Alert.alert("Payment Failed", error.message);
        setLoading(false);
        return;
      }

      // 3. Send the tokenized ID and amount to your Python Backend
      console.log("Success! Sending to backend:", {
        amount: numericAmount,
        paymentMethodId: paymentMethod.id
      });

      /* TODO: Wire this up to your API later!
        const response = await axios.post(`/api/accounts/${accountId}/topup`, {
          amount: numericAmount,
          paymentMethodId: paymentMethod.id
        });
      */

      // Simulate network delay for now
      setTimeout(() => {
        setLoading(false);
        Alert.alert("Success!", `£${numericAmount.toFixed(2)} has been added to the account.`);
        router.push('/(tabs)/home');
      }, 1500);

    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Something went wrong.");
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
            <TouchableOpacity onPress={() => router.push('/(tabs)/home')}>
              <Ionicons name="arrow-back" size={32} color={Colors.buttonDark} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Top Up</Text>
            <View style={{ width: 32 }} /> {/* Spacer for centering */}
          </View>

          <View style={styles.content}>
            
            {/* AMOUNT INPUT */}
            <Text style={styles.label}>Enter Amount (£)</Text>
            <PillInput 
              placeholder="0.00" 
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad" 
            />

            {/* STRIPE CARD FIELD */}
            <Text style={styles.label}>Payment Details</Text>
            <View style={styles.cardContainer}>
              <CardField
                postalCodeEnabled={false} // Disable if you don't require billing zip code
                onCardChange={(cardDetails) => {
                  setIsCardComplete(cardDetails.complete);
                }}
                style={styles.cardField}
                cardStyle={{
                  backgroundColor: '#FFFFFF',
                  textColor: '#000000',
                  borderRadius: 8,
                }}
              />
            </View>

            {/* SUBMIT BUTTON */}
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
  cardContainer: {
    width: '80%',
    height: 50,
    marginVertical: 10,
  },
  cardField: {
    width: '100%',
    height: '100%',
  },
  buttonWrapper: {
    marginTop: 50,
    width: '80%',
    alignItems: 'center',
  }
});