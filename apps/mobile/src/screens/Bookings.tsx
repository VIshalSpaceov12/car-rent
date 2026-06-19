import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { useTheme } from '@car-rental/tokens';
import type { BookingDTO, BookingStatus } from '@car-rental/types';
import { listBookings } from '@/api/client';
import { i18n } from '@/i18n';

// Status pill colours — mapped via theme tokens, no raw hex
function statusStyle(status: BookingStatus, theme: ReturnType<typeof useTheme>): { bg: string; fg: string } {
  switch (status) {
    case 'reserved':         return { bg: theme.color.info,    fg: theme.color.onPrimary };
    case 'confirmed':        return { bg: theme.color.primary, fg: theme.color.onPrimary };
    case 'vehicle-prepared': return { bg: theme.color.accent,  fg: theme.color.onPrimary };
    case 'picked-up':        return { bg: theme.color.warning, fg: theme.color.text };
    case 'returned':         return { bg: theme.color.success, fg: theme.color.onPrimary };
    case 'completed':        return { bg: theme.color.success, fg: theme.color.onPrimary };
    case 'rejected':         return { bg: theme.color.danger,  fg: theme.color.onPrimary };
    case 'cancelled':        return { bg: theme.color.border,  fg: theme.color.textMuted };
  }
}

type BookingCardProps = {
  item: BookingDTO;
  theme: ReturnType<typeof useTheme>;
  onPay?: (booking: BookingDTO) => void;
};

function BookingCard({ item, theme, onPay }: BookingCardProps) {
  const { bg, fg } = statusStyle(item.status, theme);
  const currency = item.currency;
  const isRtl = i18n.locale === 'ar';

  const totalFormatted = Intl.NumberFormat(i18n.locale, {
    style: 'currency',
    currency,
  }).format(item.totalAmount);

  const canPay = item.status === 'reserved' && !item.payment;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.color.surface,
          borderRadius: theme.radius.card,
          padding: theme.spacing.md,
          marginBottom: theme.spacing.sm,
          ...theme.elevation.sm,
        },
      ]}
    >
      {/* Header row: vehicle name + status pill */}
      <View style={[styles.row, { marginBottom: theme.spacing.xs }]}>
        <Text
          style={{
            flex: 1,
            color: theme.color.text,
            fontSize: theme.typography.subtitle.fontSize,
            fontWeight: '700',
            textAlign: isRtl ? 'right' : 'left',
          }}
          numberOfLines={1}
        >
          {item.vehicle.name}
        </Text>
        <View
          style={[
            styles.statusPill,
            { backgroundColor: bg, borderRadius: theme.radius.pill ?? 32, marginStart: theme.spacing.sm },
          ]}
        >
          <Text style={{ color: fg, fontSize: theme.typography.label.fontSize, fontWeight: '600' }}>
            {i18n.t('bookingList.status.' + item.status)}
          </Text>
        </View>
      </View>

      {/* Dates */}
      <Text
        style={{
          color: theme.color.textMuted,
          fontSize: theme.typography.caption.fontSize,
          textAlign: isRtl ? 'right' : 'left',
          marginBottom: 2,
        }}
      >
        {item.startDate} — {item.endDate}
      </Text>

      {/* Total */}
      <Text
        style={{
          color: theme.color.primary,
          fontSize: theme.typography.body.fontSize,
          fontWeight: '700',
          textAlign: isRtl ? 'right' : 'left',
          marginTop: theme.spacing.xs,
        }}
      >
        {i18n.t('bookingList.total')}: {totalFormatted}
      </Text>

      {/* Pay button — visible only for unpaid reserved bookings */}
      {canPay && onPay && (
        <Pressable
          style={[
            styles.payButton,
            {
              backgroundColor: theme.color.primary,
              borderRadius: theme.radius.input,
              marginTop: theme.spacing.sm,
            },
          ]}
          onPress={() => onPay(item)}
          accessibilityRole="button"
          accessibilityLabel={i18n.t('bookingList.payNow')}
        >
          <Text
            style={{
              color: theme.color.onPrimary,
              fontSize: theme.typography.caption.fontSize,
              fontWeight: '700',
              textAlign: 'center',
            }}
          >
            {i18n.t('bookingList.payNow')}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

type Props = {
  /** If provided, "Pay" button appears on reserved bookings */
  onPayBooking?: (booking: BookingDTO) => void;
};

export function BookingsScreen({ onPayBooking }: Props = {}) {
  const theme = useTheme();
  const [bookings, setBookings] = useState<BookingDTO[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await listBookings();
    setBookings(result);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const isRtl = i18n.locale === 'ar';

  return (
    <View style={[styles.container, { backgroundColor: theme.color.background }]}>
      <Text
        style={{
          color: theme.color.text,
          fontSize: theme.typography.title.fontSize,
          fontWeight: '700',
          paddingHorizontal: theme.spacing.md,
          paddingTop: theme.spacing.md,
          paddingBottom: theme.spacing.sm,
          textAlign: isRtl ? 'right' : 'left',
        }}
      >
        {i18n.t('bookingList.title')}
      </Text>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.color.primary} />
          <Text style={{ color: theme.color.textMuted, marginTop: theme.spacing.sm }}>
            {i18n.t('bookingList.loading')}
          </Text>
        </View>
      ) : bookings.length === 0 ? (
        <View style={styles.center}>
          <Text style={{ color: theme.color.textMuted }}>{i18n.t('bookingList.empty')}</Text>
          <Pressable
            style={{ marginTop: theme.spacing.md }}
            onPress={() => void load()}
            accessibilityRole="button"
          >
            <Text style={{ color: theme.color.primary, fontWeight: '600' }}>
              {i18n.t('bookingList.retry')}
            </Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={bookings}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <BookingCard item={item} theme={theme} onPay={onPayBooking} />
          )}
          contentContainerStyle={{ padding: theme.spacing.md, paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: {},
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4 },
  payButton: { paddingVertical: 10, alignItems: 'center' },
});
