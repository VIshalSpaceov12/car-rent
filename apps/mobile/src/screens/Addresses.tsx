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
import type { AddressDTO } from '@car-rental/types';
import {
  listAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
} from '@/api/client';
import { i18n } from '@/i18n';

type FormState = {
  label: string;
  line1: string;
  city: string;
  country: string;
  isDefault: boolean;
};

const emptyForm = (): FormState => ({
  label: '',
  line1: '',
  city: '',
  country: '',
  isDefault: false,
});

export function AddressesScreen() {
  const theme = useTheme();
  const isRtl = i18n.locale === 'ar';
  const [addresses, setAddresses] = useState<AddressDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editTarget, setEditTarget] = useState<AddressDTO | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await listAddresses();
    setAddresses(result);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const openAdd = () => {
    setEditTarget(null);
    setForm(emptyForm());
    setModalVisible(true);
  };

  const openEdit = (addr: AddressDTO) => {
    setEditTarget(addr);
    setForm({
      label: addr.label,
      line1: addr.line1,
      city: addr.city,
      country: addr.country,
      isDefault: addr.isDefault,
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    setSaving(true);
    let result: AddressDTO | null;
    if (editTarget) {
      result = await updateAddress(editTarget.id, form);
    } else {
      result = await createAddress(form);
    }
    setSaving(false);
    if (result) {
      setModalVisible(false);
      void load();
    } else {
      Alert.alert(i18n.t('addresses.errorSave'));
    }
  };

  const handleDelete = (addr: AddressDTO) => {
    Alert.alert(
      i18n.t('addresses.deleteConfirmTitle'),
      i18n.t('addresses.deleteConfirmMessage'),
      [
        { text: i18n.t('addresses.deleteConfirmCancel'), style: 'cancel' },
        {
          text: i18n.t('addresses.deleteConfirmOk'),
          style: 'destructive',
          onPress: async () => {
            const ok = await deleteAddress(addr.id);
            if (ok) {
              void load();
            } else {
              Alert.alert(i18n.t('addresses.errorDelete'));
            }
          },
        },
      ],
    );
  };

  const handleSetDefault = async (addr: AddressDTO) => {
    await updateAddress(addr.id, { isDefault: true });
    void load();
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

  const renderAddress = ({ item }: { item: AddressDTO }) => (
    <View
      style={[
        styles.addressCard,
        {
          backgroundColor: theme.color.surface,
          borderRadius: theme.radius.card,
          padding: theme.spacing.md,
          marginBottom: theme.spacing.sm,
          ...theme.elevation.sm,
        },
      ]}
    >
      <View style={styles.cardHeader}>
        <Text
          style={{
            color: theme.color.text,
            fontSize: theme.typography.subtitle.fontSize,
            fontWeight: '700',
            flex: 1,
            textAlign: isRtl ? 'right' : 'left',
          }}
        >
          {item.label}
          {item.isDefault ? (
            <Text style={{ color: theme.color.primary, fontWeight: '400', fontSize: theme.typography.caption.fontSize }}>
              {' '}({i18n.t('addresses.defaultLabel')})
            </Text>
          ) : null}
        </Text>
      </View>
      <Text
        style={{
          color: theme.color.textMuted,
          fontSize: theme.typography.caption.fontSize,
          textAlign: isRtl ? 'right' : 'left',
          marginBottom: theme.spacing.xs,
        }}
      >
        {item.line1}, {item.city}, {item.country}
      </Text>
      <View style={[styles.actionRow, { gap: theme.spacing.sm, marginTop: theme.spacing.xs }]}>
        {!item.isDefault && (
          <Pressable
            onPress={() => void handleSetDefault(item)}
            accessibilityRole="button"
          >
            <Text style={{ color: theme.color.primary, fontSize: theme.typography.caption.fontSize, fontWeight: '600' }}>
              {i18n.t('addresses.setDefault')}
            </Text>
          </Pressable>
        )}
        <Pressable onPress={() => openEdit(item)} accessibilityRole="button">
          <Text style={{ color: theme.color.primary, fontSize: theme.typography.caption.fontSize, fontWeight: '600' }}>
            {i18n.t('addresses.edit')}
          </Text>
        </Pressable>
        <Pressable onPress={() => handleDelete(item)} accessibilityRole="button">
          <Text style={{ color: theme.color.danger, fontSize: theme.typography.caption.fontSize, fontWeight: '600' }}>
            {i18n.t('addresses.delete')}
          </Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.color.background }]}>
      {/* Header row */}
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
          {i18n.t('addresses.title')}
        </Text>
        <Pressable
          onPress={openAdd}
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
            {i18n.t('addresses.add')}
          </Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.color.primary} />
          <Text style={{ color: theme.color.textMuted, marginTop: theme.spacing.sm }}>
            {i18n.t('addresses.loading')}
          </Text>
        </View>
      ) : addresses.length === 0 ? (
        <View style={styles.center}>
          <Text style={{ color: theme.color.textMuted }}>{i18n.t('addresses.empty')}</Text>
        </View>
      ) : (
        <FlatList
          data={addresses}
          keyExtractor={(item) => item.id}
          renderItem={renderAddress}
          contentContainerStyle={{ padding: theme.spacing.md, paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Add / Edit Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
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
                {editTarget ? i18n.t('addresses.edit') : i18n.t('addresses.add')}
              </Text>

              <Text style={{ color: theme.color.textMuted, fontSize: theme.typography.caption.fontSize, marginBottom: 4, textAlign: isRtl ? 'right' : 'left' }}>
                {i18n.t('addresses.label')}
              </Text>
              <TextInput
                style={inputStyle}
                value={form.label}
                onChangeText={(v) => setForm((f) => ({ ...f, label: v }))}
                placeholder={i18n.t('addresses.label')}
                placeholderTextColor={theme.color.textMuted}
                accessibilityLabel={i18n.t('addresses.label')}
              />

              <Text style={{ color: theme.color.textMuted, fontSize: theme.typography.caption.fontSize, marginBottom: 4, textAlign: isRtl ? 'right' : 'left' }}>
                {i18n.t('addresses.line1')}
              </Text>
              <TextInput
                style={inputStyle}
                value={form.line1}
                onChangeText={(v) => setForm((f) => ({ ...f, line1: v }))}
                placeholder={i18n.t('addresses.line1')}
                placeholderTextColor={theme.color.textMuted}
                accessibilityLabel={i18n.t('addresses.line1')}
              />

              <Text style={{ color: theme.color.textMuted, fontSize: theme.typography.caption.fontSize, marginBottom: 4, textAlign: isRtl ? 'right' : 'left' }}>
                {i18n.t('addresses.city')}
              </Text>
              <TextInput
                style={inputStyle}
                value={form.city}
                onChangeText={(v) => setForm((f) => ({ ...f, city: v }))}
                placeholder={i18n.t('addresses.city')}
                placeholderTextColor={theme.color.textMuted}
                accessibilityLabel={i18n.t('addresses.city')}
              />

              <Text style={{ color: theme.color.textMuted, fontSize: theme.typography.caption.fontSize, marginBottom: 4, textAlign: isRtl ? 'right' : 'left' }}>
                {i18n.t('addresses.country')}
              </Text>
              <TextInput
                style={inputStyle}
                value={form.country}
                onChangeText={(v) => setForm((f) => ({ ...f, country: v }))}
                placeholder={i18n.t('addresses.country')}
                placeholderTextColor={theme.color.textMuted}
                accessibilityLabel={i18n.t('addresses.country')}
              />

              {/* Default toggle */}
              <Pressable
                onPress={() => setForm((f) => ({ ...f, isDefault: !f.isDefault }))}
                style={[
                  styles.checkRow,
                  {
                    borderColor: form.isDefault ? theme.color.primary : theme.color.border,
                    borderRadius: theme.radius.input,
                    padding: theme.spacing.sm,
                    marginBottom: theme.spacing.md,
                  },
                ]}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: form.isDefault }}
              >
                <View
                  style={[
                    styles.checkbox,
                    {
                      backgroundColor: form.isDefault ? theme.color.primary : theme.color.surface,
                      borderColor: theme.color.border,
                      borderRadius: 4,
                    },
                  ]}
                />
                <Text style={{ color: theme.color.text, fontSize: theme.typography.body.fontSize, marginStart: theme.spacing.sm }}>
                  {i18n.t('addresses.setDefault')}
                </Text>
              </Pressable>

              <View style={[styles.modalActions, { gap: theme.spacing.sm }]}>
                <Pressable
                  style={[
                    styles.modalBtn,
                    {
                      backgroundColor: saving ? theme.color.border : theme.color.primary,
                      borderRadius: theme.radius.input,
                    },
                  ]}
                  onPress={() => void handleSave()}
                  disabled={saving}
                  accessibilityRole="button"
                >
                  {saving ? (
                    <ActivityIndicator color={theme.color.onPrimary} />
                  ) : (
                    <Text style={{ color: theme.color.onPrimary, fontWeight: '700' }}>
                      {i18n.t('addresses.save')}
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
                    {i18n.t('addresses.cancel')}
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
  addressCard: {},
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  actionRow: { flexDirection: 'row', alignItems: 'center' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    maxHeight: '90%',
  },
  checkRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1 },
  checkbox: { width: 20, height: 20, borderWidth: 1 },
  modalActions: { flexDirection: 'row' },
  modalBtn: { flex: 1, paddingVertical: 14, alignItems: 'center' },
});
