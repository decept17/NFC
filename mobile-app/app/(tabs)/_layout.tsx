import { Tabs } from 'expo-router';
import { TabBar } from '@/components/TabBar';

export default function TabLayout() {
  return (
    <Tabs
      // Override the default tab bar with our custom one
      tabBar={(props) => <TabBar {...(props as any)} />} 
      screenOptions={{
        headerShown: false, 
      }}>
      
      <Tabs.Screen name="home" 
        options={{ 
          title:'Home', 
          }} 
        />
        <Tabs.Screen
        name="topup"
        options={{
          title: 'Top Up',
        }}
        />
      <Tabs.Screen
        name="link"
        options={{
          title: 'Link Tag',
        }}
        />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
        }}
        />
    </Tabs>
  );
}