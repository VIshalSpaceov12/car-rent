import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@car-rental/tokens';
import { i18n } from '@/i18n';

export function BookingsScreen() {
  const theme = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.color.background }]}>
      <Text style={{ color: theme.color.text, fontSize: theme.typography.title.fontSize, fontWeight: '600' }}>
        {i18n.t('bookings')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
