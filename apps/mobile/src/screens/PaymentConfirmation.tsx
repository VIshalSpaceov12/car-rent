import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useTheme } from '@car-rental/tokens';
import type { BookingDTO } from '@car-rental/types';
import { i18n } from '@/i18n';

type Props = {
  booking: BookingDTO;
  onDone: () => void;
};

export function PaymentConfirmationScreen({ booking, onDone }: Props) {
  const theme = useTheme();
  const isRtl = i18n.locale === 'ar';
  const currency = booking.currency;
  const fmt = (amount: number) =>
    Intl.NumberFormat(i18n.locale, { style: 'currency', currency }).format(amount);

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.color.background, padding: theme.spacing.md },
      ]}
    >
      {/* Success icon area */}
      <View
        style={[
          styles.iconCircle,
          { backgroundColor: theme.color.success, marginBottom: theme.spacing.md },
        ]}
      >
        <Text style={{ color: theme.color.onPrimary, fontSize: 36, fontWeight: '800' }}>✓</Text>
      </View>

      <Text
        style={{
          color: theme.color.text,
          fontSize: theme.typography.title.fontSize,
          fontWeight: '700',
          textAlign: 'center',
          marginBottom: theme.spacing.sm,
        }}
      >
        {i18n.t('paymentConfirmation.title')}
      </Text>

      <Text
        style={{
          color: theme.color.textMuted,
          fontSize: theme.typography.body.fontSize,
          textAlign: 'center',
          marginBottom: theme.spacing.md,
        }}
      >
        {i18n.t('paymentConfirmation.subtitle')}
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
            width: '100%',
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
            marginBottom: theme.spacing.xs,
          }}
        >
          {new Intl.DateTimeFormat(i18n.locale).format(new Date(booking.startDate))} — {new Intl.DateTimeFormat(i18n.locale).format(new Date(booking.endDate))}
        </Text>
        <Text
          style={{
            color: theme.color.primary,
            fontSize: theme.typography.body.fontSize,
            fontWeight: '800',
            textAlign: isRtl ? 'right' : 'left',
          }}
        >
          {i18n.t('paymentConfirmation.paid')}: {fmt(booking.totalAmount)}
        </Text>

        {booking.payment && (
          <Text
            style={{
              color: theme.color.textMuted,
              fontSize: theme.typography.caption.fontSize,
              textAlign: isRtl ? 'right' : 'left',
              marginTop: theme.spacing.xs,
            }}
          >
            {i18n.t('paymentConfirmation.method')}: {i18n.t('checkout.method_' + booking.payment.method)}
          </Text>
        )}
      </View>

      <Pressable
        style={[
          styles.doneButton,
          {
            backgroundColor: theme.color.primary,
            borderRadius: theme.radius.input,
          },
        ]}
        onPress={onDone}
        accessibilityRole="button"
      >
        <Text
          style={{
            color: theme.color.onPrimary,
            fontSize: theme.typography.body.fontSize,
            fontWeight: '700',
          }}
        >
          {i18n.t('paymentConfirmation.viewBookings')}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryBox: {},
  doneButton: {
    width: '100%',
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
