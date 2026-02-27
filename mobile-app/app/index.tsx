import { Text, View, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Colors } from "@/constants/Colours";
import { PillButton } from "@/components/PillButton";
import { SafeAreaView } from "react-native-safe-area-context";

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    // SafeAreaView ensures content isnt hidden behind the notch
    <SafeAreaView style={styles.container}>
      {/* The Logo section */}
     <View style={styles.logoContainer}>
      <Text style={styles.logoText}>N3XO</Text>
      </View> 

      {/* The Buttons Section*/}
      <View style={styles.buttonContainer}>
        <PillButton title="Login" onPress={() => router.push('/login')}/>
        <PillButton title="Register" onPress={() => router.push('/register')}/>
      </View>
    </SafeAreaView>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundBlue,
    justifyContent: 'space-between', // Pushes logo up and buttons down
    paddingVertical: 50,
  },
  logoContainer: {
    marginTop: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoText: {
    fontSize: 90,
    color: Colors.textOrange,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 5, height: 5 },
    textShadowRadius: 10,
  },
  buttonContainer: {
    alignItems: 'center',
    marginBottom: 50,
  }
});