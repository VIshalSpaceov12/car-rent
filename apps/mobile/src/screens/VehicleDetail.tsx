import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Image, ActivityIndicator } from 'react-native';
import { useTheme } from '@car-rental/tokens';
import type { VehicleDTO } from '@car-rental/types';
import { getVehicle } from '@/api/client';
import { i18n } from '@/i18n';

type Props = {
  vehicleId: string;
};

export function VehicleDetailScreen({ vehicleId }: Props) {
  const theme = useTheme();
  const [vehicle, setVehicle] = useState<VehicleDTO | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getVehicle(vehicleId)
      .then(setVehicle)
      .finally(() => setLoading(false));
  }, [vehicleId]);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.color.background }]}>
        <ActivityIndicator color={theme.color.primary} />
        <Text style={{ color: theme.color.textMuted, marginTop: theme.spacing.sm }}>
          {i18n.t('browse.loading')}
        </Text>
      </View>
    );
  }

  if (!vehicle) {
    return (
      <View style={[styles.center, { backgroundColor: theme.color.background }]}>
        <Text style={{ color: theme.color.textMuted }}>{i18n.t('browse.empty')}</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: theme.color.background }}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {vehicle.imageUrl ? (
        <Image
          source={{ uri: vehicle.imageUrl }}
          style={styles.heroImage}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
        />
      ) : (
        <View style={[styles.heroPlaceholder, { backgroundColor: theme.color.surfaceAlt }]} />
      )}

      <View style={styles.body}>
        <Text
          style={{
            color: theme.color.text,
            fontSize: theme.typography.heading.fontSize,
            fontWeight: '700',
          }}
        >
          {vehicle.name}
        </Text>

        <Text
          style={{
            color: theme.color.primary,
            fontSize: theme.typography.title.fontSize,
            fontWeight: '700',
            marginTop: theme.spacing.xs,
          }}
        >
          {Intl.NumberFormat(i18n.locale, { style: 'currency', currency: 'USD' }).format(vehicle.pricePerDay)}
          {' '}
          <Text style={{ color: theme.color.textMuted, fontSize: theme.typography.body.fontSize, fontWeight: '400' }}>
            {i18n.t('vehicle.perDay')}
          </Text>
        </Text>

        <View
          style={[
            styles.specsContainer,
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
              fontWeight: '600',
              marginBottom: theme.spacing.sm,
            }}
          >
            {i18n.t('vehicle.specs')}
          </Text>

          <SpecRow label={i18n.t('vehicle.transmission')} value={vehicle.transmission} theme={theme} />
          <SpecRow label={i18n.t('vehicle.fuel')} value={vehicle.fuelType} theme={theme} />
          {vehicle.seats !== undefined && (
            <SpecRow label={i18n.t('vehicle.seats')} value={String(vehicle.seats)} theme={theme} />
          )}
          {vehicle.year !== undefined && (
            <SpecRow label={i18n.t('vehicle.year')} value={String(vehicle.year)} theme={theme} />
          )}
        </View>

        {vehicle.description ? (
          <View style={{ marginTop: theme.spacing.md }}>
            <Text
              style={{
                color: theme.color.text,
                fontSize: theme.typography.subtitle.fontSize,
                fontWeight: '600',
                marginBottom: theme.spacing.xs,
              }}
            >
              {i18n.t('vehicle.description')}
            </Text>
            <Text style={{ color: theme.color.textMuted, fontSize: theme.typography.body.fontSize, lineHeight: 22 }}>
              {vehicle.description}
            </Text>
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

type SpecRowProps = { label: string; value: string; theme: ReturnType<typeof useTheme> };

function SpecRow({ label, value, theme }: SpecRowProps) {
  return (
    <View style={styles.specRow}>
      <Text style={{ color: theme.color.textMuted, fontSize: theme.typography.caption.fontSize, flex: 1 }}>
        {label}
      </Text>
      <Text style={{ color: theme.color.text, fontSize: theme.typography.caption.fontSize, fontWeight: '600' }}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { paddingBottom: 40 },
  heroImage: { width: '100%', height: 240 },
  heroPlaceholder: { width: '100%', height: 240 },
  body: { padding: 20 },
  specsContainer: {},
  specRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
});
