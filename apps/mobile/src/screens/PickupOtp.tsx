import { useCallback, useRef, useState } from 'react';
import {
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useTheme } from '@car-rental/tokens';
import type { BookingDTO } from '@car-rental/types';
import { verifyOtp } from '@/api/client';
import type { OtpVerifyError } from '@/api/client';
import { i18n } from '@/i18n';

type Props = {
  booking: BookingDTO;
  onVerified: (booking: BookingDTO) => void;
  onCancel: () => void;
};

function mapOtpError(err: OtpVerifyError): string {
  switch (err.error) {
    case 'invalid':
      return i18n.t('pickupFlow.errorInvalid');
    case 'expired':
      return i18n.t('pickupFlow.errorExpired');
    case 'locked':
      return i18n.t('pickupFlow.errorLocked');
    default:
      return i18n.t('pickupFlow.errorGeneric');
  }
}

export function PickupOtpScreen({ booking, onVerified, onCancel }: Props) {
  const theme = useTheme();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const isRtl = i18n.locale === 'ar';

  const handleUnlock = useCallback(async () => {
    if (code.length !== 6) return;
    setError(null);
    setVerifying(true);
    const result = await verifyOtp(booking.id, code);
    setVerifying(false);
    if ('verified' in result && result.verified) {
      // Clear the field — don't keep the OTP in state after success
      setCode('');
      onVerified(booking);
    } else {
      setCode('');
      setError(mapOtpError(result as OtpVerifyError));
      inputRef.current?.focus();
    }
  }, [booking, code, onVerified]);

  const canSubmit = code.length === 6 && !verifying;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.color.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.content, { padding: theme.spacing.md }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
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
          {i18n.t('pickupFlow.title')}
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

        {/* Instruction */}
        <Text
          style={{
            color: theme.color.text,
            fontSize: theme.typography.body.fontSize,
            marginBottom: theme.spacing.md,
            textAlign: isRtl ? 'right' : 'left',
            lineHeight: 22,
          }}
        >
          {i18n.t('pickupFlow.instruction')}
        </Text>

        {/* OTP label */}
        <Text
          style={{
            color: theme.color.textMuted,
            fontSize: theme.typography.caption.fontSize,
            fontWeight: '600',
            marginBottom: 4,
            textAlign: isRtl ? 'right' : 'left',
          }}
        >
          {i18n.t('pickupFlow.codeLabel')}
        </Text>

        {/* Code input */}
        <TextInput
          ref={inputRef}
          style={[
            styles.codeInput,
            {
              backgroundColor: theme.color.surface,
              borderColor: error ? theme.color.danger : theme.color.border,
              borderRadius: theme.radius.input,
              color: theme.color.text,
              fontSize: 28,
              letterSpacing: 10,
            },
          ]}
          value={code}
          onChangeText={(t) => {
            // Only allow digits, max 6
            setCode(t.replace(/\D/g, '').slice(0, 6));
            if (error) setError(null);
          }}
          placeholder={i18n.t('pickupFlow.codePlaceholder')}
          placeholderTextColor={theme.color.textMuted}
          keyboardType="number-pad"
          maxLength={6}
          textAlign="center"
          autoFocus
          returnKeyType="done"
          onSubmitEditing={() => { if (canSubmit) void handleUnlock(); }}
          accessibilityLabel={i18n.t('pickupFlow.codeLabel')}
          // Security: disable secure-text on iOS autocomplete to avoid code suggestion leakage
          autoComplete="off"
          textContentType="oneTimeCode"
          secureTextEntry={false}
        />

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

        {/* Unlock button */}
        <Pressable
          style={[
            styles.unlockButton,
            {
              backgroundColor: canSubmit ? theme.color.primary : theme.color.border,
              borderRadius: theme.radius.input,
              marginTop: theme.spacing.md,
            },
          ]}
          onPress={() => { void handleUnlock(); }}
          disabled={!canSubmit}
          accessibilityRole="button"
          accessibilityLabel={i18n.t('pickupFlow.unlockButton')}
          accessibilityState={{ disabled: !canSubmit }}
        >
          {verifying ? (
            <ActivityIndicator color={theme.color.onPrimary} />
          ) : (
            <Text
              style={{
                color: canSubmit ? theme.color.onPrimary : theme.color.textMuted,
                fontSize: theme.typography.body.fontSize,
                fontWeight: '700',
              }}
            >
              {i18n.t('pickupFlow.unlockButton')}
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
            {i18n.t('pickupFlow.cancel')}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1 },
  codeInput: {
    borderWidth: 1.5,
    paddingVertical: 16,
    paddingHorizontal: 12,
    fontWeight: '700',
  },
  unlockButton: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
