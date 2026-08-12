import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

const QUEUE_KEY = '@campus_watch_report_queue';

export async function enqueueReport(payload) {
  const queue = await getQueue();
  const entry = { ...payload, _queuedAt: new Date().toISOString(), _id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}` };
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify([...queue, entry]));
}

export async function getQueue() {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function flushQueue() {
  const queue = await getQueue();
  if (!queue.length) return 0;

  const failed = [];
  let flushed = 0;

  for (const entry of queue) {
    const { _queuedAt, _id, ...payload } = entry;
    try {
      const { error } = await supabase.from('reports').insert([payload]);
      if (error) throw error;
      flushed++;
    } catch {
      failed.push(entry);
    }
  }

  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(failed));
  return flushed;
}

export async function getQueueCount() {
  const queue = await getQueue();
  return queue.length;
}
