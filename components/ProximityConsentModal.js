import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../lib/ThemeContext';

export default function ProximityConsentModal({ visible, onAccept, onDecline }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { t } = useTranslation();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDecline}>
      <Pressable style={styles.backdrop} onPress={onDecline}>
        <Pressable
          style={[styles.sheet, { backgroundColor: colors.surface, marginBottom: insets.bottom + 16 }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={[styles.iconWrap, { backgroundColor: colors.primaryLight }]}>
            <Ionicons name="radio-outline" size={28} color={colors.primary} />
          </View>
          <Text style={[styles.title, { color: colors.text }]}>{t('proximity.modalTitle')}</Text>

          <ScrollView style={styles.bodyScroll} showsVerticalScrollIndicator={false}>
            <Text style={[styles.body, { color: colors.textBody }]}>
              <Text style={styles.bold}>{t('proximity.what')}</Text>
              {t('proximity.whatBody')}
            </Text>
            <Text style={[styles.body, { color: colors.textBody }]}>
              <Text style={styles.bold}>{t('proximity.duration')}</Text>
              {t('proximity.durationBody')}
            </Text>
            <Text style={[styles.body, { color: colors.textBody }]}>
              <Text style={styles.bold}>{t('proximity.control')}</Text>
              {t('proximity.controlBody')}
            </Text>
          </ScrollView>

          <View style={styles.actions}>
            <Pressable style={[styles.declineBtn, { borderColor: colors.border }]} onPress={onDecline}>
              <Text style={[styles.declineText, { color: colors.textSecondary }]}>{t('proximity.notNow')}</Text>
            </Pressable>
            <Pressable style={[styles.acceptBtn, { backgroundColor: colors.primary }]} onPress={onAccept}>
              <Text style={styles.acceptText}>{t('proximity.turnOn')}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.55)',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
  },
  sheet: {
    borderRadius: 20,
    padding: 20,
    maxHeight: '78%',
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: { fontSize: 20, fontWeight: '800', marginBottom: 12 },
  bodyScroll: { maxHeight: 260, marginBottom: 16 },
  body: { fontSize: 14, lineHeight: 21, marginBottom: 12 },
  bold: { fontWeight: '800' },
  actions: { flexDirection: 'row', gap: 10 },
  declineBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  declineText: { fontWeight: '800', fontSize: 14 },
  acceptBtn: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  acceptText: { color: '#fff', fontWeight: '800', fontSize: 14 },
});
