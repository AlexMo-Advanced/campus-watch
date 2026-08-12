import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Image,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { Ionicons } from '@expo/vector-icons';

export default function HomeScreen() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchReports = async () => {
    try {
      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setReports(data || []);
    } catch (err) {
      console.error('Error fetching reports:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchReports();

    const subscription = supabase
      .channel('public:reports')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reports' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setReports((prev) => [payload.new, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setReports((prev) =>
              prev.map((item) => (item.id === payload.new.id ? payload.new : item))
            );
          } else if (payload.eventType === 'DELETE') {
            setReports((prev) => prev.filter((item) => item.id === payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  const getStatusColor = (status) => {
    switch (status) {
      case 'resolved':
        return '#16a34a';
      case 'under_review':
        return '#d97706';
      default:
        return '#dc2626';
    }
  };

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      {item.image_url && (
        <Image source={{ uri: item.image_url }} style={styles.cardImage} resizeMode="cover" />
      )}
      <View style={styles.cardBody}>
        <View style={styles.badgeRow}>
          <Text style={styles.categoryBadge}>{item.category}</Text>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
            <Text style={styles.statusText}>{(item.status || 'pending').replace('_', ' ').toUpperCase()}</Text>
          </View>
        </View>

        <Text style={styles.cardTitle}>{item.title}</Text>
        <Text style={styles.cardLocation}>
          <Ionicons name="location-outline" size={14} color="#64748b" /> {item.location}
        </Text>
        <Text style={styles.cardDescription}>{item.description}</Text>

        <Text style={styles.cardFooter}>
          {item.is_anonymous ? 'Submitted Anonymously' : 'Student Report'} •{' '}
          {new Date(item.created_at).toLocaleDateString()}
        </Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={reports}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchReports(); }} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="checkmark-circle-outline" size={48} color="#94a3b8" />
            <Text style={styles.emptyText}>No incident reports recorded yet.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: 16 },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  cardImage: { width: '100%', height: 180 },
  cardBody: { padding: 16 },
  badgeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  categoryBadge: {
    backgroundColor: '#eff6ff',
    color: '#2563eb',
    fontWeight: '700',
    fontSize: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusText: { color: '#ffffff', fontWeight: '700', fontSize: 10 },
  cardTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a', marginBottom: 4 },
  cardLocation: { fontSize: 13, color: '#64748b', marginBottom: 8 },
  cardDescription: { fontSize: 14, color: '#334155', lineHeight: 20, marginBottom: 12 },
  cardFooter: { fontSize: 11, color: '#94a3b8', fontWeight: '500' },
  emptyContainer: { padding: 40, alignItems: 'center', justifyContent: 'center' },
  emptyText: { marginTop: 12, fontSize: 15, color: '#64748b', textAlign: 'center' },
});
