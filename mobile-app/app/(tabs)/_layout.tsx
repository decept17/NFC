import { Tabs } from 'expo-router';
import { Colors } from '@/constants/Colours';
import { Ionicons } from '@expo/vector-icons'; // Expo includes this by default

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: {
          backgroundColor: Colors.header.background,
        },
        headerTintColor: Colors.header.tint,
        tabBarStyle: {
          backgroundColor: '#1E1E1E', // Dark background for the tab bar
          borderTopWidth: 0,
        },
        tabBarActiveTintColor: Colors.textOrange, // N3XO orange for active tab
        tabBarInactiveTintColor: '#888888',
      }}>
      
      <Tabs.Screen name="home" 
        options={{ 
          title:'Home', 
          tabBarIcon: ({color, focused }) => (
            <Ionicons name={focused ? 'home-sharp' : 'home-outline'} color={color} size={24} />
          )
          }} />
      
      {/* You can add more tabs here later, like profile or settings */}
    </Tabs>
  );
}