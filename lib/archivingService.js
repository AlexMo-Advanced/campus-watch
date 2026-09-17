import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import NetInfo from '@react-native-community/netinfo';
import { AppState } from 'react-native';
import { supabase } from './supabase';

const ARCHIVE_DIR = `${FileSystem.documentDirectory}archive/`;
const ARCHIVE_INDEX_KEY = 'campus_watch_archived_reports';

const ensureDir = async (dir) => {
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
};

export const initArchivingService = () => {
  NetInfo.addEventListener(state => {
    if (state.isConnected && state.isInternetReachable) {
      syncPendingArchives();
    }
  });

  AppState.addEventListener('change', nextAppState => {
    if (nextAppState === 'active') {
      syncPendingArchives();
    }
  });
};

export const syncPendingArchives = async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Fetch reports archived but not yet acked or recently acked (fallback check)
    const { data: reports, error } = await supabase
      .from('reports')
      .select('*')
      .eq('user_id', user.id)
      .eq('archived', true);

    if (error) throw error;
    if (!reports || reports.length === 0) return;

    const existingIndexStr = await AsyncStorage.getItem(ARCHIVE_INDEX_KEY);
    const existingIndex = existingIndexStr ? JSON.parse(existingIndexStr) : {};

    for (const report of reports) {
      if (!existingIndex[report.id]) {
        // Not in local archive yet, download it
        await ensureDir(`${ARCHIVE_DIR}${report.id}/`);
        
        let localImageUrls = [];
        const remoteUrls = report.image_urls || (report.image_url ? [report.image_url] : []);
        
        for (let i = 0; i < remoteUrls.length; i++) {
          const remoteUrl = remoteUrls[i];
          const ext = remoteUrl.split('.').pop() || 'jpg';
          const localUri = `${ARCHIVE_DIR}${report.id}/image_${i}.${ext}`;
          
          const { uri } = await FileSystem.downloadAsync(remoteUrl, localUri);
          localImageUrls.push(uri);
        }

        const localRecord = {
          ...report,
          local_image_urls: localImageUrls,
          archived_to_device_at: new Date().toISOString()
        };

        existingIndex[report.id] = localRecord;
        await AsyncStorage.setItem(ARCHIVE_INDEX_KEY, JSON.stringify(existingIndex));

        // Call ack
        await supabase.rpc('ack_archive_sync', { p_report_id: report.id });
      }
    }
  } catch (err) {
    console.error('Error syncing pending archives:', err);
  }
};

export const getArchivedReports = async () => {
  try {
    const existingIndexStr = await AsyncStorage.getItem(ARCHIVE_INDEX_KEY);
    const existingIndex = existingIndexStr ? JSON.parse(existingIndexStr) : {};
    return Object.values(existingIndex).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  } catch {
    return [];
  }
};

export const restoreArchivedReport = async (reportId) => {
  try {
    const existingIndexStr = await AsyncStorage.getItem(ARCHIVE_INDEX_KEY);
    const existingIndex = existingIndexStr ? JSON.parse(existingIndexStr) : {};
    const localRecord = existingIndex[reportId];
    
    if (!localRecord) throw new Error("Report not found locally");
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not logged in");

    // 1. Re-upload images if they were cleared
    let remoteUrls = [];
    for (const localUri of localRecord.local_image_urls || []) {
      const response = await fetch(localUri);
      const blob = await response.blob();
      const arrayBuffer = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsArrayBuffer(blob);
      });
      const fileExt = localUri.split('.').pop()?.toLowerCase() || 'jpeg';
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;
      const { error: uploadError } = await supabase.storage.from('reports').upload(filePath, arrayBuffer, {
        contentType: `image/${fileExt}`,
      });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from('reports').getPublicUrl(filePath);
      remoteUrls.push(data.publicUrl);
    }

    // 2. Un-archive in DB
    const { error: updateError } = await supabase
      .from('reports')
      .update({
        archived: false,
        archived_at: null,
        expiration_date: null, // Reset expiration
        image_urls: remoteUrls.length > 0 ? remoteUrls : null,
        image_url: remoteUrls.length > 0 ? remoteUrls[0] : null
      })
      .eq('id', reportId);

    if (updateError) throw updateError;

    // 3. Remove from local archive index
    delete existingIndex[reportId];
    await AsyncStorage.setItem(ARCHIVE_INDEX_KEY, JSON.stringify(existingIndex));
    
    // Optional: remove files from local storage
    try {
      await FileSystem.deleteAsync(`${ARCHIVE_DIR}${reportId}/`, { idempotent: true });
    } catch (e) {
      console.warn("Failed to delete local archive dir", e);
    }

  } catch (err) {
    console.error('Error restoring archived report:', err);
    throw err;
  }
};
