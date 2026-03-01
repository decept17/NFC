import { Stack } from "expo-router";
import { Colors } from "@/constants/Colours";
import { StatusBar } from "expo-status-bar";
import { StripeProvider } from "@stripe/stripe-react-native"
import { FamilyProvider } from "@/context/FamilyContext";
import { AuthProvider } from "@/context/AuthContext";

export default function RootLayout() {
  return (
    < StripeProvider
      publishableKey="pk_test_YOUR_SANDBOX_PUBLIC" // to be replaced with actual stripe publishable key later 
    >
      <AuthProvider>
        <FamilyProvider>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              // Set the default background color for headers
              headerStyle: {
                backgroundColor: Colors.header.background,
              },
              // Set the color of the back button and title
              headerTintColor: Colors.header.tint,
              // Optional: Remove the thin line/shadow under the header for a clean look
              headerShadowVisible: false,
              // Center the title (standard on iOS, optional on Android)
              headerTitleAlign: 'center',
              // Hide the header by default (we enable it per screen if needed)
              headerShown: false,
            }}
          >
            <Stack.Screen name="index" />
            <Stack.Screen name="login" />
            <Stack.Screen name="register" />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          </Stack>
        </FamilyProvider>
      </AuthProvider>
    </StripeProvider>
  );
}