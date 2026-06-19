import { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useTheme } from '@car-rental/tokens';
import type { BookingDTO } from '@car-rental/types';
import { rebookBooking } from '@/api/client';
import { i18n } from '@/i18n';

type Props = {
  booking: BookingDTO;
  /** Called with the new reserved booking after a successful rebook */
  onRebooked: (newBooking: BookingDTO) => void;
  onBack: () => void;
};

export function ReceiptScreen({ booking, onRebooked, onBack }: Props) {
  const theme = useTheme();
  const isRtl = i18n.locale === 'ar';
  const [rebooking, setRebooking] = useState(false);

  const currency = booking.currency;
  const fmt = useCallback(
    (amount: number) =>
      Intl.NumberFormat(i18n.locale, { style: 'currency', currency }).format(amount),
    [currency],
  );

  const handleRebook = useCallback(async () => {
    setRebooking(true);
    const newBooking = await rebookBooking(booking.id);
    setRebooking(false);
    if (newBooking) {
      Alert.alert(i18n.t('receipt.rebookSuccess'));
      onRebooked(newBooking);
    } else {
      Alert.alert(i18n.t('receipt.rebookError'));
    }
  }, [booking.id, onRebooked]);

  const isPast =
    booking.status === 'completed' ||
    booking.status === 'cancelled' ||
    booking.status === 'returned';

  const row = (label: string, value: string) => (
    <View style={[styles.row, { borderBottomColor: theme.color.border, paddingVertical: theme.spacing.xs }]}>
      <Text style={{ color: theme.color.textMuted, fontSize: theme.typography.caption.fontSize, flex: 1, textAlign: isRtl ? 'right' : 'left' }}>
        {label}
      </Text>
      <Text style={{ color: theme.color.text, fontSize: theme.typography.body.fontSize, fontWeight: '600', textAlign: isRtl ? 'left' : 'right' }}>
        {value}
      </Text>
    </View>
  );

  return (
    <ScrollView
      style={{ backgroundColor: theme.color.background }}
      contentContainerStyle={[styles.content, { padding: theme.spacing.md }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <Text
        style={{
          color: theme.color.text,
          fontSize: theme.typography.title.fontSize,
          fontWeight: '700',
          marginBottom: theme.spacing.md,
          textAlign: isRtl ? 'right' : 'left',
        }}
      >
        {i18n.t('receipt.title')}
      </Text>

      {/* Booking details card */}
      <View
        style={[
          styles.card,
          {
            backgroundColor: theme.color.surface,
            borderRadius: theme.radius.card,
            padding: theme.spacing.md,
            marginBottom: theme.spacing.md,
            ...theme.elevation.sm,
          },
        ]}
      >
        {row(i18n.t('receipt.vehicle'), booking.vehicle.name)}
        {row(i18n.t('receipt.dates'), `${booking.startDate} — ${booking.endDate}`)}
        {row(i18n.t('receipt.plan'), booking.plan)}
      </View>

      {/* Amounts card */}
      <View
        style={[
          styles.card,
          {
            backgroundColor: theme.color.surface,
            borderRadius: theme.radius.card,
            padding: theme.spacing.md,
            marginBottom: theme.spacing.md,
            ...theme.elevation.sm,
          },
        ]}
      >
        {row(i18n.t('receipt.baseAmount'), fmt(booking.baseAmount))}
        {row(i18n.t('receipt.tax'), fmt(booking.taxAmount))}
        {row(i18n.t('receipt.serviceCharge'), fmt(booking.serviceCharge))}
        <View style={[styles.row, { paddingVertical: theme.spacing.xs, marginTop: theme.spacing.xs }]}>
          <Text style={{ color: theme.color.text, fontSize: theme.typography.subtitle.fontSize, fontWeight: '700', textAlign: isRtl ? 'right' : 'left', flex: 1 }}>
            {i18n.t('receipt.total')}
          </Text>
          <Text style={{ color: theme.color.primary, fontSize: theme.typography.subtitle.fontSize, fontWeight: '800' }}>
            {fmt(booking.totalAmount)}
          </Text>
        </View>
      </View>

      {/* Payment info if available */}
      {booking.payment && (
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.color.surface,
              borderRadius: theme.radius.card,
              padding: theme.spacing.md,
              marginBottom: theme.spacing.md,
              ...theme.elevation.sm,
            },
          ]}
        >
          <Text style={{ color: theme.color.textMuted, fontSize: theme.typography.caption.fontSize, fontWeight: '600', marginBottom: theme.spacing.xs, textAlign: isRtl ? 'right' : 'left' }}>
            {i18n.t('receipt.payment')}
          </Text>
          {row(i18n.t('receipt.paymentMethod'), booking.payment.method)}
          {row(i18n.t('receipt.paymentStatus'), booking.payment.status)}
        </View>
      )}

      {/* Re-book button for past bookings */}
      {isPast && (
        <Pressable
          style={[
            styles.button,
            {
              backgroundColor: rebooking ? theme.color.border : theme.color.primary,
              borderRadius: theme.radius.input,
              marginBottom: theme.spacing.sm,
            },
          ]}
          onPress={() => void handleRebook()}
          disabled={rebooking}
          accessibilityRole="button"
          accessibilityLabel={i18n.t('receipt.rebook')}
        >
          {rebooking ? (
            <ActivityIndicator color={theme.color.onPrimary} />
          ) : (
            <Text style={{ color: theme.color.onPrimary, fontWeight: '700', fontSize: theme.typography.body.fontSize }}>
              {i18n.t('receipt.rebook')}
            </Text>
          )}
        </Pressable>
      )}

      {/* Back */}
      <Pressable
        style={{ alignItems: 'center', paddingVertical: theme.spacing.sm }}
        onPress={onBack}
        accessibilityRole="button"
      >
        <Text style={{ color: theme.color.textMuted, fontSize: theme.typography.caption.fontSize }}>
          {i18n.t('bookingList.title')}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {},
  card: {},
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  button: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
