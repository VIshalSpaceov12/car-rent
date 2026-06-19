import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useTheme } from '@car-rental/tokens';
import type { BookingDTO } from '@car-rental/types';
import { i18n } from '@/i18n';

type Props = {
  booking: BookingDTO;
  onDone: () => void;
};

export function PickupSuccessScreen({ booking, onDone }: Props) {
  const theme = useTheme();
  const isRtl = i18n.locale === 'ar';

  return (
    <View style={[styles.container, { backgroundColor: theme.color.background, padding: theme.spacing.md }]}>
      {/* Success icon placeholder — using themed color, no raw hex */}
      <View
        style={[
          styles.iconCircle,
          {
            backgroundColor: theme.color.success,
            marginBottom: theme.spacing.md,
          },
        ]}
      >
        <Text style={{ color: theme.color.onPrimary, fontSize: 40 }}>{'✓'}</Text>
      </View>

      <Text
        style={{
          color: theme.color.text,
          fontSize: theme.typography.title.fontSize,
          fontWeight: '700',
          marginBottom: theme.spacing.sm,
          textAlign: 'center',
        }}
      >
        {i18n.t('pickupSuccess.title')}
      </Text>

      <Text
        style={{
          color: theme.color.textMuted,
          fontSize: theme.typography.body.fontSize,
          textAlign: 'center',
          marginBottom: theme.spacing.sm,
        }}
      >
        {booking.vehicle.name}
      </Text>

      <Text
        style={{
          color: theme.color.textMuted,
          fontSize: theme.typography.body.fontSize,
          textAlign: 'center',
          marginBottom: theme.spacing.md,
        }}
      >
        {i18n.t('pickupSuccess.subtitle')}
      </Text>

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
        accessibilityLabel={i18n.t('pickupSuccess.done')}
      >
        <Text
          style={{
            color: theme.color.onPrimary,
            fontSize: theme.typography.body.fontSize,
            fontWeight: '700',
          }}
        >
          {i18n.t('pickupSuccess.done')}
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
  doneButton: {
    paddingVertical: 16,
    paddingHorizontal: 40,
    alignItems: 'center',
  },
});
