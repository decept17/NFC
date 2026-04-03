// mobile-app/app/index.tsx
import { Text, View, StyleSheet, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { Colors } from "@/constants/Colours";
import { PillButton } from "@/components/PillButton";
import { SafeAreaView } from "react-native-safe-area-context";
import React, { useState } from "react";

export default function WelcomeScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<'parent' | 'child'>('parent');

  return (
    <SafeAreaView style={styles.container}>
      {/* The Logo section */}
      <View style={styles.logoContainer}>
        <Text style={styles.logoText}>N3XO</Text>
        <Text style={styles.logoTagline}>Smart payments for families</Text>
      </View>

      {/* The Buttons Section */}
      <View style={styles.buttonContainer}>
        <PillButton
          title="Login"
          onPress={() => router.push({ pathname: '/login', params: { mode } })}
        />
        {mode === 'parent' && (
          <PillButton title="Register" onPress={() => router.push('/register')} />
        )}

        {/* Toggle: Parent / Child */}
        <View style={[styles.toggleContainer, { marginTop: 40 }]}>
          <TouchableOpacity
            style={[styles.toggleOption, mode === 'parent' && styles.toggleActive]}
            onPress={() => setMode('parent')}
            activeOpacity={0.8}
          >
            <Text style={[styles.toggleText, mode === 'parent' && styles.toggleTextActive]}>
              Parent
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleOption, mode === 'child' && styles.toggleActive]}
            onPress={() => setMode('child')}
            activeOpacity={0.8}
          >
            <Text style={[styles.toggleText, mode === 'child' && styles.toggleTextActive]}>
              Child
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.deepNavy,
    justifyContent: 'space-between',
    paddingVertical: 50,
  },
  logoContainer: {
    marginTop: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoText: {
    fontSize: 90,
    color: Colors.textWhite,
    fontWeight: '800',
    letterSpacing: -2,
    // Electric blue glow
    textShadowColor: Colors.electricBlue,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 30,
  },
  logoTagline: {
    fontSize: 14,
    color: Colors.textSecondary,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginTop: 8,
  },
  // Toggle
  toggleContainer: {
    flexDirection: 'row',
    alignSelf: 'center',
    backgroundColor: Colors.glassCard,
    borderRadius: 30,
    padding: 4,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  toggleOption: {
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 26,
  },
  toggleActive: {
    backgroundColor: Colors.eclipseBlue,
    shadowColor: Colors.electricBlue,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  toggleText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.tabBarInactive,
  },
  toggleTextActive: {
    color: Colors.textWhite,
  },
  buttonContainer: {
    alignItems: 'center',
    marginBottom: 50,
  },
});