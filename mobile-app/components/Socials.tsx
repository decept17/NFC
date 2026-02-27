import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons'; 

type SocialButtonProps = {
    title: string;
    iconName: string;
    onPress: () => void;
    colour: string;
}

export const Socials = ({ title, iconName, onPress, colour = '#000'}: SocialButtonProps) => {
    return (
        <TouchableOpacity style={styles.button} onPress={onPress} activeOpacity={0.8}>
            <View style={styles.iconContainer}>
                <FontAwesome5 name={iconName} size={20} color={colour}/>
            </View>
            <Text style={styles.buttonText}>{title}</Text>
        </TouchableOpacity>
    );
};


const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF', // White background for social buttons
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 30, // Pill shape
    width: '70%',
    alignItems: 'center',
    marginVertical: 6, // Slightly less margin to save space
    // Subtle shadow
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  iconContainer: {
    width: 30, // Fixed width so text aligns perfectly across all buttons
    alignItems: 'center',
  },
  buttonText: {
    color: '#333333',
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 10,
  },
});