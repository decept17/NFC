import React, { JSX, useEffect } from 'react';
import { Pressable, StyleSheet, PressableProps } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

// Define the props 
interface TabBarButtonProps extends PressableProps {
  isFocused: boolean;
  label: string;
  routeName: string;
  color: string;
}

// Map routes to their respective icons
const icons: Record<string, (props: any) => JSX.Element> = {
  home: (props: any) => <Ionicons name="home" size={24} {...props} />,
  topup: (props: any) => <Ionicons name="add-circle" size={24} {...props} />,
  link: (props: any) => <Ionicons name="hardware-chip-outline" size={24} {...props} />,
  history: (props: any) => <Ionicons name="time" size={24} {...props} />,
  'child-home': (props: any) => <Ionicons name="home" size={24} {...props} />,
  'child-history': (props: any) => <Ionicons name="time" size={24} {...props} />,
};

export const TabBarButton = (props: TabBarButtonProps) => {
  const { isFocused, label, routeName, color, ...rest } = props;

  // The shared value drives the animation (0 = inactive, 1 = active)
  const scale = useSharedValue(0);

  useEffect(() => {
    scale.value = withSpring(isFocused ? 1 : 0, { duration: 350 });
  }, [scale, isFocused]);

  // Animate the Icon (Scales up and pushes down)
  const animatedIconStyle = useAnimatedStyle(() => {
    const scaleValue = interpolate(scale.value, [0, 1], [1, 1.4]);
    const top = interpolate(scale.value, [0, 1], [0, 8]);

    return {
      transform: [{ scale: scaleValue }],
      top,
    };
  });

  // Animate the Text (Fades out when active)
  const animatedTextStyle = useAnimatedStyle(() => {
    const opacity = interpolate(scale.value, [0, 1], [1, 0]);

    return {
      opacity,
    };
  });

  return (
    <Pressable {...rest} style={styles.container}>
      <Animated.View style={[animatedIconStyle]}>
        {icons[routeName] && icons[routeName]({ color })}
      </Animated.View>

      <Animated.Text
        style={[
          { color, fontSize: 11, fontWeight: isFocused ? '600' : '400' },
          animatedTextStyle,
        ]}
      >
        {label}
      </Animated.Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
});