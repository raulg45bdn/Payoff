import { View, StyleSheet } from 'react-native';
import { getUrgencyColor } from '../utils/calculations';

export default function UrgencyDot({ urgency }) {
  return (
    <View style={[styles.dot, { backgroundColor: getUrgencyColor(urgency) }]} />
  );
}

const styles = StyleSheet.create({
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
