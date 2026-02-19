import React from 'react';
import { TouchableOpacity, Text, TextInput, StyleSheet, View, StyleProp, ViewStyle, ActivityIndicator } from 'react-native';
import { Colors } from '@/constants/Colours';

interface PillButtonProps {
    title: string;
    style?: StyleProp<ViewStyle>;
    onPress?: () => void;
    isLoading?: boolean;
};

// The Pill Button
export const PillButton = ({ title, onPress, style, isLoading = false }: PillButtonProps) => {
  return (
    <TouchableOpacity 
      style={[styles.button, style]} 
      onPress={onPress}
      activeOpacity={0.8}
      disabled={isLoading}
    >
      {isLoading ? (
        <ActivityIndicator color={Colors.textWhite} />
      ) : (
        <Text style={styles.buttonText}>{title}</Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    backgroundColor: Colors.buttonDark,
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 30,
    width: '80%',
    alignItems: 'center',
    marginVertical: 10,
    // Add subtle shadow for depth
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  buttonText: {
    color: Colors.textWhite,
    fontSize: 16,
    fontWeight: '600',
  },
});