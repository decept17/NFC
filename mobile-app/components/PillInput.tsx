// mobile-app/components/PillInput.tsx
import React, { useState } from 'react';
import { TextInput, View, StyleSheet, KeyboardTypeOptions } from 'react-native';
import { Colors } from '@/constants/Colours';

type PillInputProps = {
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: KeyboardTypeOptions;
};

export const PillInput = ({
  placeholder,
  value,
  onChangeText,
  secureTextEntry = false,
  keyboardType = 'default',
}: PillInputProps) => {
  const [focused, setFocused] = useState(false);

  return (
    <View style={[styles.inputContainer, focused && styles.inputContainerFocused]}>
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={Colors.textMuted}
        secureTextEntry={secureTextEntry}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        autoCapitalize="none"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  inputContainer: {
    width: '80%',
    marginVertical: 10,
    borderRadius: 30,
    borderWidth: 1.5,
    borderColor: Colors.glassBorder,
    backgroundColor: Colors.inputBackground,
    // Subtle glow when unfocused
    shadowColor: Colors.electricBlue,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  inputContainerFocused: {
    borderColor: Colors.electricBlue,
    shadowOpacity: 0.30,
    shadowRadius: 10,
  },
  input: {
    color: Colors.textWhite,
    borderRadius: 30,
    paddingVertical: 16,
    paddingHorizontal: 22,
    fontSize: 14,
    fontWeight: '500',
  },
});