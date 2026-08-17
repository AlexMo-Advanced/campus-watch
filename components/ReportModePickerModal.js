import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import React from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  REPORT_MODE_INSTANT,
  REPORT_MODE_STANDARD,
} from '../lib/reportPreferences';
import { useReportMode } from '../lib/ReportModeContext';
import { useFeedback } from '../lib/useFeedback';
import { useTranslation } from 'react-i18next';
import { useLockdown } from '../lib/LockdownContext';

export default function ReportModePickerModal({ navigation }) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { pickerVisible, closePicker, launchReport, preference, setPreference } = useReportMode();
  const { tabPress, medium } = useFeedback();
  const { setReportingActive } = useLockdown();

  const handleSelect = (mode) => {
    medium();
    setReportingActive(true);
    launchReport(mode);
    closePicker();
    navigation.navigate('Report Incident');
  };

  return (
    <Modal visible={pickerVisible} transparent animationType="fade" onRequestClose={closePicker}>
      <Pressable style={styles.backdrop} onPress={closePicker}>
        <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFillObject} />
      </Pressable>

      <View style={[styles.sheetWrap, { paddingBottom: insets.bottom + 16 }]} pointerEvents="box-none">
        <Animated.View entering={FadeInDown.duration(280).springify()} style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>{t('reportModePicker.title')}</Text>
          <Text style={styles.subtitle}>{t('reportModePicker.subtitle')}</Text>

          <TouchableOpacity
            style={[styles.optionCard, preference === REPORT_MODE_INSTANT && styles.optionCardDefault]}
            activeOpacity={0.85}
            onPress={() => handleSelect(REPORT_MODE_INSTANT)}
          >
            <View style={[styles.optionIcon, styles.optionIconInstant]}>
              <Ionicons name="camera" size={24} color="#ffffff" />
            </View>
            <View style={styles.optionBody}>
              <Text style={styles.optionTitle}>{t('reportModePicker.instantTitle')}</Text>
              <Text style={styles.optionDesc}>{t('reportModePicker.instantSub')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.optionCard, preference === REPORT_MODE_STANDARD && styles.optionCardDefault]}
            activeOpacity={0.85}
            onPress={() => handleSelect(REPORT_MODE_STANDARD)}
          >
            <View style={[styles.optionIcon, styles.optionIconStandard]}>
              <Ionicons name="document-text" size={24} color="#ffffff" />
            </View>
            <View style={styles.optionBody}>
              <Text style={styles.optionTitle}>{t('reportModePicker.standardTitle')}</Text>
              <Text style={styles.optionDesc}>{t('reportModePicker.standardSubFull')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
          </TouchableOpacity>

          <Animated.View entering={FadeIn.delay(120).duration(300)} style={styles.defaultSection}>
            <Text style={styles.defaultLabel}>{t('reportModePicker.defaultWhenTap')}</Text>
            <View style={styles.defaultRow}>
              <TouchableOpacity
                style={[styles.defaultChip, preference === REPORT_MODE_INSTANT && styles.defaultChipActive]}
                onPress={() => setPreference(REPORT_MODE_INSTANT)}
                onPressIn={tabPress}
              >
                <Ionicons
                  name="camera-outline"
                  size={14}
                  color={preference === REPORT_MODE_INSTANT ? '#ffffff' : '#64748b'}
                />
                <Text style={[styles.defaultChipText, preference === REPORT_MODE_INSTANT && styles.defaultChipTextActive]}>
                  {t('settings.quickPhoto')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.defaultChip, preference === REPORT_MODE_STANDARD && styles.defaultChipActive]}
                onPress={() => setPreference(REPORT_MODE_STANDARD)}
                onPressIn={tabPress}
              >
                <Ionicons
                  name="document-text-outline"
                  size={14}
                  color={preference === REPORT_MODE_STANDARD ? '#ffffff' : '#64748b'}
                />
                <Text style={[styles.defaultChipText, preference === REPORT_MODE_STANDARD && styles.defaultChipTextActive]}>
                  {t('settings.standard')}
                </Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject },
  sheetWrap: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
  },
  sheet: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -4 },
    elevation: 16,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#e2e8f0',
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: { fontSize: 18, fontWeight: '800', color: '#0f172a', marginBottom: 4 },
  subtitle: { fontSize: 13, color: '#64748b', marginBottom: 18 },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    marginBottom: 10,
    backgroundColor: '#f8fafc',
  },
  optionCardDefault: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  optionIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionIconInstant: { backgroundColor: '#2563eb' },
  optionIconStandard: { backgroundColor: '#475569' },
  optionBody: { flex: 1 },
  optionTitle: { fontSize: 15, fontWeight: '800', color: '#0f172a', marginBottom: 2 },
  optionDesc: { fontSize: 12, color: '#64748b', lineHeight: 16 },
  defaultSection: {
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  defaultLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  defaultRow: { flexDirection: 'row', gap: 8 },
  defaultChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  defaultChipActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  defaultChipText: { fontSize: 13, fontWeight: '700', color: '#64748b' },
  defaultChipTextActive: { color: '#ffffff' },
});
