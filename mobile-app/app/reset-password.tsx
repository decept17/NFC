// mobile-app/app/reset-password.tsx
//
// Reached via deep link: n3xo://reset-password?token=<raw_token>
// expo-router automatically parses the query-string into useLocalSearchParams.
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
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { Colors } from '@/constants/Colours';
import { PillButton } from '@/components/PillButton';
import { PillInput } from '@/components/PillInput';
import { confirmPasswordReset } from '@/services/api';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token?: string }>();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleReset = async () => {
    if (!token) {
      Alert.alert(
        'Invalid Link',
        'This reset link appears to be broken. Please request a new one.',
        [{ text: 'OK', onPress: () => router.replace('/forgot-password') }],
      );
      return;
    }

    if (newPassword.length < 6) {
      alert('Password must be at least 6 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      alert('Passwords do not match. Please try again.');
      return;
    }

    setLoading(true);
    try {
      await confirmPasswordReset(token, newPassword);
      setSuccess(true);
    } catch (error: any) {
      Alert.alert(
        'Reset Failed',
        error.message || 'This reset link is invalid or has expired. Please request a new one.',
        [
          { text: 'Request New Link', onPress: () => router.replace('/forgot-password') },
          { text: 'Cancel', style: 'cancel' },
        ],
      );
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
          {/* Logo */}
          <View style={styles.logoSection}>
            <Text style={styles.logoText}>N3XO</Text>
            <View style={styles.modePill}>
              <Text style={styles.modeLabel}>🔒  New Password</Text>
            </View>
          </View>

          {/* Content */}
          <View style={styles.form}>
            {success ? (
              /* ── Success state ── */
              <View style={styles.successCard}>
                <Ionicons name="checkmark-circle-outline" size={52} color="#34C759" />
                <Text style={styles.successTitle}>Password Updated!</Text>
                <Text style={styles.successBody}>
                  Your password has been changed successfully.{'\n'}
                  You can now log in with your new password.
                </Text>
                <TouchableOpacity
                  style={styles.loginButton}
                  onPress={() => router.replace('/login')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.loginButtonText}>Go to Login</Text>
                </TouchableOpacity>
              </View>
            ) : (
              /* ── Password entry ── */
              <>
                <Text style={styles.instructions}>
                  Choose a new password for your N3XO account.
                  It must be at least 6 characters long.
                </Text>

                <PillInput
                  placeholder="new password"
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry
                />
                <PillInput
                  placeholder="confirm new password"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                />

                <View style={styles.buttonContainer}>
                  <PillButton
                    title="Set New Password"
                    onPress={handleReset}
                    isLoading={loading}
                  />
                  <TouchableOpacity
                    onPress={() => router.replace('/login')}
                    style={styles.cancelButton}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.cancelText}>Back to Login</Text>
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
  logoSection: {
    alignItems: 'center',
    marginTop: 70,
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
  loginButton: {
    marginTop: 8,
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 30,
    backgroundColor: Colors.electricBlue,
  },
  loginButtonText: {
    color: Colors.textWhite,
    fontWeight: '700',
    fontSize: 15,
  },
});
