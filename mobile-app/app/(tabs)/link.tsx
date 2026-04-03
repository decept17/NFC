// mobile-app/app/(tabs)/link.tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet, Dimensions, FlatList, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/Colours';
import { PillButton } from '@/components/PillButton';
import { useFamily } from '@/context/FamilyContext';
import { fetchApi } from '@/services/api';
import NfcManager, { NfcTech } from 'react-native-nfc-manager';

const { width } = Dimensions.get('window');

export default function LinkScreen() {
  const router = useRouter();
  const { selectedAccount } = useFamily();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isConnecting, setIsConnecting] = useState(false);

  const INSTRUCTIONS = [
    {
      id: '1',
      icon: 'link-outline' as const,
      title: 'Get Ready',
      text: `To link ${selectedAccount?.name}'s NFC band, follow this guide and once ready, select connect.`,
    },
    {
      id: '2',
      icon: 'phone-portrait-outline' as const,
      title: 'Remove Case',
      text: 'Ensure your phone case is not too thick, as it may block the NFC signal.',
    },
    {
      id: '3',
      icon: 'scan-outline' as const,
      title: 'Find the Reader',
      text: 'Locate the NFC reader on your phone — usually near the top camera module.',
    },
  ];

  const handleScroll = (event: any) => {
    const slideSize = event.nativeEvent.layoutMeasurement.width;
    const index = event.nativeEvent.contentOffset.x / slideSize;
    const roundIndex = Math.round(index);
    if (roundIndex !== currentIndex) setCurrentIndex(roundIndex);
  };

  const handleStartConnection = async () => {
    setIsConnecting(true);
    try {
      await NfcManager.start();
      const isSupported = await NfcManager.isSupported();
      if (!isSupported) throw new Error('NFC is not supported on this device');

      const isEnabled = await NfcManager.isEnabled();
      if (!isEnabled) throw new Error('Please enable NFC in your device settings');

      await NfcManager.requestTechnology(NfcTech.Ndef);

      const tag = await NfcManager.getTag();
      if (!tag?.ndefMessage || tag.ndefMessage.length === 0) {
        throw new Error('No NDEF message found on this tag. Is it a provisioned NTAG 424 DNA?');
      }

      const ndefRecord = tag.ndefMessage[0];
      const payloadBytes: number[] = ndefRecord.payload as number[];
      const urlString = payloadBytes.slice(1).map((b: number) => String.fromCharCode(b)).join('');

      let parsedUrl: URL;
      try {
        parsedUrl = new URL(urlString.startsWith('http') ? urlString : `https://${urlString}`);
      } catch {
        throw new Error(`Could not parse NDEF URL: "${urlString}"`);
      }

      const uid     = parsedUrl.searchParams.get('uid');
      const counter = parsedUrl.searchParams.get('c');
      const cmac    = parsedUrl.searchParams.get('m');

      if (!uid || !counter || !cmac) {
        throw new Error(`SUN URL is missing parameters. Got: uid=${uid}, c=${counter}, m=${cmac}`);
      }

      const response = await fetchApi(`/accounts/${selectedAccount?.id}/link-nfc`, {
        method: 'POST',
        body: JSON.stringify({ nfc_uid: uid }),
      });

      if (!response.ok) {
        let errorDetail = 'Linking failed on backend.';
        try {
          const errorData = await response.json();
          errorDetail = errorData.detail || errorDetail;
        } catch {
          errorDetail = `Server error (${response.status})`;
        }
        throw new Error(errorDetail);
      }

      Alert.alert(
        'Linked!',
        `${selectedAccount?.name}'s NFC Band linked successfully.`,
        [{ text: 'OK', onPress: () => router.push('/(tabs)/home') }]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Something went wrong.');
    } finally {
      NfcManager.cancelTechnologyRequest();
      setIsConnecting(false);
    }
  };

  const renderInstructionCard = ({ item }: { item: typeof INSTRUCTIONS[0] }) => (
    <View style={styles.cardContainer}>
      <View style={styles.card}>
        <View style={styles.cardIconRing}>
          <Ionicons name={item.icon} size={28} color={Colors.electricBlue} />
        </View>
        <Text style={styles.cardTitle}>{item.title}</Text>
        <Text style={styles.cardText}>{item.text}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity>
          <Ionicons name="person-outline" size={28} color={Colors.electricBlue} />
        </TouchableOpacity>
        <Text style={styles.headerLogo}>N3XO</Text>
        <TouchableOpacity onPress={() => router.push('/settings')}>
          <Ionicons name="ellipsis-vertical" size={28} color={Colors.electricBlue} />
        </TouchableOpacity>
      </View>

      {!isConnecting ? (
        <View style={styles.contentWrapper}>
          {/* Instruction carousel */}
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
                    { backgroundColor: index === currentIndex ? Colors.electricBlue : Colors.tabBarInactive }
                  ]}
                />
              ))}
            </View>
          </View>

          <View style={styles.buttonContainer}>
            <PillButton
              title={`Connect ${selectedAccount?.name}`}
              onPress={handleStartConnection}
            />
          </View>
        </View>

      ) : (

        <View style={styles.contentWrapper}>
          <View style={styles.carouselSection}>
            <View style={styles.cardContainer}>
              <View style={[styles.card, styles.cardScanning]}>
                {/* Animated ring */}
                <View style={styles.scanRingOuter}>
                  <View style={styles.scanRingInner}>
                    <Ionicons name="wifi-outline" size={36} color={Colors.electricBlue} />
                  </View>
                </View>
                <Text style={styles.cardTitle}>Scanning…</Text>
                <Text style={styles.cardText}>Hold {selectedAccount?.name}'s NFC Band close to the back of your phone</Text>
              </View>
            </View>
          </View>

          <View style={styles.buttonContainer}>
            <PillButton
              title="Scanning..."
              onPress={() => {}}
              isLoading={true}
              style={styles.translucentButton}
            />
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.deepNavy,
    paddingBottom: 100,
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
    fontWeight: '800',
    letterSpacing: -1,
    color: Colors.textWhite,
    textShadowColor: Colors.electricBlue,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 14,
  },
  contentWrapper: {
    flex: 1,
    justifyContent: 'space-between',
  },

  // Carousel
  carouselSection: {
    marginTop: 30,
    height: 320,
  },
  cardContainer: {
    width: width,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: '#131C30',   // Solid opaque — consistent with home card
    width: '80%',
    paddingVertical: 40,
    paddingHorizontal: 28,
    borderRadius: 28,
    minHeight: 240,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(77,143,255,0.20)',
    shadowColor: Colors.electricBlue,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 8,
    gap: 14,
  },
  cardScanning: {
    borderColor: 'rgba(77,143,255,0.4)',
    shadowOpacity: 0.28,
  },
  cardIconRing: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(77,143,255,0.12)',
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textWhite,
    letterSpacing: -0.3,
  },
  cardText: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },

  // Scan pulse rings
  scanRingOuter: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(77,143,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(77,143,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanRingInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(27,47,232,0.20)',
    borderWidth: 1,
    borderColor: 'rgba(77,143,255,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Pagination
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginHorizontal: 5,
  },

  // Button area
  buttonContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  translucentButton: {
    backgroundColor: Colors.glassCard,
    borderColor: Colors.glassBorder,
    borderWidth: 1,
    elevation: 0,
  },
});