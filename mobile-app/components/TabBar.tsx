import React, { JSX } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colours';
import { TabBarButton } from './TabBarButton';

export const TabBar = ({ state, descriptors, navigation }: BottomTabBarProps) => {
  // Use your app's theme colors
  const primaryColor = 'grey'; // active colour
  const greyColor = '#00b7cf'; // inactive colour

  // Map your route names to specific Ionicons
  const icons: Record<string, (props: any) => JSX.Element> = {
    home: (props: any) => <Ionicons name="home" size={24} {...props} />,
    topup: (props: any) => <Ionicons name="add-circle" size={24} {...props} />,
    link: (props: any) => <Ionicons name="hardware-chip-outline" size={24} {...props} />,
    history: (props: any) => <Ionicons name="time" size={24} {...props} />,
  };

    return (
    <View style={styles.tabbar}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const label =
          options.tabBarLabel !== undefined
            ? options.tabBarLabel
            : options.title !== undefined
            ? options.title
            : route.name;

        if (['_sitemap', '+not-found'].includes(route.name)) return null;

        const isFocused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name, route.params);
          }
        };

        const onLongPress = () => {
          navigation.emit({
            type: 'tabLongPress',
            target: route.key,
          });
        };

        return (
          <TabBarButton
            key={route.name}
            onPress={onPress}
            onLongPress={onLongPress}
            isFocused={isFocused}
            routeName={route.name}
            color={isFocused ? primaryColor : greyColor}
            label={typeof label === 'string' ? label : route.name}
          />
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
    tabbar: {
        position: 'absolute', 
        bottom: 25,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#ffffff', // Dark background to fit your design
        marginHorizontal: 20,
        paddingVertical: 15,
        borderRadius: 25,
        // iOS Shadow
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 5 },
        shadowRadius: 10,
        shadowOpacity: 0.2,
        // Android Shadow
        elevation: 5, 
    },
});