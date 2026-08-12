import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { captureReportGraphic, shareReportToPlatform } from '../lib/shareReport';
import { useFeedback } from '../lib/useFeedback';
import ReportShareCard from './ReportShareCard';

const PLATFORMS = [
  { key: 'instagram', label: 'Instagram', icon: 'logo-instagram', color: '#E1306C' },
  { key: 'facebook', label: 'Facebook', icon: 'logo-facebook', color: '#1877F2' },
  { key: 'tiktok', label: 'TikTok', icon: 'logo-tiktok', color: '#010101' },
  { key: 'snapchat', label: 'Snapchat', icon: 'logo-snapchat', color: '#FFFC00' },
  { key: 'more', label: 'More', icon: 'share-social-outline', color: '#2563eb' },
];

export default function ShareReportSheet({ visible, report, isDark, onClose }) {
  const insets = useSafeAreaInsets();
  const { tap, medium, success, error: hapticError } = useFeedback();
  const cardRef = useRef(null);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    if (!visible) setSharing(false);
  }, [visible]);

  const handleShare = async (platform) => {
    if (!report || sharing) return;
    medium();
    setSharing(true);
    try {
      await new Promise((r) => setTimeout(r, 120));
      const uri = await captureReportGraphic(cardRef);
      await shareReportToPlatform(platform, uri, report);
      success();
      onClose?.();
    } catch (err) {
      hapticError();
      console.error('Share error:', err.message);
    } finally {
      setSharing(false);
    }
  };

  return (
    <>
      <ReportShareCard ref={cardRef} report={visible ? report : null} />

      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <Pressable style={styles.backdrop} onPress={onClose}>
          <BlurView intensity={40} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFillObject} />
        </Pressable>

        <View style={[styles.sheetWrap, { paddingBottom: insets.bottom + 16 }]} pointerEvents="box-none">
          <Animated.View
            entering={FadeInDown.duration(280).springify()}
            style={[styles.sheet, isDark && styles.sheetDark]}
          >
            <View style={styles.handle} />
            <Text style={[styles.title, isDark && styles.titleDark]}>Share Incident Report</Text>
            <Text style={[styles.subtitle, isDark && styles.subtitleDark]}>
              Export a formatted graphic with full details and location
            </Text>

            <View style={styles.platformGrid}>
              {PLATFORMS.map((platform) => (
                <TouchableOpacity
                  key={platform.key}
                  style={styles.platformBtn}
                  onPress={() => handleShare(platform.key)}
                  onPressIn={tap}
                  disabled={sharing}
                  activeOpacity={0.8}
                >
                  <View style={[styles.platformIcon, { backgroundColor: `${platform.color}18` }]}>
                    <Ionicons
                      name={platform.icon}
                      size={24}
                      color={platform.key === 'snapchat' ? '#ca8a04' : platform.color}
                    />
                  </View>
                  <Text style={[styles.platformLabel, isDark && styles.platformLabelDark]}>
                    {platform.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {sharing && (
              <View style={styles.loadingRow}>
                <ActivityIndicator color="#2563eb" />
                <Text style={[styles.loadingText, isDark && styles.subtitleDark]}>Preparing graphic…</Text>
              </View>
            )}

            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>
    </>
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
    paddingBottom: 16,
  },
  sheetDark: { backgroundColor: '#1e293b' },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#cbd5e1',
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: { fontSize: 18, fontWeight: '800', color: '#0f172a', marginBottom: 4 },
  titleDark: { color: '#f8fafc' },
  subtitle: { fontSize: 13, color: '#64748b', marginBottom: 20, lineHeight: 18 },
  subtitleDark: { color: '#94a3b8' },
  platformGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  platformBtn: { width: '18%', minWidth: 64, alignItems: 'center', gap: 6 },
  platformIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  platformLabel: { fontSize: 11, fontWeight: '700', color: '#334155', textAlign: 'center' },
  platformLabelDark: { color: '#cbd5e1' },
  loadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 8 },
  loadingText: { fontSize: 13, color: '#64748b', fontWeight: '600' },
  cancelBtn: { alignItems: 'center', paddingVertical: 12 },
  cancelText: { fontSize: 15, fontWeight: '700', color: '#64748b' },
});
