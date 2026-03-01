import React, { useState } from "react";
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard, TouchableOpacity, Alert } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Colors } from "@/constants/Colours";
import { PillButton } from "@/components/PillButton";
import { PillInput } from "@/components/PillInput";

import { useAuth } from "@/context/AuthContext";
import { fetchApi } from "@/services/api";

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const handleLogin = async () => {
    if (!email || !password) {
      alert("Please enter both email and password.");
      return;
    }

    setLoading(true);
    try {
      // OAuth2 expects form-encoded data
      const body = new URLSearchParams();
      body.append('username', email);
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
            "We couldn't find an account with that email. Would you like to register?",
            [
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

      // Assuming backend doesn't return full user details yet, we mock the role here 
      // but we store the real token
      await login(data.access_token, { id: "unknown", role: "parent" });

      router.replace('/(tabs)/home');
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
          <View style={styles.form}>
            <PillInput
              placeholder="email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address" />
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
              <TouchableOpacity
                onPress={() => router.push('/register')}
                style={styles.switchTextContainer}>
                <Text style={styles.switchText}>Need to register?</Text>
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
    backgroundColor: Colors.backgroundPeach,
  },
  inner: {
    flex: 1,
    justifyContent: 'flex-start', // ALIGNMENT CHANGE
    alignItems: 'center',
  },
  logoText: {
    marginTop: 80, // ALIGNMENT CHANGE
    fontSize: 90,
    fontWeight: 'medium',
    color: Colors.textOrange,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 5, height: 5 },
    textShadowRadius: 10,
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
  switchTextContainer: {
    marginTop: 30, // Adds space between the PillButton and the text
    padding: 10,   // Makes the clickable area slightly larger for fat fingers
  },
  switchText: {
    color: Colors.textWhite, // Uses your white constant
    fontSize: 14,
    fontWeight: 'thin',
    textDecorationLine: 'underline',
  }
});