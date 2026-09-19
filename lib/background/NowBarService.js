import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import { supabase } from '../supabase';
import { startLiveNotification } from '../../modules/live-notifications';

const BACKGROUND_NOWBAR_TASK = 'background-nowbar-update';

TaskManager.defineTask(BACKGROUND_NOWBAR_TASK, async () => {
  try {
    const { data: metrics, error } = await supabase
      .from('campus_metrics')
      .select('security_index, brief')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) throw error;
    if (!metrics) return BackgroundFetch.BackgroundFetchResult.NoData;

    // Use user preferences here to check if Now Bar is enabled
    // For now, we assume it's on by default unless toggled off
    
    // Determine the content based on time of day
    const hour = new Date().getHours();
    let title = 'CampusWatch Now';
    let content = '';
    let screen = '';

    if (hour >= 6 && hour < 12) {
      title = 'Morning CampusBrief';
      content = metrics.brief || 'Stay safe this morning.';
      screen = 'brief';
    } else if (hour >= 12 && hour < 17) {
      title = 'Afternoon CampusBrief';
      content = metrics.brief || 'Good afternoon. Campus is active.';
      screen = 'brief';
    } else if (hour >= 17 && hour < 21) {
      title = 'Evening CampusBrief';
      content = metrics.brief || 'Evening brief available.';
      screen = 'brief';
    } else {
      title = 'Night Security Index';
      content = `Current Security Index: ${metrics.security_index}/100`;
      screen = 'dashboard';
    }

    startLiveNotification(title, content, { screen });
    
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error) {
    console.error('Background NowBar error:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export async function registerNowBarTask() {
  try {
    await BackgroundFetch.registerTaskAsync(BACKGROUND_NOWBAR_TASK, {
      minimumInterval: 60 * 60 * 4, // 4 hours
      stopOnTerminate: false,
      startOnBoot: true,
    });
  } catch (err) {
    console.error('NowBar registration failed:', err);
  }
}

export async function unregisterNowBarTask() {
  try {
    await BackgroundFetch.unregisterTaskAsync(BACKGROUND_NOWBAR_TASK);
  } catch (err) {
    console.error('NowBar unregistration failed:', err);
  }
}
