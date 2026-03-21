import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/Colours';
import { useFamily } from '@/context/FamilyContext';

// Helper component for individual rows
const SettingsRow = ({ title, isLast = false, onPress }: { title: string, isLast?: boolean, onPress: () => void }) => (
  <TouchableOpacity style={styles.rowItem} onPress={onPress}>
    <Text style={styles.rowText}>{title}</Text>
    {!isLast && <View style={styles.divider} />}
  </TouchableOpacity>
);


export default function SettingsScreen() {
  const router = useRouter();
  const { selectedAccount } = useFamily();

  return (
    <SafeAreaView style={styles.safeArea}>
      
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={32} color="#000" />
        </TouchableOpacity>
        
        <Text style={styles.headerLogo}>N3XO</Text>
        
        <TouchableOpacity>
          <Ionicons name="person-outline" size={28} color="#000" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* TITLE */}
        <Text style={styles.pageTitle}>Settings</Text>

        {/* GROUP 1: Account Controls */}
        <View style={styles.cardGroup}>
          <SettingsRow 
            title="Blocked categories" 
            onPress={() => console.log('Blocked categories pressed')} 
          />
          <SettingsRow 
            title="Limits" 
            onPress={() => console.log('Limits pressed')} 
          />
          <SettingsRow 
            title="Recurring payments" 
            isLast={true} 
            onPress={() => console.log('Recurring pressed')} 
          />
        </View>

        {/* GROUP 2: App Preferences */}
        <View style={styles.cardGroup}>
          <SettingsRow 
            title="Notifications" 
            onPress={() => console.log('Notifications pressed')} 
          />
          <SettingsRow 
            title="Leave a review" 
            isLast={true} 
            onPress={() => console.log('Review pressed')} 
          />
        </View>

        {/* GROUP 3: Support */}
        <View style={styles.cardGroup}>
          <SettingsRow 
            title="Contact us" 
            isLast={true} 
            onPress={() => console.log('Contact pressed')} 
          />
        </View>



      </ScrollView>


    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.backgroundBlue,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
  },
  headerLogo: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.textOrange,
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  scrollContent: {
    paddingHorizontal: 25,
    paddingBottom: 40,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 20,
  },
  
  // Settings Card Styles
  cardGroup: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)', // Semi-transparent overlay to match your drawing
    borderRadius: 20,
    marginBottom: 25,
    paddingVertical: 5,
    paddingHorizontal: 20,
  },
  rowItem: {
    paddingVertical: 15,
  },
  rowText: {
    fontSize: 18,
    color: '#000',
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: '#000',
    marginTop: 15,
  },
});