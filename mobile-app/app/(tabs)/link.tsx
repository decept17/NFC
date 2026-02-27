import React, { useState } from 'react';
import { View, Text, StyleSheet, Dimensions, FlatList, TouchableOpacity, Alert} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/Colours';
import { PillButton } from '@/components/PillButton';
import { useFamily } from '@/context/FamilyContext';

const { width } = Dimensions.get('window');

export default function LinkScreen() {
  const router = useRouter();
  
  // 2. GRAB THE SELECTED CHILD
  const { selectedAccount } = useFamily();
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isConnecting, setIsConnecting] = useState(false);

  // 3. DYNAMIC INSTRUCTIONS
  const INSTRUCTIONS = [
    { 
      id: '1', 
      text: `To link ${selectedAccount?.name}'s NFC band, follow this guide and once ready, select connect.` 
    },
    { 
      id: '2', 
      text: 'Ensure your phone case is not too thick, as it may block the NFC signal.' 
    },
    { 
      id: '3', 
      text: 'Locate the NFC reader on your phone (usually near the top camera module).' 
    },
  ];

  const backgroundColor = isConnecting ? Colors.backgroundPeach : Colors.backgroundBlue;

  const handleScroll = (event: any) => {
    const slideSize = event.nativeEvent.layoutMeasurement.width;
    const index = event.nativeEvent.contentOffset.x / slideSize;
    const roundIndex = Math.round(index);
    if (roundIndex !== currentIndex) {
      setCurrentIndex(roundIndex);
    }
  };

  const handleStartConnection = () => {
    setIsConnecting(true);
    
    // Simulate NFC Read
    setTimeout(() => {
      setIsConnecting(false);
      
      // 4. THIS IS WHERE YOU WILL CALL YOUR API LATER:
      // axios.post(`/api/accounts/${selectedAccount?.id}/link-nfc`, { nfc_uid: "SCANNED_TAG_123" })
      
      Alert.alert(
        "Success!", 
        `${selectedAccount?.name}'s NFC Band linked successfully.`,
        [{ text: "OK", onPress: () => router.push('/(tabs)/home') }]
      );
    }, 3000);
  };

  const renderInstructionCard = ({ item }: { item: typeof INSTRUCTIONS[0] }) => (
    <View style={styles.cardContainer}>
      <View style={styles.card}>
        <Text style={styles.cardText}>{item.text}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor }]}>
      
      <View style={styles.header}>
            <TouchableOpacity>
              <Ionicons name="person-outline" size={28} color={Colors.buttonDark} />
            </TouchableOpacity>
              
            <Text style={styles.headerLogo}>N3XO</Text>
              
            <TouchableOpacity onPress={() => router.push('/settings')}>
              <Ionicons name="ellipsis-vertical" size={28} color={Colors.buttonDark} />
            </TouchableOpacity>
        </View>

      {!isConnecting ? (
        <View style={styles.contentWrapper}>
          <View style={styles.carouselSection}>
            <FlatList
              data={INSTRUCTIONS}
              renderItem={renderInstructionCard}
              keyExtractor={(item) => item.id}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={handleScroll}
              bounces={false}
            />
            
            <View style={styles.pagination}>
              {INSTRUCTIONS.map((_, index) => (
                <View 
                  key={index} 
                  style={[
                    styles.dot, 
                    { backgroundColor: index === currentIndex ? Colors.textWhite : 'rgba(255,255,255,0.4)' }
                  ]} 
                />
              ))}
            </View>
          </View>

          <View style={styles.buttonContainer}>
            {/* DYNAMIC BUTTON TEXT */}
            <PillButton 
              title={`Connect ${selectedAccount?.name}`} 
              onPress={handleStartConnection} 
              style={styles.translucentButton}
            />
          </View>
        </View>

      ) : (

        <View style={styles.contentWrapper}>
          <View style={styles.carouselSection}>
            <View style={styles.cardContainer}>
              <View style={styles.card}>
                <Text style={styles.cardText}>Hold {selectedAccount?.name}'s NFC Band close to back of phone</Text>
              </View>
            </View>
          </View>

          <View style={styles.buttonContainer}>
            <PillButton 
              title="Scanning ..." 
              onPress={() => {}} 
              isLoading={true} 
              style={styles.translucentButtonPeach}
            />
          </View>
        </View>

      )}

    </SafeAreaView>
  );
}

// --- 4. STYLES ---
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    paddingBottom: 100, // CRITICAL: Avoids the custom floating TabBar
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
  
  contentWrapper: {
    flex: 1,
    justifyContent: 'space-between',
  },

  // Carousel Styles
  carouselSection: {
    marginTop: 40,
    height: 300,
  },
  cardContainer: {
    width: width,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: '#F0F8FF', // Very light blue/white
    width: '80%',
    paddingVertical: 50,
    paddingHorizontal: 30,
    borderRadius: 24,
    minHeight: 220, // Keeps the card size consistent
    justifyContent: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  cardText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    textAlign: 'left',
    lineHeight: 28,
  },
  
  // Pagination Styles
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 30,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginHorizontal: 6,
  },

  // Button Area
  buttonContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  translucentButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)', // Matches the light faded look in your drawing
    elevation: 0, // Remove shadow so it looks flat/translucent
  },
  translucentButtonPeach: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    elevation: 0,
  }
});