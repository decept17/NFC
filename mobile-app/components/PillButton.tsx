// mobile-app/components/PillButton.tsx
import React from 'react';
import { TouchableOpacity, Text, StyleSheet, StyleProp, ViewStyle, ActivityIndicator } from 'react-native';
import { Colors } from '@/constants/Colours';

type PillButtonProps = {
  title: string;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  isLoading?: boolean;
};

export const PillButton = ({ title, onPress, style, isLoading = false }: PillButtonProps) => {
  return (
    <TouchableOpacity
      style={[styles.button, style]}
      onPress={onPress}
      activeOpacity={0.82}
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
    backgroundColor: Colors.eclipseBlue,
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 30,
    width: '75%',
    alignItems: 'center',
    marginVertical: 15,
    // Eclipse blue glow shadow
    shadowColor: Colors.electricBlue,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 6,
    borderWidth: 1,
    borderColor: 'rgba(77,143,255,0.3)',
  },
  buttonText: {
    color: Colors.textWhite,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});