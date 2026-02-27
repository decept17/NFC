// mobile-app/components/PillInput.tsx
import React from 'react';
import { TextInput, View, StyleSheet, KeyboardTypeOptions } from 'react-native';
import { Colors } from '@/constants/Colours';

type PillInputProps = {
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  secureTextEntry?: boolean; // Optional, defaults to false
  keyboardType?: KeyboardTypeOptions; // e.g., 'email-address', 'numeric'
}

export const PillInput = ({ 
  placeholder, 
  value, 
  onChangeText, 
  secureTextEntry = false,
  keyboardType = 'default' 
}: PillInputProps) => {
  return (
    <View style={styles.inputContainer}>
      <TextInput 
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor="#888"
        secureTextEntry={secureTextEntry}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        autoCapitalize="none" // Important for emails
      />
    </View>
  );
};

const styles = StyleSheet.create({
  inputContainer: {
    width: '80%',
    marginVertical: 15,
  },
  input: {
    backgroundColor: Colors.inputBackground,
    color: Colors.textWhite,
    borderRadius: 30,
    paddingVertical: 15,
    paddingHorizontal: 20,
    fontSize: 14,
  },
});