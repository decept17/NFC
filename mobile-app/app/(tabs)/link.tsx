import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '@/constants/Colours';

export default function Link() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Link Screen Coming Soon</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.backgroundBlue },
  text: { fontSize: 20, fontWeight: 'bold' }
});