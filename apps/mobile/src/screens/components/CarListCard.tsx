import { View, Text, Pressable, StyleSheet, Image } from 'react-native';
import { useTheme } from '@car-rental/tokens';
import type { VehicleDTO } from '@car-rental/types';
import { i18n } from '@/i18n';

type Props = {
  vehicle: VehicleDTO;
  onPress: () => void;
};

export function CarListCard({ vehicle, onPress }: Props) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: theme.color.surface,
          borderRadius: theme.radius.card,
          borderColor: theme.color.border,
          opacity: pressed ? 0.9 : 1,
          ...theme.elevation.sm,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={vehicle.name}
    >
      <View
        style={[
          styles.imageWrapper,
          {
            borderTopLeftRadius: theme.radius.card,
            borderTopRightRadius: theme.radius.card,
            overflow: 'hidden',
          },
        ]}
      >
        {vehicle.imageUrl ? (
          <Image
            source={{ uri: vehicle.imageUrl }}
            style={styles.image}
            resizeMode="cover"
            accessibilityIgnoresInvertColors
          />
        ) : (
          <View style={[styles.imagePlaceholder, { backgroundColor: theme.color.surfaceAlt }]} />
        )}
      </View>
      <View style={styles.body}>
        <Text
          style={{ color: theme.color.text, fontSize: theme.typography.subtitle.fontSize, fontWeight: '600' }}
          numberOfLines={1}
        >
          {vehicle.name}
        </Text>

        <View style={styles.meta}>
          <Text style={{ color: theme.color.textMuted, fontSize: theme.typography.caption.fontSize }}>
            {i18n.t('vehicle.transmission')}: {vehicle.transmission}
          </Text>
          <Text style={{ color: theme.color.textMuted, fontSize: theme.typography.caption.fontSize }}>
            {i18n.t('vehicle.fuel')}: {vehicle.fuelType}
          </Text>
        </View>

        <Text
          style={{
            color: theme.color.primary,
            fontSize: theme.typography.title.fontSize,
            fontWeight: '700',
            marginTop: theme.spacing.xs,
          }}
        >
          ${vehicle.pricePerDay}{' '}
          <Text style={{ color: theme.color.textMuted, fontSize: theme.typography.caption.fontSize, fontWeight: '400' }}>
            {i18n.t('browse.perDay')}
          </Text>
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  imageWrapper: {
    width: '100%',
    height: 160,
  },
  image: {
    width: '100%',
    height: 160,
  },
  imagePlaceholder: {
    width: '100%',
    height: 160,
  },
  body: {
    padding: 16,
  },
  meta: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
});
