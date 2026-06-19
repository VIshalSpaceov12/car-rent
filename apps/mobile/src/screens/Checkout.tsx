import { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '@car-rental/tokens';
import type { BookingDTO, PaymentMethod } from '@car-rental/types';
import { PAYMENT_METHODS } from '@car-rental/types';
import { payBooking } from '@/api/client';
import { i18n } from '@/i18n';

type CardOutcome = 'success' | 'fail';

type Props = {
  booking: BookingDTO;
  /** Called with the updated booking after a successful payment */
  onPaymentSuccess: (booking: BookingDTO) => void;
  /** Called to allow the user to go back without paying */
  onCancel: () => void;
};

function methodLabel(method: PaymentMethod): string {
  switch (method) {
    case 'card':             return i18n.t('checkout.methodCard');
    case 'cash-on-delivery': return i18n.t('checkout.methodCod');
  }
}

export function CheckoutScreen({ booking, onPaymentSuccess, onCancel }: Props) {
  const theme = useTheme();
  const isRtl = i18n.locale === 'ar';

  const [method, setMethod] = useState<PaymentMethod>('card');
  const [cardOutcome, setCardOutcome] = useState<CardOutcome>('success');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const currency = booking.currency;
  const fmt = useCallback(
    (amount: number) =>
      Intl.NumberFormat(i18n.locale, { style: 'currency', currency }).format(amount),
    [currency],
  );

  const handlePay = useCallback(async () => {
    setErrorMsg(null);
    setLoading(true);
    const result = await payBooking(booking.id, {
      method,
      ...(method === 'card' ? { cardOutcome } : {}),
    });
    setLoading(false);
    if (result) {
      onPaymentSuccess(result.booking);
    } else {
      if (method === 'card' && cardOutcome === 'fail') {
        setErrorMsg(i18n.t('checkout.errorCardDeclined'));
      } else {
        setErrorMsg(i18n.t('checkout.errorGeneric'));
      }
    }
  }, [booking.id, method, cardOutcome, onPaymentSuccess]);

  return (
    <ScrollView
      style={{ backgroundColor: theme.color.background }}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Page title */}
      <Text
        style={{
          color: theme.color.text,
          fontSize: theme.typography.title.fontSize,
          fontWeight: '700',
          marginBottom: theme.spacing.sm,
          textAlign: isRtl ? 'right' : 'left',
        }}
      >
        {i18n.t('checkout.title')}
      </Text>

      {/* Booking summary */}
      <View
        style={[
          styles.summaryBox,
          {
            backgroundColor: theme.color.surfaceAlt,
            borderRadius: theme.radius.card,
            padding: theme.spacing.md,
            marginBottom: theme.spacing.md,
          },
        ]}
      >
        <Text
          style={{
            color: theme.color.text,
            fontSize: theme.typography.subtitle.fontSize,
            fontWeight: '700',
            textAlign: isRtl ? 'right' : 'left',
            marginBottom: theme.spacing.xs,
          }}
        >
          {booking.vehicle.name}
        </Text>
        <Text
          style={{
            color: theme.color.textMuted,
            fontSize: theme.typography.caption.fontSize,
            textAlign: isRtl ? 'right' : 'left',
          }}
        >
          {booking.startDate} — {booking.endDate}
        </Text>
        <Text
          style={{
            color: theme.color.primary,
            fontSize: theme.typography.body.fontSize,
            fontWeight: '800',
            textAlign: isRtl ? 'right' : 'left',
            marginTop: theme.spacing.xs,
          }}
        >
          {i18n.t('checkout.total')}: {fmt(booking.totalAmount)}
        </Text>
      </View>

      {/* Method selector */}
      <Text
        style={{
          color: theme.color.textMuted,
          fontSize: theme.typography.caption.fontSize,
          fontWeight: '600',
          marginBottom: theme.spacing.sm,
          textAlign: isRtl ? 'right' : 'left',
        }}
      >
        {i18n.t('checkout.selectMethod')}
      </Text>
      <View style={[styles.methodRow, { gap: theme.spacing.sm }]}>
        {(PAYMENT_METHODS as readonly PaymentMethod[]).map((m) => {
          const active = m === method;
          return (
            <Pressable
              key={m}
              onPress={() => setMethod(m)}
              style={[
                styles.methodChip,
                {
                  borderRadius: theme.radius.input,
                  backgroundColor: active ? theme.color.primary : theme.color.surface,
                  borderColor: active ? theme.color.primary : theme.color.border,
                },
              ]}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              accessibilityLabel={methodLabel(m)}
            >
              <Text
                style={{
                  color: active ? theme.color.onPrimary : theme.color.text,
                  fontSize: theme.typography.body.fontSize,
                  fontWeight: '600',
                  textAlign: 'center',
                }}
              >
                {methodLabel(m)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* MOCK card form — shown only when card is selected */}
      {method === 'card' && (
        <View
          style={[
            styles.mockCardBox,
            {
              borderColor: theme.color.warning,
              borderRadius: theme.radius.card,
              padding: theme.spacing.md,
              marginTop: theme.spacing.md,
              backgroundColor: theme.color.surfaceAlt,
            },
          ]}
        >
          {/* Mock warning banner */}
          <Text
            style={{
              color: theme.color.warning,
              fontSize: theme.typography.caption.fontSize,
              fontWeight: '700',
              textAlign: 'center',
              marginBottom: theme.spacing.sm,
            }}
          >
            {i18n.t('checkout.mockNotice')}
          </Text>

          {/* Non-functional card number display */}
          <Text
            style={{
              color: theme.color.textMuted,
              fontSize: theme.typography.caption.fontSize,
              fontWeight: '600',
              marginBottom: 4,
              textAlign: isRtl ? 'right' : 'left',
            }}
          >
            {i18n.t('checkout.cardNumber')}
          </Text>
          <View
            style={[
              styles.fakeInput,
              {
                borderColor: theme.color.border,
                borderRadius: theme.radius.input,
                backgroundColor: theme.color.surface,
              },
            ]}
            accessibilityLabel={i18n.t('checkout.cardNumberDisabledHint')}
          >
            <Text style={{ color: theme.color.textMuted, fontSize: 15 }}>
              {i18n.t('checkout.cardNumberPlaceholder')}
            </Text>
          </View>

          {/* Simulate outcome toggle */}
          <Text
            style={{
              color: theme.color.textMuted,
              fontSize: theme.typography.caption.fontSize,
              fontWeight: '600',
              marginTop: theme.spacing.sm,
              marginBottom: 4,
              textAlign: isRtl ? 'right' : 'left',
            }}
          >
            {i18n.t('checkout.simulate')}
          </Text>
          <View style={[styles.outcomeRow, { gap: theme.spacing.sm }]}>
            {(['success', 'fail'] as CardOutcome[]).map((o) => {
              const active = cardOutcome === o;
              return (
                <Pressable
                  key={o}
                  onPress={() => setCardOutcome(o)}
                  style={[
                    styles.outcomeChip,
                    {
                      borderRadius: theme.radius.pill ?? 32,
                      backgroundColor: active
                        ? o === 'success'
                          ? theme.color.success
                          : theme.color.danger
                        : theme.color.surface,
                      borderColor: active
                        ? o === 'success'
                          ? theme.color.success
                          : theme.color.danger
                        : theme.color.border,
                    },
                  ]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                >
                  <Text
                    style={{
                      color: active ? theme.color.onPrimary : theme.color.text,
                      fontSize: theme.typography.caption.fontSize,
                      fontWeight: '600',
                    }}
                  >
                    {o === 'success'
                      ? i18n.t('checkout.simulateSuccess')
                      : i18n.t('checkout.simulateFail')}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      {/* Error message */}
      {errorMsg && (
        <Text
          style={{
            color: theme.color.danger,
            fontSize: theme.typography.caption.fontSize,
            marginTop: theme.spacing.md,
            textAlign: isRtl ? 'right' : 'left',
          }}
        >
          {errorMsg}
        </Text>
      )}

      {/* Pay button */}
      <Pressable
        style={[
          styles.payButton,
          {
            backgroundColor: loading ? theme.color.border : theme.color.primary,
            borderRadius: theme.radius.input,
            marginTop: theme.spacing.md,
          },
        ]}
        onPress={() => void handlePay()}
        disabled={loading}
        accessibilityRole="button"
      >
        {loading ? (
          <ActivityIndicator color={theme.color.onPrimary} />
        ) : (
          <Text
            style={{
              color: theme.color.onPrimary,
              fontSize: theme.typography.body.fontSize,
              fontWeight: '700',
            }}
          >
            {i18n.t('checkout.pay')}
          </Text>
        )}
      </Pressable>

      {/* Cancel */}
      <Pressable
        style={{ marginTop: theme.spacing.md, alignItems: 'center' }}
        onPress={onCancel}
        accessibilityRole="button"
      >
        <Text style={{ color: theme.color.textMuted, fontSize: theme.typography.caption.fontSize }}>
          {i18n.t('checkout.cancel')}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 48 },
  summaryBox: {},
  methodRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  methodChip: {
    flex: 1,
    borderWidth: 1,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mockCardBox: {
    borderWidth: 2,
  },
  fakeInput: {
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    opacity: 0.6,
  },
  outcomeRow: {
    flexDirection: 'row',
  },
  outcomeChip: {
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  payButton: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
