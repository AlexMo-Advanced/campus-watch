import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WIDGET_CATALOG } from '../../lib/dashboardLayout';
import { useFeedback } from '../../lib/useFeedback';

export default function AddWidgetSheet({ visible, layout, onClose, onAdd, silent = false }) {
  const insets = useSafeAreaInsets();
  const { tap } = useFeedback({ silent });
  const usedTypes = new Set(layout.map((w) => w.type));
  const available = Object.values(WIDGET_CATALOG);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <BlurView intensity={35} tint="dark" style={StyleSheet.absoluteFillObject} />
      </Pressable>
      <View style={[styles.sheetWrap, { paddingBottom: insets.bottom + 12 }]} pointerEvents="box-none">
        <Animated.View entering={FadeInDown.springify()} style={styles.sheet}>
          <Text style={styles.title}>Add Widget</Text>
          <Text style={styles.subtitle}>Choose a widget for your home screen</Text>
          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            {available.map((item) => {
              const count = [...usedTypes].filter((t) => t === item.type).length;
              const disabled = item.type === 'security_index' && count > 0;
              return (
                <TouchableOpacity
                  key={item.type}
                  style={[styles.row, disabled && styles.rowDisabled]}
                  disabled={disabled}
                  onPress={() => {
                    tap();
                    onAdd(item.type);
                    onClose();
                  }}
                  onPressIn={tap}
                >
                  <View style={styles.iconWrap}>
                    <Ionicons name={item.icon} size={20} color="#2563eb" />
                  </View>
                  <View style={styles.rowBody}>
                    <Text style={styles.rowTitle}>{item.title}</Text>
                    <Text style={styles.rowDesc}>{item.description}</Text>
                  </View>
                  <Ionicons name="add-circle" size={22} color={disabled ? '#94a3b8' : '#2563eb'} />
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject },
  sheetWrap: { flex: 1, justifyContent: 'flex-end', paddingHorizontal: 16 },
  sheet: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 16,
    maxHeight: '72%',
  },
  title: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  subtitle: { fontSize: 13, color: '#64748b', marginBottom: 12 },
  list: { maxHeight: 420 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0',
  },
  rowDisabled: { opacity: 0.45 },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: { flex: 1 },
  rowTitle: { fontSize: 14, fontWeight: '800', color: '#0f172a' },
  rowDesc: { fontSize: 12, color: '#64748b', marginTop: 2 },
  cancelBtn: { alignItems: 'center', paddingVertical: 14 },
  cancelText: { fontSize: 15, fontWeight: '700', color: '#64748b' },
});
