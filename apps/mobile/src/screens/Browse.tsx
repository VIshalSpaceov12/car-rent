import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '@car-rental/tokens';
import type { VehicleDTO } from '@car-rental/types';
import { listVehicles } from '@/api/client';
import { i18n } from '@/i18n';
import { CarListCard } from './components/CarListCard';

type Props = {
  onSelectVehicle: (id: string) => void;
};

export function BrowseScreen({ onSelectVehicle }: Props) {
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const [vehicles, setVehicles] = useState<VehicleDTO[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchVehicles = useCallback((q: string) => {
    setLoading(true);
    listVehicles(q ? { q } : undefined)
      .then(setVehicles)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => fetchVehicles(query), query ? 300 : 0);
    return () => clearTimeout(timer);
  }, [query, fetchVehicles]);

  return (
    <View style={[styles.container, { backgroundColor: theme.color.background }]}>
      <Text
        style={{
          color: theme.color.text,
          fontSize: theme.typography.title.fontSize,
          fontWeight: '700',
          paddingHorizontal: 20,
          paddingTop: 20,
          paddingBottom: 12,
        }}
      >
        {i18n.t('browse.title')}
      </Text>

      <View
        style={[
          styles.searchPill,
          {
            backgroundColor: theme.color.surfaceAlt,
            borderRadius: theme.radius.pill,
            borderColor: theme.color.border,
            marginHorizontal: 20,
            marginBottom: 16,
          },
        ]}
      >
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={i18n.t('browse.searchPlaceholder')}
          placeholderTextColor={theme.color.textMuted}
          style={[
            styles.searchInput,
            {
              color: theme.color.text,
              fontSize: theme.typography.body.fontSize,
            },
          ]}
          returnKeyType="search"
          clearButtonMode="while-editing"
          accessibilityLabel={i18n.t('browse.searchPlaceholder')}
        />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.color.primary} />
          <Text style={{ color: theme.color.textMuted, marginTop: theme.spacing.sm }}>
            {i18n.t('browse.loading')}
          </Text>
        </View>
      ) : (
        <FlatList
          data={vehicles}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <CarListCard vehicle={item} onPress={() => onSelectVehicle(item.id)} />
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={{ color: theme.color.textMuted }}>{i18n.t('browse.empty')}</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchPill: {
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 44,
  },
  searchInput: {
    flex: 1,
    height: 44,
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
});
