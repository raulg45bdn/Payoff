import { View, Text, StyleSheet } from 'react-native';
import { Colors, Typography } from '../theme';

export default function AlertBanner({ cards }) {
  // Use cached urgency from AppContext-computed derived fields
  const urgentCards = cards.filter(c => c.balance > 0 && c.urgency === 'urgent');

  if (urgentCards.length === 0) return null;

  const names = urgentCards.map(c => c.name).join(', ');
  const plural = urgentCards.length > 1;

  return (
    <View style={styles.banner}>
      <Text style={styles.icon}>⚠️</Text>
      <Text style={styles.text} numberOfLines={2}>
        {plural
          ? `${urgentCards.length} cards expire within 5 months: ${names}`
          : `${names} expires within 5 months`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,69,58,0.15)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    gap: 10,
  },
  icon: {
    fontSize: 16,
  },
  text: {
    ...Typography.caption,
    color: Colors.urgentRed,
    flex: 1,
    lineHeight: 18,
  },
});
