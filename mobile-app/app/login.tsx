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

  // Auto-prompt biometrics on screen load if enabled
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
        // The AuthContext already restored the user — just navigate
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
      // OAuth2 expects form-encoded data
      const body = new URLSearchParams();
      body.append('username', identifier); // Backend tries email first, then username
      body.append('password', password);

      const response = await fetchApi('/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: body.toString()
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
                  { text: "Register", onPress: () => router.push('/register') }
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

      // Route based on role
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
          style={styles.inner}>
          <Text style={styles.logoText}>N3XO</Text>
          <Text style={styles.modeLabel}>
            {isChildMode ? '👦 Child Login' : '👨‍👩‍👧 Parent Login'}
          </Text>
          <View style={styles.form}>
            <PillInput
              placeholder={isChildMode ? 'username' : 'email'}
              value={identifier}
              onChangeText={setIdentifier}
              keyboardType={isChildMode ? 'default' : 'email-address'} />
            <PillInput
              placeholder="password"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
            <View style={styles.buttonContainer}>
              <PillButton
                title="Login"
                onPress={handleLogin}
                isLoading={loading} />

              {/* Biometric login button */}
              {biometricsAvailable && biometricsEnabled && (
                <TouchableOpacity
                  style={styles.biometricButton}
                  onPress={handleBiometricLogin}
                  activeOpacity={0.7}
                >
                  <Ionicons name="finger-print" size={28} color={Colors.textWhite} />
                  <Text style={styles.biometricText}>Use Biometrics</Text>
                </TouchableOpacity>
              )}

              {!isChildMode && (
                <TouchableOpacity
                  onPress={() => router.push('/register')}
                  style={styles.switchTextContainer}>
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
    backgroundColor: Colors.backgroundPeach,
  },
  inner: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  logoText: {
    marginTop: 80,
    fontSize: 90,
    fontWeight: 'medium',
    color: Colors.textOrange,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 5, height: 5 },
    textShadowRadius: 10,
  },
  modeLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textWhite,
    marginTop: 10,
    opacity: 0.85,
  },
  form: {
    width: '100%',
    alignItems: 'center',
    marginTop: 'auto',
    marginBottom: 100,
  },
  buttonContainer: {
    marginBottom: 20,
    width: '50%',
    alignItems: 'center'
  },
  biometricButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 10,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  biometricText: {
    color: Colors.textWhite,
    fontSize: 15,
    fontWeight: '600',
  },
  switchTextContainer: {
    marginTop: 30,
    padding: 10,
  },
  switchText: {
    color: Colors.textWhite,
    fontSize: 14,
    fontWeight: 'thin',
    textDecorationLine: 'underline',
  }
});