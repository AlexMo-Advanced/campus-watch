import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function AiBriefingModal({ visible, report, generatedAt, onClose }) {
  const insets = useSafeAreaInsets();

  if (!report) return null;

  const timeLabel = generatedAt
    ? generatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <LinearGradient colors={['#0f172a', '#1e3a5f', '#1d4ed8']} style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <View style={styles.headerLeft}>
            <View style={styles.iconBadge}>
              <Ionicons name="sparkles" size={18} color="#ffffff" />
            </View>
            <View>
              <Text style={styles.title}>AI Campus Briefing</Text>
              <Text style={styles.subtitle}>PinayAI · {timeLabel}</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} accessibilityLabel="Close briefing">
            <Ionicons name="close" size={24} color="#e0f2fe" />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.body}>{report}</Text>
        </ScrollView>
      </LinearGradient>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(147,197,253,0.25)',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(37,99,235,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: '#f0f9ff', fontSize: 18, fontWeight: '800' },
  subtitle: { color: '#93c5fd', fontSize: 12, fontWeight: '600', marginTop: 2 },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(15,23,42,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 20 },
  body: {
    color: '#dbeafe',
    fontSize: 16,
    lineHeight: 26,
    fontWeight: '500',
  },
});
