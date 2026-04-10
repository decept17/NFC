// mobile-app/app/forgot-password.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { Colors } from '@/constants/Colours';
import { PillButton } from '@/components/PillButton';
import { PillInput } from '@/components/PillInput';
import { requestPasswordReset } from '@/services/api';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      alert('Please enter your email address.');
      return;
    }

    setLoading(true);
    try {
      // requestPasswordReset never throws — API always returns 200
      await requestPasswordReset(trimmed);
      setSubmitted(true);
    } catch {
      // Network failure — still show the same message to avoid confusion
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.inner}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backButton}
              activeOpacity={0.7}
            >
              <Ionicons name="chevron-back" size={24} color={Colors.textWhite} />
            </TouchableOpacity>
          </View>

          {/* Logo */}
          <View style={styles.logoSection}>
            <Text style={styles.logoText}>N3XO</Text>
            <View style={styles.modePill}>
              <Text style={styles.modeLabel}>🔑  Reset Password</Text>
            </View>
          </View>

          {/* Content */}
          <View style={styles.form}>
            {submitted ? (
              /* ── Success state ── */
              <View style={styles.successCard}>
                <Ionicons name="mail-outline" size={48} color={Colors.electricBlue} />
                <Text style={styles.successTitle}>Check your email</Text>
                <Text style={styles.successBody}>
                  If an account exists for{' '}
                  <Text style={styles.successEmail}>{email.trim()}</Text>, we've
                  sent a password reset link. It expires in 30 minutes.
                </Text>
                <TouchableOpacity
                  style={styles.backToLoginButton}
                  onPress={() => router.replace('/login')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.backToLoginText}>Back to Login</Text>
                </TouchableOpacity>
              </View>
            ) : (
              /* ── Input state ── */
              <>
                <Text style={styles.instructions}>
                  Enter the email address linked to your N3XO parent account
                  and we'll send you a reset link.
                </Text>
                <PillInput
                  placeholder="email address"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                <View style={styles.buttonContainer}>
                  <PillButton
                    title="Send Reset Link"
                    onPress={handleSubmit}
                    isLoading={loading}
                  />
                  <TouchableOpacity
                    onPress={() => router.back()}
                    style={styles.cancelButton}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.cancelText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.deepNavy,
  },
  inner: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.glassCard,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoSection: {
    alignItems: 'center',
    marginTop: 40,
  },
  logoText: {
    fontSize: 72,
    fontWeight: '800',
    letterSpacing: -2,
    color: Colors.textWhite,
    textShadowColor: Colors.electricBlue,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 28,
  },
  modePill: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
    backgroundColor: Colors.glassCard,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  modeLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  form: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
    paddingBottom: 60,
  },
  instructions: {
    color: Colors.textSecondary,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
    maxWidth: 300,
  },
  buttonContainer: {
    width: '60%',
    alignItems: 'center',
    marginTop: 8,
  },
  cancelButton: {
    marginTop: 20,
    padding: 10,
  },
  cancelText: {
    color: Colors.textSecondary,
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  // Success state
  successCard: {
    alignItems: 'center',
    backgroundColor: Colors.glassCard,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    borderRadius: 20,
    padding: 36,
    maxWidth: 340,
    gap: 16,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textWhite,
    textAlign: 'center',
  },
  successBody: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  successEmail: {
    color: Colors.electricBlue,
    fontWeight: '600',
  },
  backToLoginButton: {
    marginTop: 8,
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 30,
    backgroundColor: Colors.electricBlue,
  },
  backToLoginText: {
    color: Colors.textWhite,
    fontWeight: '700',
    fontSize: 15,
  },
});
