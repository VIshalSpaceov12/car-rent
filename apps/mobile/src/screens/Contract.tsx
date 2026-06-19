import { useCallback, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useTheme } from '@car-rental/tokens';
import type { BookingDTO } from '@car-rental/types';
import { signContract } from '@/api/client';
import { i18n } from '@/i18n';

type Props = {
  booking: BookingDTO;
  onSigned: (booking: BookingDTO) => void;
  onCancel: () => void;
};

export function ContractScreen({ booking, onSigned, onCancel }: Props) {
  const theme = useTheme();
  const [signatureName, setSignatureName] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);
  const isRtl = i18n.locale === 'ar';

  const handleSign = useCallback(async () => {
    if (!signatureName.trim()) {
      setError(i18n.t('contract.errorNoName'));
      return;
    }
    if (!agreed) {
      setError(i18n.t('contract.errorMustAgree'));
      return;
    }
    setError(null);
    setSigning(true);
    const result = await signContract(booking.id, {
      signatureName: signatureName.trim(),
      agree: true,
    });
    setSigning(false);
    if (result) {
      onSigned(result.booking);
    } else {
      setError(i18n.t('contract.errorGeneric'));
    }
  }, [booking.id, signatureName, agreed, onSigned]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.color.background }}
      contentContainerStyle={[styles.content, { padding: theme.spacing.md, paddingBottom: 48 }]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* Title */}
      <Text
        style={{
          color: theme.color.text,
          fontSize: theme.typography.title.fontSize,
          fontWeight: '700',
          marginBottom: theme.spacing.sm,
          textAlign: isRtl ? 'right' : 'left',
        }}
      >
        {i18n.t('contract.title')}
      </Text>

      {/* Vehicle name */}
      <Text
        style={{
          color: theme.color.textMuted,
          fontSize: theme.typography.body.fontSize,
          marginBottom: theme.spacing.md,
          textAlign: isRtl ? 'right' : 'left',
        }}
      >
        {booking.vehicle.name}
      </Text>

      {/* Terms box */}
      <View
        style={[
          styles.termsBox,
          {
            backgroundColor: theme.color.surfaceAlt,
            borderRadius: theme.radius.card,
            padding: theme.spacing.md,
            marginBottom: theme.spacing.md,
            borderColor: theme.color.border,
          },
        ]}
      >
        <Text
          style={{
            color: theme.color.text,
            fontSize: theme.typography.caption.fontSize,
            lineHeight: 20,
            textAlign: isRtl ? 'right' : 'left',
          }}
        >
          {i18n.t('contract.terms')}
        </Text>
      </View>

      {/* Signature name label */}
      <Text
        style={{
          color: theme.color.textMuted,
          fontSize: theme.typography.caption.fontSize,
          fontWeight: '600',
          marginBottom: 4,
          textAlign: isRtl ? 'right' : 'left',
        }}
      >
        {i18n.t('contract.nameLabel')}
      </Text>

      {/* Signature input */}
      <TextInput
        style={[
          styles.nameInput,
          {
            backgroundColor: theme.color.surface,
            borderColor: error && !signatureName.trim() ? theme.color.danger : theme.color.border,
            borderRadius: theme.radius.input,
            color: theme.color.text,
            fontSize: theme.typography.body.fontSize,
            textAlign: isRtl ? 'right' : 'left',
          },
        ]}
        value={signatureName}
        onChangeText={(t) => {
          setSignatureName(t);
          if (error) setError(null);
        }}
        placeholder={i18n.t('contract.namePlaceholder')}
        placeholderTextColor={theme.color.textMuted}
        autoCapitalize="words"
        returnKeyType="done"
        accessibilityLabel={i18n.t('contract.nameLabel')}
      />

      {/* Agree checkbox row */}
      <Pressable
        style={[styles.agreeRow, { marginTop: theme.spacing.md }]}
        onPress={() => {
          setAgreed((prev) => !prev);
          if (error) setError(null);
        }}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: agreed }}
        accessibilityLabel={i18n.t('contract.agreeLabel')}
      >
        <View
          style={[
            styles.checkbox,
            {
              borderColor: agreed ? theme.color.primary : theme.color.border,
              backgroundColor: agreed ? theme.color.primary : theme.color.surface,
              borderRadius: 4,
            },
          ]}
        >
          {agreed && (
            <Text style={{ color: theme.color.onPrimary, fontSize: 13, fontWeight: '700' }}>
              {'✓'}
            </Text>
          )}
        </View>
        <Text
          style={{
            color: theme.color.text,
            fontSize: theme.typography.caption.fontSize,
            flex: 1,
            marginStart: theme.spacing.sm,
            textAlign: isRtl ? 'right' : 'left',
            lineHeight: 20,
          }}
        >
          {i18n.t('contract.agreeLabel')}
        </Text>
      </Pressable>

      {/* Error message */}
      {error && (
        <Text
          style={{
            color: theme.color.danger,
            fontSize: theme.typography.caption.fontSize,
            marginTop: theme.spacing.xs,
            textAlign: isRtl ? 'right' : 'left',
          }}
          accessibilityRole="alert"
        >
          {error}
        </Text>
      )}

      {/* Sign button */}
      <Pressable
        style={[
          styles.signButton,
          {
            backgroundColor: signing ? theme.color.border : theme.color.primary,
            borderRadius: theme.radius.input,
            marginTop: theme.spacing.md,
          },
        ]}
        onPress={() => { void handleSign(); }}
        disabled={signing}
        accessibilityRole="button"
        accessibilityLabel={i18n.t('contract.signButton')}
      >
        {signing ? (
          <ActivityIndicator color={theme.color.onPrimary} />
        ) : (
          <Text
            style={{
              color: theme.color.onPrimary,
              fontSize: theme.typography.body.fontSize,
              fontWeight: '700',
            }}
          >
            {i18n.t('contract.signButton')}
          </Text>
        )}
      </Pressable>

      {/* Cancel */}
      <Pressable
        style={{ marginTop: theme.spacing.md, alignItems: 'center' }}
        onPress={onCancel}
        accessibilityRole="button"
      >
        <Text style={{ color: theme.color.textMuted, fontSize: theme.typography.body.fontSize }}>
          {i18n.t('checkout.cancel')}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1 },
  termsBox: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  nameInput: {
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  agreeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  signButton: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
