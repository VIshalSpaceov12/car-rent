import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
  ScrollView,
} from 'react-native';
import { useTheme } from '@car-rental/tokens';
import type { SupportTicketDTO } from '@car-rental/types';
import { listSupportTickets, createSupportTicket } from '@/api/client';
import { i18n } from '@/i18n';

export function SupportScreen() {
  const theme = useTheme();
  const isRtl = i18n.locale === 'ar';
  const [tickets, setTickets] = useState<SupportTicketDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await listSupportTickets();
    setTickets(result);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleSubmit = async () => {
    if (!subject.trim() || !body.trim()) return;
    setSubmitting(true);
    const ticket = await createSupportTicket({ subject: subject.trim(), body: body.trim() });
    setSubmitting(false);
    if (ticket) {
      setModalVisible(false);
      setSubject('');
      setBody('');
      void load();
    } else {
      Alert.alert(i18n.t('support.errorSubmit'));
    }
  };

  const inputStyle = {
    backgroundColor: theme.color.surface,
    borderColor: theme.color.border,
    borderRadius: theme.radius.input,
    color: theme.color.text,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: theme.spacing.sm,
    textAlign: isRtl ? ('right' as const) : ('left' as const),
  };

  const renderTicket = ({ item }: { item: SupportTicketDTO }) => {
    const isOpen = item.status === 'open';
    return (
      <View
        style={[
          styles.ticketCard,
          {
            backgroundColor: theme.color.surface,
            borderRadius: theme.radius.card,
            padding: theme.spacing.md,
            marginBottom: theme.spacing.sm,
            ...theme.elevation.sm,
          },
        ]}
      >
        {/* Subject + status pill */}
        <View style={styles.headerRow}>
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
            {item.subject}
          </Text>
          <View
            style={[
              styles.statusPill,
              {
                backgroundColor: isOpen ? theme.color.warning : theme.color.success,
                borderRadius: theme.radius.pill ?? 32,
                marginStart: theme.spacing.sm,
              },
            ]}
          >
            <Text style={{ color: theme.color.onPrimary, fontSize: theme.typography.caption.fontSize, fontWeight: '600' }}>
              {isOpen ? i18n.t('support.statusOpen') : i18n.t('support.statusResolved')}
            </Text>
          </View>
        </View>

        <Text
          style={{
            color: theme.color.textMuted,
            fontSize: theme.typography.caption.fontSize,
            textAlign: isRtl ? 'right' : 'left',
            marginTop: theme.spacing.xs,
          }}
          numberOfLines={2}
        >
          {item.body}
        </Text>

        {item.response && (
          <View
            style={[
              styles.responseBox,
              {
                backgroundColor: theme.color.surfaceAlt,
                borderRadius: theme.radius.input,
                padding: theme.spacing.sm,
                marginTop: theme.spacing.sm,
                borderStartWidth: 3,
                borderStartColor: theme.color.primary,
              },
            ]}
          >
            <Text
              style={{
                color: theme.color.textMuted,
                fontSize: theme.typography.caption.fontSize,
                fontWeight: '600',
                marginBottom: 2,
                textAlign: isRtl ? 'right' : 'left',
              }}
            >
              {i18n.t('support.response')}
            </Text>
            <Text
              style={{
                color: theme.color.text,
                fontSize: theme.typography.caption.fontSize,
                textAlign: isRtl ? 'right' : 'left',
              }}
            >
              {item.response}
            </Text>
          </View>
        )}

        <Text
          style={{
            color: theme.color.textMuted,
            fontSize: theme.typography.caption.fontSize,
            textAlign: isRtl ? 'right' : 'left',
            marginTop: theme.spacing.xs,
          }}
        >
          {new Date(item.createdAt).toLocaleDateString(i18n.locale)}
        </Text>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.color.background }]}>
      {/* Header */}
      <View
        style={[
          styles.headerRow,
          {
            paddingHorizontal: theme.spacing.md,
            paddingTop: theme.spacing.md,
            paddingBottom: theme.spacing.sm,
          },
        ]}
      >
        <Text
          style={{
            color: theme.color.text,
            fontSize: theme.typography.title.fontSize,
            fontWeight: '700',
            flex: 1,
            textAlign: isRtl ? 'right' : 'left',
          }}
        >
          {i18n.t('support.title')}
        </Text>
        <Pressable
          onPress={() => setModalVisible(true)}
          style={[
            styles.addButton,
            {
              backgroundColor: theme.color.primary,
              borderRadius: theme.radius.input,
              paddingHorizontal: theme.spacing.md,
              paddingVertical: theme.spacing.xs,
            },
          ]}
          accessibilityRole="button"
        >
          <Text style={{ color: theme.color.onPrimary, fontWeight: '600', fontSize: theme.typography.caption.fontSize }}>
            {i18n.t('support.newTicket')}
          </Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.color.primary} />
          <Text style={{ color: theme.color.textMuted, marginTop: theme.spacing.sm }}>
            {i18n.t('support.loading')}
          </Text>
        </View>
      ) : tickets.length === 0 ? (
        <View style={styles.center}>
          <Text style={{ color: theme.color.textMuted }}>{i18n.t('support.empty')}</Text>
        </View>
      ) : (
        <FlatList
          data={tickets}
          keyExtractor={(item) => item.id}
          renderItem={renderTicket}
          contentContainerStyle={{ padding: theme.spacing.md, paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* New Ticket Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: theme.color.overlay }]}>
          <View
            style={[
              styles.modalContent,
              {
                backgroundColor: theme.color.background,
                borderRadius: theme.radius.card,
                padding: theme.spacing.md,
              },
            ]}
          >
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text
                style={{
                  color: theme.color.text,
                  fontSize: theme.typography.subtitle.fontSize,
                  fontWeight: '700',
                  marginBottom: theme.spacing.md,
                  textAlign: isRtl ? 'right' : 'left',
                }}
              >
                {i18n.t('support.newTicket')}
              </Text>

              <Text style={{ color: theme.color.textMuted, fontSize: theme.typography.caption.fontSize, marginBottom: 4, textAlign: isRtl ? 'right' : 'left' }}>
                {i18n.t('support.subject')}
              </Text>
              <TextInput
                style={inputStyle}
                value={subject}
                onChangeText={setSubject}
                placeholder={i18n.t('support.subject')}
                placeholderTextColor={theme.color.textMuted}
                accessibilityLabel={i18n.t('support.subject')}
              />

              <Text style={{ color: theme.color.textMuted, fontSize: theme.typography.caption.fontSize, marginBottom: 4, textAlign: isRtl ? 'right' : 'left' }}>
                {i18n.t('support.body')}
              </Text>
              <TextInput
                style={[inputStyle, { height: 100, textAlignVertical: 'top' }]}
                value={body}
                onChangeText={setBody}
                placeholder={i18n.t('support.body')}
                placeholderTextColor={theme.color.textMuted}
                multiline
                numberOfLines={4}
                accessibilityLabel={i18n.t('support.body')}
              />

              <View style={[styles.modalActions, { gap: theme.spacing.sm, marginTop: theme.spacing.sm }]}>
                <Pressable
                  style={[
                    styles.modalBtn,
                    {
                      backgroundColor: submitting ? theme.color.border : theme.color.primary,
                      borderRadius: theme.radius.input,
                    },
                  ]}
                  onPress={() => void handleSubmit()}
                  disabled={submitting}
                  accessibilityRole="button"
                >
                  {submitting ? (
                    <ActivityIndicator color={theme.color.onPrimary} />
                  ) : (
                    <Text style={{ color: theme.color.onPrimary, fontWeight: '700' }}>
                      {i18n.t('support.submit')}
                    </Text>
                  )}
                </Pressable>
                <Pressable
                  style={[
                    styles.modalBtn,
                    {
                      backgroundColor: theme.color.surface,
                      borderRadius: theme.radius.input,
                      borderWidth: 1,
                      borderColor: theme.color.border,
                    },
                  ]}
                  onPress={() => setModalVisible(false)}
                  accessibilityRole="button"
                >
                  <Text style={{ color: theme.color.text, fontWeight: '600' }}>
                    {i18n.t('support.cancel')}
                  </Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  addButton: {},
  ticketCard: {},
  statusPill: { paddingHorizontal: 10, paddingVertical: 4 },
  responseBox: {},
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: { maxHeight: '90%' },
  modalActions: { flexDirection: 'row' },
  modalBtn: { flex: 1, paddingVertical: 14, alignItems: 'center' },
});
