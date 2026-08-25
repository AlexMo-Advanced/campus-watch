import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WidgetRegistry } from './WidgetRegistry';

export default function WidgetPickerSheet({ visible, onClose, onAddWidget }) {
  const widgetTypes = Object.keys(WidgetRegistry);

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <SafeAreaView style={styles.sheetContainer}>
          <View style={styles.header}>
            <Text style={styles.title}>Add Widget</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color="#1e293b" />
            </TouchableOpacity>
          </View>
          
          <ScrollView contentContainerStyle={styles.list}>
            {widgetTypes.map(type => {
              const info = WidgetRegistry[type];
              return (
                <TouchableOpacity 
                  key={type} 
                  style={styles.widgetItem}
                  onPress={() => onAddWidget(type)}
                >
                  <View style={styles.widgetIconPlaceholder}>
                    <Ionicons name="add-circle-outline" size={32} color="#3b82f6" />
                  </View>
                  <View style={styles.widgetInfo}>
                    <Text style={styles.widgetName}>{info.name}</Text>
                    <Text style={styles.widgetDesc}>{info.description}</Text>
                    <Text style={styles.widgetSize}>Size: {info.defaultWidth}x{info.defaultHeight}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end'
  },
  sheetContainer: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%'
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0'
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a'
  },
  closeBtn: {
    padding: 4
  },
  list: {
    padding: 16
  },
  widgetItem: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    marginBottom: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  widgetIconPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16
  },
  widgetInfo: {
    flex: 1
  },
  widgetName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4
  },
  widgetDesc: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 4
  },
  widgetSize: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '500'
  }
});
