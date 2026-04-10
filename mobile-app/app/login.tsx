// mobile-app/app/login.tsx
import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard, TouchableOpacity, Alert } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Colors } from "@/constants/Colours";
import { PillButton } from "@/components/PillButton";
import { PillInput } from "@/components/PillInput";
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from "@/context/AuthContext";
import { fetchApi } from "@/services/api";

export default function LoginScreen() {
  const router = useRouter();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const isChildMode = mode === 'child';

  const { login, biometricsAvailable, biometricsEnabled, authenticateWithBiometrics } = useAuth();
  const [identifier, setIdentifier] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (biometricsEnabled && biometricsAvailable) {
      handleBiometricLogin();
    }
  }, [biometricsEnabled, biometricsAvailable]);

  const handleBiometricLogin = async () => {
    setLoading(true);
    try {
      const success = await authenticateWithBiometrics();
      if (success) {
        const userData = await import('expo-secure-store').then(s => s.getItemAsync('userData'));
        const role = userData ? JSON.parse(userData).role : 'parent';
        if (role === 'child') {
          router.replace('/(child-tabs)/child-home' as any);
        } else {
          router.replace('/(tabs)/home');
        }
      }
    } catch (e) {
      // Silently fail — user can use password
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!identifier || !password) {
      alert(`Please enter both ${isChildMode ? 'username' : 'email'} and password.`);
      return;
    }

    setLoading(true);
    try {
      const body = new URLSearchParams();
      body.append('username', identifier);
      body.append('password', password);

      const response = await fetchApi('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });

      if (!response.ok) {
        if (response.status === 404) {
          Alert.alert(
            "Account Not Found",
            isChildMode
              ? "We couldn't find an account with that username. Ask your parent to create your account."
              : "We couldn't find an account with that email. Would you like to register?",
            isChildMode
              ? [{ text: "OK" }]
              : [
                  { text: "Cancel", style: "cancel" },
                  { text: "Register", onPress: () => router.push('/register') },
                ]
          );
          setLoading(false);
          return;
        }
        const errorData = await response.json();
        throw new Error(errorData.detail || "Login failed");
      }

      const data = await response.json();
      const role = data.role || (isChildMode ? 'child' : 'parent');

      await login(data.access_token, { id: data.user_id || "unknown", role });

      if (role === 'child') {
        router.replace('/(child-tabs)/child-home' as any);
      } else {
        router.replace('/(tabs)/home');
      }
    } catch (error: any) {
      alert(error.message || "An error occurred during login.");
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
              <Text style={styles.modeLabel}>
                {isChildMode ? '👦  Child Login' : '👨‍👩‍👧  Parent Login'}
              </Text>
            </View>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <PillInput
              placeholder={isChildMode ? 'username' : 'email'}
              value={identifier}
              onChangeText={(text) => setIdentifier(text.trimEnd())}
              keyboardType={isChildMode ? 'default' : 'email-address'}
            />
            <PillInput
              placeholder="password"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />

            <View style={styles.buttonContainer}>
              <PillButton title="Login" onPress={handleLogin} isLoading={loading} />

              {biometricsAvailable && biometricsEnabled && (
                <TouchableOpacity
                  style={styles.biometricButton}
                  onPress={handleBiometricLogin}
                  activeOpacity={0.7}
                >
                  <Ionicons name="finger-print" size={26} color={Colors.electricBlue} />
                  <Text style={styles.biometricText}>Use Biometrics</Text>
                </TouchableOpacity>
              )}

              {!isChildMode && (
                <TouchableOpacity
                  onPress={() => router.push('/forgot-password' as any)}
                  style={styles.forgotPasswordContainer}
                >
                  <Text style={styles.forgotPasswordText}>Forgot password?</Text>
                </TouchableOpacity>
              )}

              {!isChildMode && (
                <TouchableOpacity
                  onPress={() => router.push('/register')}
                  style={styles.switchTextContainer}
                >
                  <Text style={styles.switchText}>Need to register?</Text>
                </TouchableOpacity>
              )}
            </View>
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
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  logoSection: {
    alignItems: 'center',
    marginTop: 70,
  },
  logoText: {
    fontSize: 86,
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
    width: '100%',
    alignItems: 'center',
    marginTop: 'auto',
    marginBottom: 90,
  },
  buttonContainer: {
    marginBottom: 20,
    width: '50%',
    alignItems: 'center',
  },
  biometricButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 10,
    paddingVertical: 13,
    paddingHorizontal: 24,
    borderRadius: 30,
    backgroundColor: Colors.glassCard,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  biometricText: {
    color: Colors.electricBlue,
    fontSize: 15,
    fontWeight: '600',
  },
  switchTextContainer: {
    marginTop: 12,
    padding: 10,
  },
  switchText: {
    color: Colors.textSecondary,
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  forgotPasswordContainer: {
    marginTop: 20,
    padding: 10,
  },
  forgotPasswordText: {
    color: Colors.electricBlue,
    fontSize: 14,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
});