// mobile-app/app/(child-tabs)/_layout.tsx
import { Tabs } from 'expo-router';
import { ChildTabBar } from '@/components/ChildTabBar';

export default function ChildTabLayout() {
  return (
    <Tabs
      tabBar={(props) => <ChildTabBar {...(props as any)} />}
      screenOptions={{
        headerShown: false,
      }}>
      <Tabs.Screen name="child-home" options={{ title: 'Home' }} />
      <Tabs.Screen name="child-history" options={{ title: 'History' }} />
    </Tabs>
  );
}
