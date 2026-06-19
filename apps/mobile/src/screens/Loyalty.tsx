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
import type { LoyaltyEntryDTO } from '@car-rental/types';
import { getLoyalty, type LoyaltyData } from '@/api/client';
import { i18n } from '@/i18n';

export function LoyaltyScreen() {
  const theme = useTheme();
  const isRtl = i18n.locale === 'ar';
  const [data, setData] = useState<LoyaltyData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await getLoyalty();
    setData(result);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const renderEntry = ({ item }: { item: LoyaltyEntryDTO }) => {
    const isPositive = item.delta > 0;
    return (
      <View
        style={[
          styles.entryRow,
          {
            paddingVertical: theme.spacing.sm,
            paddingHorizontal: theme.spacing.md,
            borderBottomColor: theme.color.border,
          },
        ]}
      >
        <View style={{ flex: 1 }}>
          <Text
            style={{
              color: theme.color.text,
              fontSize: theme.typography.body.fontSize,
              textAlign: isRtl ? 'right' : 'left',
            }}
          >
            {item.reason}
          </Text>
          <Text
            style={{
              color: theme.color.textMuted,
              fontSize: theme.typography.caption.fontSize,
              textAlign: isRtl ? 'right' : 'left',
            }}
          >
            {new Date(item.createdAt).toLocaleDateString(i18n.locale)}
          </Text>
        </View>
        <Text
          style={{
            color: isPositive ? theme.color.success : theme.color.danger,
            fontSize: theme.typography.body.fontSize,
            fontWeight: '700',
            marginStart: theme.spacing.sm,
          }}
        >
          {isPositive ? '+' : ''}{item.delta}
        </Text>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.color.background }]}>
      {/* Header */}
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
        {i18n.t('loyalty.title')}
      </Text>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.color.primary} />
          <Text style={{ color: theme.color.textMuted, marginTop: theme.spacing.sm }}>
            {i18n.t('loyalty.loading')}
          </Text>
        </View>
      ) : (
        <>
          {/* Balance card */}
          <View
            style={[
              styles.balanceCard,
              {
                backgroundColor: theme.color.primary,
                borderRadius: theme.radius.card,
                marginHorizontal: theme.spacing.md,
                marginBottom: theme.spacing.md,
                padding: theme.spacing.md,
                ...theme.elevation.sm,
              },
            ]}
          >
            <Text
              style={{
                color: theme.color.onPrimary,
                fontSize: theme.typography.caption.fontSize,
                opacity: 0.8,
                textAlign: 'center',
              }}
            >
              {i18n.t('loyalty.balance')}
            </Text>
            <Text
              style={{
                color: theme.color.onPrimary,
                fontSize: 40,
                fontWeight: '800',
                textAlign: 'center',
                marginTop: 4,
              }}
            >
              {data?.account.points ?? 0}
              <Text style={{ fontSize: theme.typography.body.fontSize, fontWeight: '400' }}>
                {' '}{i18n.t('loyalty.points')}
              </Text>
            </Text>
          </View>

          {/* History */}
          <Text
            style={{
              color: theme.color.textMuted,
              fontSize: theme.typography.caption.fontSize,
              fontWeight: '600',
              paddingHorizontal: theme.spacing.md,
              marginBottom: theme.spacing.xs,
              textAlign: isRtl ? 'right' : 'left',
            }}
          >
            {i18n.t('loyalty.history')}
          </Text>

          {!data?.entries.length ? (
            <View style={styles.center}>
              <Text style={{ color: theme.color.textMuted }}>{i18n.t('loyalty.empty')}</Text>
              <Pressable style={{ marginTop: theme.spacing.md }} onPress={() => void load()}>
                <Text style={{ color: theme.color.primary, fontWeight: '600' }}>
                  {i18n.t('bookingList.retry')}
                </Text>
              </Pressable>
            </View>
          ) : (
            <FlatList
              data={data.entries}
              keyExtractor={(item) => item.id}
              renderItem={renderEntry}
              style={{ backgroundColor: theme.color.surface }}
              showsVerticalScrollIndicator={false}
            />
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  balanceCard: {},
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
