import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../lib/ThemeContext';

export default function AdminScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [isAdmin, setIsAdmin] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('flagged'); // 'flagged' | 'appeals'
  const [reports, setReports] = useState([]);
  const [fetchingData, setFetchingData] = useState(false);

  useEffect(() => {
    checkAdminAccess();
  }, []);

  const checkAdminAccess = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigation.goBack();
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single();

      if (error || !data?.is_admin) {
        navigation.goBack();
      } else {
        setIsAdmin(true);
      }
    } catch (err) {
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchReports();
    }
  }, [isAdmin, activeTab]);

  const fetchReports = async () => {
    setFetchingData(true);
    try {
      const statusFilter = activeTab === 'flagged' ? 'flagged' : 'appealed';
      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .eq('moderation_status', statusFilter)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setReports(data || []);
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setFetchingData(false);
    }
  };

  const handleAction = async (reportId, actionType) => {
    try {
      setFetchingData(true);
      let newStatus = '';
      if (actionType === 'approve') newStatus = 'approved';
      if (actionType === 'hide') newStatus = 'hidden';
      if (actionType === 'restore') newStatus = 'approved';
      if (actionType === 'deny') newStatus = 'hidden';

      const { error } = await supabase
        .from('reports')
        .update({ 
          moderation_status: newStatus,
          moderated_at: new Date().toISOString()
        })
        .eq('id', reportId);
      
      if (error) throw error;
      fetchReports();
    } catch (err) {
      Alert.alert('Error', err.message);
      setFetchingData(false);
    }
  };

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{item.title}</Text>
      <Text style={styles.cardDescription}>{item.description}</Text>
      
      {item.spam_reasoning ? (
        <View style={styles.reasoningBox}>
          <Text style={styles.reasoningLabel}>AI Reasoning ({item.spam_confidence}%):</Text>
          <Text style={styles.reasoningText}>{item.spam_reasoning}</Text>
        </View>
      ) : null}

      {activeTab === 'appeals' && item.appeal_message ? (
        <View style={styles.reasoningBox}>
          <Text style={styles.reasoningLabel}>Appeal Message:</Text>
          <Text style={styles.reasoningText}>{item.appeal_message}</Text>
        </View>
      ) : null}

      <View style={styles.actionRow}>
        {activeTab === 'flagged' ? (
          <>
            <TouchableOpacity style={[styles.btn, styles.btnApprove]} onPress={() => handleAction(item.id, 'approve')}>
              <Text style={styles.btnText}>Approve</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.btnHide]} onPress={() => handleAction(item.id, 'hide')}>
              <Text style={styles.btnText}>Hide</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity style={[styles.btn, styles.btnApprove]} onPress={() => handleAction(item.id, 'restore')}>
              <Text style={styles.btnText}>Restore</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.btnHide]} onPress={() => handleAction(item.id, 'deny')}>
              <Text style={styles.btnText}>Deny</Text>
            </TouchableOpacity>
          </>
        )}
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

  if (!isAdmin) return null;

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Admin Triage</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.tabRow}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'flagged' && styles.activeTab]}
          onPress={() => setActiveTab('flagged')}
        >
          <Text style={[styles.tabText, activeTab === 'flagged' && styles.activeTabText]}>Flagged</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'appeals' && styles.activeTab]}
          onPress={() => setActiveTab('appeals')}
        >
          <Text style={[styles.tabText, activeTab === 'appeals' && styles.activeTabText]}>Appeals</Text>
        </TouchableOpacity>
      </View>

      {fetchingData ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      ) : (
        <FlatList
          data={reports}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No {activeTab} reports.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: '#ffffff', borderBottomWidth: 1, borderColor: '#e2e8f0' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  tabRow: { flexDirection: 'row', backgroundColor: '#ffffff', borderBottomWidth: 1, borderColor: '#e2e8f0' },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  activeTab: { borderBottomWidth: 2, borderColor: '#2563eb' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#64748b' },
  activeTabText: { color: '#2563eb' },
  listContent: { padding: 16 },
  card: { backgroundColor: '#ffffff', padding: 16, borderRadius: 8, marginBottom: 16, elevation: 1, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 2 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a', marginBottom: 4 },
  cardDescription: { fontSize: 14, color: '#334155', marginBottom: 12 },
  reasoningBox: { backgroundColor: '#fee2e2', padding: 12, borderRadius: 6, marginBottom: 12 },
  reasoningLabel: { fontSize: 12, fontWeight: '700', color: '#991b1b', marginBottom: 4 },
  reasoningText: { fontSize: 13, color: '#7f1d1d' },
  actionRow: { flexDirection: 'row', gap: 12 },
  btn: { flex: 1, paddingVertical: 10, borderRadius: 6, alignItems: 'center' },
  btnApprove: { backgroundColor: '#10b981' },
  btnHide: { backgroundColor: '#ef4444' },
  btnText: { color: '#ffffff', fontWeight: '700', fontSize: 14 },
  emptyContainer: { padding: 40, alignItems: 'center' },
  emptyText: { color: '#64748b', fontSize: 16 }
});
