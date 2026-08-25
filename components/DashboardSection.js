import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Modal, TouchableWithoutFeedback } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import WidgetGrid from './grid/WidgetGrid';
import WidgetPickerSheet from './widgets/WidgetPickerSheet';
import { WidgetRegistry } from './widgets/WidgetRegistry';
import { useWidgetLayout } from '../lib/useWidgetLayout';

export default function DashboardSection({ userId, colors }) {
  const [isEditing, setIsEditing] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  
  const { layout: savedLayout, loading, saveLayout } = useWidgetLayout(userId);
  const [localLayout, setLocalLayout] = useState([]);

  // Sync local layout when saved layout loads
  useEffect(() => {
    setLocalLayout(savedLayout);
  }, [savedLayout]);

  const handleLayoutChange = (id, updates) => {
    setLocalLayout(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
  };

  const handleAddWidget = (type) => {
    const info = WidgetRegistry[type];
    // Find empty spot ideally, but for now just place at bottom (x: 0, y: roughly max y)
    const maxY = localLayout.reduce((max, item) => Math.max(max, item.grid_y + item.height), 0);
    
    const newWidget = {
      id: Math.random().toString(), // Temp ID, will be replaced by DB
      widget_type: type,
      grid_x: 0,
      grid_y: maxY,
      width: info.defaultWidth,
      height: info.defaultHeight
    };
    
    setLocalLayout([...localLayout, newWidget]);
    setShowPicker(false);
  };

  const handleRemoveWidget = (id) => {
    setLocalLayout(prev => prev.filter(item => item.id !== id));
  };

  const toggleEdit = () => {
    if (isEditing) {
      // Save
      saveLayout(localLayout);
    }
    setIsEditing(!isEditing);
  };

  if (loading) {
    return <View style={styles.container}><Text>Loading dashboard...</Text></View>;
  }

  return (
    <TouchableWithoutFeedback onPress={() => isEditing && toggleEdit()}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.textMain }]}>Dashboard</Text>
          <TouchableOpacity onPress={toggleEdit} style={styles.editBtn}>
            <Text style={[styles.editBtnText, { color: colors.primary }]}>
              {isEditing ? 'Done' : 'Edit Layout'}
            </Text>
          </TouchableOpacity>
        </View>

        <WidgetGrid 
          layout={localLayout}
          isEditing={isEditing}
          onLayoutChange={handleLayoutChange}
          onRemove={handleRemoveWidget}
        />

        {isEditing && (
          <TouchableOpacity style={styles.addBtn} onPress={() => setShowPicker(true)}>
            <Ionicons name="add-circle" size={48} color={colors.primary} />
            <Text style={[styles.addBtnText, { color: colors.primary }]}>Add Widget</Text>
          </TouchableOpacity>
        )}

        <WidgetPickerSheet 
          visible={showPicker} 
          onClose={() => setShowPicker(false)}
          onAddWidget={handleAddWidget}
        />

        {/* Fixed Trash Bin Overlay */}
        <Modal visible={isEditing} transparent animationType="fade">
          <View style={styles.trashOverlay} pointerEvents="none">
            <View style={styles.trashBin}>
              <Ionicons name="trash" size={32} color="#ffffff" />
            </View>
          </View>
        </Modal>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 20
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 10
  },
  title: {
    fontSize: 20,
    fontWeight: '700'
  },
  editBtn: {
    padding: 8
  },
  editBtnText: {
    fontWeight: '600'
  },
  addBtn: {
    alignItems: 'center',
    marginTop: 20
  },
  addBtnText: {
    marginTop: 4,
    fontWeight: '600'
  },
  trashOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 60
  },
  trashBin: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8
  }
});
