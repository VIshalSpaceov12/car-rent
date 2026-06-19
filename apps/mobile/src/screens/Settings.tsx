import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '@car-rental/tokens';
import { i18n, setLocale } from '@/i18n';
import { clearToken } from '@/auth/storage';

type Props = {
  onSignOut: () => void;
  onNavigateLoyalty?: () => void;
  onNavigateAddresses?: () => void;
  onNavigateSupport?: () => void;
};

export function SettingsScreen({ onSignOut, onNavigateLoyalty, onNavigateAddresses, onNavigateSupport }: Props) {
  const theme = useTheme();

  const switchToArabic = () => setLocale('ar');
  const switchToEnglish = () => setLocale('en');

  const handleSignOut = async () => {
    await clearToken();
    onSignOut();
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.color.background }]}>
      <Text style={{ color: theme.color.text, fontSize: theme.typography.title.fontSize, fontWeight: '600', marginBottom: 24 }}>
        {i18n.t('settings')}
      </Text>

      {/* Profile sections */}
      {onNavigateLoyalty && (
        <Pressable
          onPress={onNavigateLoyalty}
          style={[styles.button, { backgroundColor: theme.color.surface, borderRadius: theme.radius.input }]}
          accessibilityRole="button"
        >
          <Text style={{ color: theme.color.text }}>{i18n.t('profile.loyalty')}</Text>
        </Pressable>
      )}
      {onNavigateAddresses && (
        <Pressable
          onPress={onNavigateAddresses}
          style={[styles.button, { backgroundColor: theme.color.surface, borderRadius: theme.radius.input }]}
          accessibilityRole="button"
        >
          <Text style={{ color: theme.color.text }}>{i18n.t('profile.addresses')}</Text>
        </Pressable>
      )}
      {onNavigateSupport && (
        <Pressable
          onPress={onNavigateSupport}
          style={[styles.button, { backgroundColor: theme.color.surface, borderRadius: theme.radius.input }]}
          accessibilityRole="button"
        >
          <Text style={{ color: theme.color.text }}>{i18n.t('profile.support')}</Text>
        </Pressable>
      )}

      <Pressable
        onPress={switchToEnglish}
        style={[styles.button, { backgroundColor: theme.color.surface, borderRadius: theme.radius.input }]}
      >
        <Text style={{ color: theme.color.text }}>English</Text>
      </Pressable>
      <Pressable
        onPress={switchToArabic}
        style={[styles.button, { backgroundColor: theme.color.surface, borderRadius: theme.radius.input }]}
      >
        <Text style={{ color: theme.color.text }}>عربي</Text>
      </Pressable>
      <Pressable
        onPress={handleSignOut}
        style={[styles.button, { backgroundColor: theme.color.danger, borderRadius: theme.radius.input }]}
      >
        <Text style={{ color: theme.color.onPrimary, fontWeight: '600' }}>{i18n.t('signOut') ?? 'Sign out'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  button: { paddingVertical: 12, paddingHorizontal: 24, marginBottom: 12, width: '100%', alignItems: 'center' },
});
