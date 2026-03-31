import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, Alert, KeyboardAvoidingView, Platform,
  TouchableWithoutFeedback, Keyboard, ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/Colours';
import { useFamily } from '@/context/FamilyContext';
import { fetchApi } from '@/services/api';

// Available categories that can be blocked
const ALL_CATEGORIES = [
  'Canteen', 'Vending', 'Stationery', 'Snacks',
  'Drinks', 'Sports', 'Games', 'Online',
];

export default function LimitsScreen() {
  const router = useRouter();
  const { selectedAccount } = useFamily();

  const [dailyLimit, setDailyLimit] = useState('');
  const [singleMax, setSingleMax] = useState('');
  const [blockedCategories, setBlockedCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Fetch current limits on mount
  useEffect(() => {
    const fetchLimits = async () => {
      if (!selectedAccount?.id) return;
      try {
        const response = await fetchApi(`/accounts/${selectedAccount.id}/limits`);
        if (response.ok) {
          const data = await response.json();
          setDailyLimit(data.daily_spending_limit > 0 ? data.daily_spending_limit.toString() : '');
          setSingleMax(data.single_transaction_max > 0 ? data.single_transaction_max.toString() : '');
          setBlockedCategories(data.blocked_categories || []);
        }
      } catch (e) {
        console.error('Failed to fetch limits', e);
      } finally {
        setLoading(false);
      }
    };
    fetchLimits();
  }, [selectedAccount?.id]);

  const toggleCategory = (category: string) => {
    setBlockedCategories(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const handleSave = async () => {
    if (!selectedAccount?.id) return;
    setSaving(true);

    try {
      const response = await fetchApi(`/accounts/${selectedAccount.id}/limits`, {
        method: 'PUT',
        body: JSON.stringify({
          daily_spending_limit: parseFloat(dailyLimit) || 0,
          single_transaction_max: parseFloat(singleMax) || 0,
          blocked_categories: blockedCategories,
        }),
      });

      if (response.ok) {
        Alert.alert('Saved', 'Spending limits have been updated.', [
          { text: 'OK', onPress: () => router.back() }
        ]);
      } else {
        const err = await response.json();
        Alert.alert('Error', err.detail || 'Failed to update limits');
      }
    } catch (e) {
      Alert.alert('Error', 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.buttonDark} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          {/* HEADER */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={32} color="#000" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Spending Limits</Text>
            <View style={{ width: 32 }} />
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Child name indicator */}
            <Text style={styles.childName}>{selectedAccount?.name}'s Limits</Text>

            {/* DAILY LIMIT */}
            <View style={styles.cardGroup}>
              <Text style={styles.cardLabel}>Daily Spending Limit</Text>
              <Text style={styles.cardHint}>
                Maximum total the child can spend per day. Leave blank for no limit.
              </Text>
              <View style={styles.inputRow}>
                <Text style={styles.currencySymbol}>£</Text>
                <TextInput
                  style={styles.amountInput}
                  placeholder="0.00"
                  placeholderTextColor="#999"
                  value={dailyLimit}
                  onChangeText={setDailyLimit}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>

            {/* SINGLE TRANSACTION MAX */}
            <View style={styles.cardGroup}>
              <Text style={styles.cardLabel}>Single Transaction Limit</Text>
              <Text style={styles.cardHint}>
                Maximum amount per individual transaction. Leave blank for no limit.
              </Text>
              <View style={styles.inputRow}>
                <Text style={styles.currencySymbol}>£</Text>
                <TextInput
                  style={styles.amountInput}
                  placeholder="0.00"
                  placeholderTextColor="#999"
                  value={singleMax}
                  onChangeText={setSingleMax}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>

            {/* BLOCKED CATEGORIES */}
            <View style={styles.cardGroup}>
              <Text style={styles.cardLabel}>Blocked Categories</Text>
              <Text style={styles.cardHint}>
                Tap to block a category. Blocked categories will reject transactions.
              </Text>
              <View style={styles.categoriesGrid}>
                {ALL_CATEGORIES.map(category => {
                  const isBlocked = blockedCategories.includes(category);
                  return (
                    <TouchableOpacity
                      key={category}
                      style={[
                        styles.categoryChip,
                        isBlocked && styles.categoryChipBlocked,
                      ]}
                      onPress={() => toggleCategory(category)}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={isBlocked ? 'close-circle' : 'ellipse-outline'}
                        size={16}
                        color={isBlocked ? '#fff' : '#555'}
                      />
                      <Text
                        style={[
                          styles.categoryText,
                          isBlocked && styles.categoryTextBlocked,
                        ]}
                      >
                        {category}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* SAVE BUTTON */}
            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleSave}
              activeOpacity={0.8}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color={Colors.textWhite} />
              ) : (
                <Text style={styles.saveButtonText}>Save Limits</Text>
              )}
            </TouchableOpacity>

          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.backgroundBlue,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#222',
  },
  scrollContent: {
    paddingHorizontal: 25,
    paddingBottom: 120,
  },
  childName: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(0,0,0,0.5)',
    textAlign: 'center',
    marginBottom: 20,
  },

  // Card group — matching settings.tsx style
  cardGroup: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 20,
    marginBottom: 20,
    paddingVertical: 18,
    paddingHorizontal: 20,
  },
  cardLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  cardHint: {
    fontSize: 13,
    color: '#555',
    marginBottom: 14,
    lineHeight: 18,
  },

  // Amount input
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  currencySymbol: {
    fontSize: 20,
    fontWeight: '600',
    color: '#222',
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    fontSize: 18,
    color: '#000',
    paddingVertical: 12,
  },

  // Category chips
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  categoryChipBlocked: {
    backgroundColor: '#c44',
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  categoryTextBlocked: {
    color: '#fff',
  },

  // Save button — same style as PillButton
  saveButton: {
    backgroundColor: Colors.buttonDark,
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  saveButtonText: {
    color: Colors.textWhite,
    fontSize: 16,
    fontWeight: '600',
  },
});
