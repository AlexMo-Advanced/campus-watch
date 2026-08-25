import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function RecentReportsWidget({ width, height }) {
  // If the widget is extremely small (e.g. 3x3 on 12-col grid), hide some text or adjust padding
  const isSmall = width <= 4 || height <= 4;
  
  return (
    <View style={[styles.container, isSmall && { padding: 6 }]}>
      <View style={styles.header}>
        <Ionicons name="list" size={isSmall ? 14 : 16} color="#3b82f6" />
        <Text style={[styles.title, isSmall && { fontSize: 12 }]} numberOfLines={1}>
          Recent Reports
        </Text>
      </View>
      <View style={styles.content}>
        <Text style={[styles.placeholderText, isSmall && { fontSize: 10 }]} numberOfLines={2}>
          {isSmall ? 'Activity feed' : 'Recent activity feed'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 4
  },
  title: {
    fontWeight: '600',
    fontSize: 14,
    color: '#1e293b',
    flexShrink: 1
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  placeholderText: {
    color: '#64748b',
    fontSize: 12,
    textAlign: 'center'
  }
});
