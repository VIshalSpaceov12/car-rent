import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useTheme } from '@car-rental/tokens';
import type { BookingQuote, RentalPlan } from '@car-rental/types';
import { RENTAL_PLANS } from '@car-rental/types';
import { quoteBooking, createBooking } from '@/api/client';
import { i18n } from '@/i18n';

type Props = {
  vehicleId: string;
  vehicleName: string;
  pricePerDay: number;
  onBookingCreated?: (bookingId: string) => void;
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function isValidDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s).getTime());
}

function planLabel(plan: RentalPlan): string {
  switch (plan) {
    case 'daily': return i18n.t('booking.planDaily');
    case 'weekly': return i18n.t('booking.planWeekly');
    case 'monthly': return i18n.t('booking.planMonthly');
    case 'long-term': return i18n.t('booking.planLongTerm');
  }
}

export function BookingScreen({ vehicleId, vehicleName, pricePerDay, onBookingCreated }: Props) {
  const theme = useTheme();

  const [startDate, setStartDate] = useState(todayIso());
  const [endDate, setEndDate] = useState(addDays(todayIso(), 3));
  const [plan, setPlan] = useState<RentalPlan>('daily');
  const [quote, setQuote] = useState<BookingQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const currency = quote?.currency ?? 'USD';

  const fmt = useCallback(
    (amount: number) =>
      Intl.NumberFormat(i18n.locale, { style: 'currency', currency }).format(amount),
    [currency],
  );

  const fetchQuote = useCallback(async () => {
    if (!isValidDate(startDate) || !isValidDate(endDate)) return;
    if (startDate >= endDate) return;
    setQuoteLoading(true);
    setQuoteError(false);
    setQuote(null);
    const result = await quoteBooking({ vehicleId, startDate, endDate, plan });
    setQuoteLoading(false);
    if (result) {
      setQuote(result);
    } else {
      setQuoteError(true);
    }
  }, [vehicleId, startDate, endDate, plan]);

  useEffect(() => {
    void fetchQuote();
  }, [fetchQuote]);

  const handleConfirm = useCallback(async () => {
    if (!quote) return;
    setSubmitting(true);
    const booking = await createBooking({ vehicleId, startDate, endDate, plan });
    setSubmitting(false);
    if (booking) {
      Alert.alert(i18n.t('booking.success'));
      onBookingCreated?.(booking.id);
    } else {
      Alert.alert(i18n.t('booking.error'));
    }
  }, [quote, vehicleId, startDate, endDate, plan, onBookingCreated]);

  const isRtl = i18n.locale === 'ar';

  return (
    <ScrollView
      style={{ backgroundColor: theme.color.background }}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Vehicle name */}
      <Text
        style={{
          color: theme.color.text,
          fontSize: theme.typography.title.fontSize,
          fontWeight: '700',
          marginBottom: theme.spacing.sm,
          textAlign: isRtl ? 'right' : 'left',
        }}
      >
        {vehicleName}
      </Text>

      <Text
        style={{
          color: theme.color.primary,
          fontSize: theme.typography.body.fontSize,
          fontWeight: '600',
          marginBottom: theme.spacing.md,
          textAlign: isRtl ? 'right' : 'left',
        }}
      >
        {Intl.NumberFormat(i18n.locale, { style: 'currency', currency }).format(pricePerDay)}
        {' '}
        {i18n.t('vehicle.perDay')}
      </Text>

      {/* Dates */}
      <SectionLabel label={i18n.t('booking.startDate')} theme={theme} isRtl={isRtl} />
      <TextInput
        style={[
          styles.input,
          {
            borderColor: theme.color.border,
            borderRadius: theme.radius.input,
            color: theme.color.text,
            backgroundColor: theme.color.surface,
            textAlign: isRtl ? 'right' : 'left',
          },
        ]}
        value={startDate}
        onChangeText={setStartDate}
        placeholder={i18n.t('booking.selectStartDate')}
        placeholderTextColor={theme.color.textMuted}
        autoCapitalize="none"
        keyboardType="numbers-and-punctuation"
        accessibilityLabel={i18n.t('booking.startDate')}
      />

      <SectionLabel label={i18n.t('booking.endDate')} theme={theme} isRtl={isRtl} />
      <TextInput
        style={[
          styles.input,
          {
            borderColor: theme.color.border,
            borderRadius: theme.radius.input,
            color: theme.color.text,
            backgroundColor: theme.color.surface,
            textAlign: isRtl ? 'right' : 'left',
          },
        ]}
        value={endDate}
        onChangeText={setEndDate}
        placeholder={i18n.t('booking.selectEndDate')}
        placeholderTextColor={theme.color.textMuted}
        autoCapitalize="none"
        keyboardType="numbers-and-punctuation"
        accessibilityLabel={i18n.t('booking.endDate')}
      />

      {/* Plan selector */}
      <SectionLabel label={i18n.t('booking.plan')} theme={theme} isRtl={isRtl} />
      <View style={[styles.planRow, { gap: theme.spacing.sm }]}>
        {(RENTAL_PLANS as readonly RentalPlan[]).map((p) => {
          const active = p === plan;
          return (
            <Pressable
              key={p}
              onPress={() => setPlan(p)}
              style={[
                styles.planChip,
                {
                  borderRadius: theme.radius.pill ?? 32,
                  backgroundColor: active ? theme.color.primary : theme.color.surface,
                  borderColor: active ? theme.color.primary : theme.color.border,
                },
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text
                style={{
                  fontSize: theme.typography.caption.fontSize,
                  fontWeight: '600',
                  color: active ? theme.color.onPrimary : theme.color.text,
                }}
              >
                {planLabel(p)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Quote breakdown */}
      <View
        style={[
          styles.quoteBox,
          {
            backgroundColor: theme.color.surfaceAlt,
            borderRadius: theme.radius.card,
            marginTop: theme.spacing.md,
            padding: theme.spacing.md,
          },
        ]}
      >
        <Text
          style={{
            color: theme.color.text,
            fontSize: theme.typography.subtitle.fontSize,
            fontWeight: '700',
            marginBottom: theme.spacing.sm,
            textAlign: isRtl ? 'right' : 'left',
          }}
        >
          {i18n.t('booking.quoteBreakdown')}
        </Text>

        {quoteLoading && (
          <View style={styles.quoteLoading}>
            <ActivityIndicator color={theme.color.primary} />
            <Text style={{ color: theme.color.textMuted, marginStart: theme.spacing.sm }}>
              {i18n.t('booking.loading')}
            </Text>
          </View>
        )}

        {quoteError && !quoteLoading && (
          <Text style={{ color: theme.color.danger, fontSize: theme.typography.caption.fontSize }}>
            {i18n.t('booking.quoteError')}
          </Text>
        )}

        {quote && !quoteLoading && (
          <>
            <QuoteRow label={i18n.t('booking.days')} value={String(quote.days)} theme={theme} isRtl={isRtl} />
            <QuoteRow label={i18n.t('booking.subtotal')} value={fmt(quote.subtotal)} theme={theme} isRtl={isRtl} />
            <QuoteRow label={i18n.t('booking.serviceCharge')} value={fmt(quote.serviceCharge)} theme={theme} isRtl={isRtl} />
            <QuoteRow
              label={`${i18n.t('booking.tax')} (${quote.taxRatePct}%)`}
              value={fmt(quote.taxAmount)}
              theme={theme}
              isRtl={isRtl}
            />
            <View
              style={[styles.totalRow, { borderTopColor: theme.color.border, marginTop: theme.spacing.sm, paddingTop: theme.spacing.sm }]}
            >
              <Text
                style={{
                  color: theme.color.text,
                  fontSize: theme.typography.body.fontSize,
                  fontWeight: '700',
                  flex: 1,
                  textAlign: isRtl ? 'right' : 'left',
                }}
              >
                {i18n.t('booking.total')}
              </Text>
              <Text
                style={{
                  color: theme.color.primary,
                  fontSize: theme.typography.body.fontSize,
                  fontWeight: '800',
                }}
              >
                {fmt(quote.total)}
              </Text>
            </View>
          </>
        )}
      </View>

      {/* Confirm button */}
      <Pressable
        style={[
          styles.confirmButton,
          {
            backgroundColor: quote && !quoteLoading ? theme.color.primary : theme.color.border,
            borderRadius: theme.radius.input,
            marginTop: theme.spacing.md,
          },
        ]}
        onPress={handleConfirm}
        disabled={!quote || quoteLoading || submitting}
        accessibilityRole="button"
      >
        {submitting ? (
          <ActivityIndicator color={theme.color.onPrimary} />
        ) : (
          <Text
            style={{
              color: theme.color.onPrimary,
              fontSize: theme.typography.body.fontSize,
              fontWeight: '700',
            }}
          >
            {i18n.t('booking.confirm')}
          </Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

type SectionLabelProps = { label: string; theme: ReturnType<typeof useTheme>; isRtl: boolean };
function SectionLabel({ label, theme, isRtl }: SectionLabelProps) {
  return (
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
      {label}
    </Text>
  );
}

type QuoteRowProps = {
  label: string;
  value: string;
  theme: ReturnType<typeof useTheme>;
  isRtl: boolean;
};
function QuoteRow({ label, value, theme, isRtl }: QuoteRowProps) {
  return (
    <View style={styles.quoteRow}>
      {isRtl ? (
        <>
          <Text style={{ color: theme.color.text, fontSize: theme.typography.caption.fontSize, fontWeight: '500' }}>
            {value}
          </Text>
          <Text style={{ color: theme.color.textMuted, fontSize: theme.typography.caption.fontSize }}>
            {label}
          </Text>
        </>
      ) : (
        <>
          <Text style={{ color: theme.color.textMuted, fontSize: theme.typography.caption.fontSize, flex: 1 }}>
            {label}
          </Text>
          <Text style={{ color: theme.color.text, fontSize: theme.typography.caption.fontSize, fontWeight: '500' }}>
            {value}
          </Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 48 },
  input: {
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 4,
  },
  planRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  planChip: {
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  quoteBox: {},
  quoteLoading: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  quoteRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  confirmButton: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
