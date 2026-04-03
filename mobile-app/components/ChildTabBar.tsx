// mobile-app/components/ChildTabBar.tsx
import React, { JSX } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { TabBarButton } from './TabBarButton';
import { Colors } from '@/constants/Colours';

export const ChildTabBar = ({ state, descriptors, navigation }: BottomTabBarProps) => {
  const activeColor = Colors.tabBarActive;
  const inactiveColor = Colors.tabBarInactive;

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
          navigation.emit({ type: 'tabLongPress', target: route.key });
        };

        return (
          <TabBarButton
            key={route.name}
            onPress={onPress}
            onLongPress={onLongPress}
            isFocused={isFocused}
            routeName={route.name}
            color={isFocused ? activeColor : inactiveColor}
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
    backgroundColor: Colors.tabBarBackground,
    marginHorizontal: 20,
    paddingVertical: 15,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    shadowColor: Colors.electricBlue,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 20,
    shadowOpacity: 0.25,
    elevation: 12,
  },
});
