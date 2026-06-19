import { useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@car-rental/tokens';
import { login } from '@/api/client';
import { saveToken } from '@/auth/storage';
import { i18n } from '@/i18n';

export function LoginScreen({ onSuccess }: { onSuccess: () => void }) {
  const theme = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState(false);

  const submit = async () => {
    const res = await login(email, password);
    if (!res) return setErr(true);
    await saveToken(res.token);
    onSuccess();
  };

  return (
    <View
      style={{
        flex: 1,
        justifyContent: 'center',
        padding: theme.spacing.lg,
        backgroundColor: theme.color.background,
      }}
    >
      <Text
        style={{
          fontSize: theme.typography.heading.fontSize,
          fontWeight: String(theme.typography.heading.fontWeight) as '700',
          lineHeight: theme.typography.heading.lineHeight,
          color: theme.color.text,
          marginBottom: theme.spacing.md,
        }}
      >
        {i18n.t('signIn')}
      </Text>
      <TextInput
        placeholder={i18n.t('email')}
        autoCapitalize="none"
        value={email}
        onChangeText={setEmail}
        style={{
          borderWidth: 1,
          borderColor: theme.color.border,
          borderRadius: theme.radius.input,
          padding: theme.spacing.md,
          marginBottom: theme.spacing.sm,
          color: theme.color.text,
        }}
      />
      <TextInput
        placeholder={i18n.t('password')}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        style={{
          borderWidth: 1,
          borderColor: theme.color.border,
          borderRadius: theme.radius.input,
          padding: theme.spacing.md,
          marginBottom: theme.spacing.sm,
          color: theme.color.text,
        }}
      />
      {err && (
        <Text style={{ color: theme.color.danger, marginBottom: theme.spacing.sm }}>
          {i18n.t('invalid')}
        </Text>
      )}
      <Pressable onPress={submit}>
        <LinearGradient
          colors={theme.color.gradientPrimary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            borderRadius: theme.radius.input,
            padding: theme.spacing.md,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: theme.color.onPrimary, fontWeight: '700' }}>{i18n.t('signIn')}</Text>
        </LinearGradient>
      </Pressable>
    </View>
  );
}
