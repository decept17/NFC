// mobile-app/app/register.tsx
import React, { useState } from "react";
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard, TouchableOpacity, Alert } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Colors } from "@/constants/Colours";
import { PillButton } from "@/components/PillButton";
import { PillInput } from "@/components/PillInput";
import { Socials } from "@/components/Socials";

import { useAuth } from "@/context/AuthContext";
import { fetchApi } from "@/services/api";

export default function RegisterScreen() {
  const router = useRouter();
  const { register, socialLogin } = useAuth();
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const handleRegister = async () => {
    if (!email || !password) {
      alert("Please enter both email and password.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetchApi('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Registration failed");
      }

      const data = await response.json();
      await register(data.access_token, { id: "unknown", role: "parent" });
      router.replace('/(tabs)/home');
    } catch (error: any) {
      alert(error.message || "An error occurred during registration.");
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = async (provider: string) => {
    await socialLogin(provider, "placeholder-token");
    alert(`${provider} login flow will be implemented here once OAuth Client IDs are configured!`);
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
              <Text style={styles.modeLabel}>Create an account</Text>
            </View>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <PillInput
              placeholder="email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
            />
            <PillInput
              placeholder="password"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
            <View style={styles.buttonContainer}>
              <PillButton title="Register" onPress={handleRegister} isLoading={loading} />

              {/* Divider */}
              <View style={styles.dividerContainer}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>OR</Text>
                <View style={styles.dividerLine} />
              </View>

              {/* Social buttons */}
              <Socials title="Google" iconName="google" colour="#DB4437" onPress={() => console.log('Google')} />
              <Socials title="Apple" iconName="apple" colour="#FFFFFF" onPress={() => console.log('Apple')} />
              <Socials title="Facebook" iconName="facebook" colour="#4267B2" onPress={() => console.log('Facebook')} />

              <TouchableOpacity
                onPress={() => router.push('/login')}
                style={styles.switchTextContainer}
              >
                <Text style={styles.switchText}>Already have an account?</Text>
              </TouchableOpacity>
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
    marginBottom: 80,
  },
  buttonContainer: {
    marginBottom: 20,
    width: '50%',
    alignItems: 'center',
  },
  switchTextContainer: {
    marginTop: 28,
    padding: 10,
  },
  switchText: {
    color: Colors.textSecondary,
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '130%',
    marginVertical: 15,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.glassDivider,
  },
  dividerText: {
    color: Colors.textSecondary,
    marginHorizontal: 10,
    fontWeight: '600',
    fontSize: 12,
    letterSpacing: 1.5,
  },
});