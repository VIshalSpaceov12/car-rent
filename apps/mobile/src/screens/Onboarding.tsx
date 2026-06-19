import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '@car-rental/tokens';
import { i18n } from '@/i18n';

type Props = { onStart: () => void };

export function OnboardingScreen({ onStart }: Props) {
  const theme = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.color.background }]}>
      <Text style={[styles.heading, { color: theme.color.text, fontSize: theme.typography.heading.fontSize }]}>
        {i18n.t('onboarding')}
      </Text>
      <Pressable
        onPress={onStart}
        style={[styles.button, { backgroundColor: theme.color.primary, borderRadius: theme.radius.input }]}
      >
        <Text style={{ color: theme.color.onPrimary, fontWeight: '700' }}>{i18n.t('getStarted')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  heading: { fontWeight: '700', marginBottom: 32, textAlign: 'center' },
  button: { paddingVertical: 14, paddingHorizontal: 32 },
});
