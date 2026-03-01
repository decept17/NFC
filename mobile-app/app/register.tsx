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
        body: JSON.stringify({ email, password })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Registration failed");
      }

      const data = await response.json();

      // Assume the user is a parent initially
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
                title="Register"
                onPress={handleRegister}
                isLoading={loading} />

              {/* Divders*/}
              <View style={styles.dividerContainer}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}> OR </Text>
                <View style={styles.dividerLine} />
              </View>

              {/* social buttons */}
              <Socials
                title="Google"
                iconName="google"
                colour="#DB4437"
                onPress={() => console.log('Google')} />
              <Socials
                title="Apple"
                iconName="apple"
                colour="#000000"
                onPress={() => console.log('Apple')} />
              <Socials
                title="Facebook"
                iconName="facebook"
                colour="#4267B2"
                onPress={() => console.log('Facebook')} />
              <TouchableOpacity
                onPress={() => router.push('/login')}
                style={styles.switchTextContainer}>
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
    backgroundColor: 'rgba(255, 255, 255, 0.4)', // Faint white line
  },
  dividerText: {
    color: '#ffffff',
    marginHorizontal: 10,
    fontWeight: '600',
  },
});