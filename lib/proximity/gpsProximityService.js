import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { supabase } from '../supabase';
import { haversineMeters } from '../notifications';
import { recordSeenToken } from './tokenCache';

const GPS_BROADCAST_INTERVAL_MS = 20000;
const NEARBY_RADIUS_M = 150;
const BACKGROUND_PROXIMITY_TASK = 'BACKGROUND_PROXIMITY_TASK';

let intervalId = null;
let broadcastChannel = null;
let currentToken = null;
let myLastLocation = null;

TaskManager.defineTask(BACKGROUND_PROXIMITY_TASK, async ({ data, error }) => {
  if (error) {
    return;
  }
  if (data) {
    const { locations } = data;
    if (locations && locations.length > 0) {
      const loc = locations[locations.length - 1];
      if (currentToken) {
        try {
          await supabase.functions.invoke('ble-heartbeat', {
            body: {
              token: currentToken,
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
            },
          });
        } catch {
          // fail silently in background
        }
      }
    }
  }
});

export async function start(token) {
  if (!token) return;
  currentToken = token;

  if (intervalId) return;

  const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
  if (fgStatus !== 'granted') return;

  const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();

  // Start background location tracking if granted
  if (bgStatus === 'granted') {
    const hasStarted = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_PROXIMITY_TASK);
    if (!hasStarted) {
      await Location.startLocationUpdatesAsync(BACKGROUND_PROXIMITY_TASK, {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: GPS_BROADCAST_INTERVAL_MS,
        distanceInterval: 10,
        foregroundService: {
          notificationTitle: 'CampusWatch Proximity',
          notificationBody: 'Checking for nearby alerts in the background',
          notificationColor: '#2563eb',
        },
      });
    }
  }

  broadcastChannel = supabase.channel('proximity:broadcasts', {
    config: { broadcast: { self: false } },
  });

  broadcastChannel
    .on('broadcast', { event: 'location' }, (payload) => {
      const data = payload.payload;
      if (!data || !data.token || data.token === currentToken) return;
      if (!myLastLocation) return;

      const dist = haversineMeters(
        myLastLocation.latitude,
        myLastLocation.longitude,
        data.latitude,
        data.longitude
      );

      if (dist <= NEARBY_RADIUS_M) {
        recordSeenToken(data.token);
      }
    })
    .subscribe();

  const updateAndBroadcast = async () => {
    try {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      myLastLocation = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      };
      if (broadcastChannel && currentToken) {
        broadcastChannel.send({
          type: 'broadcast',
          event: 'location',
          payload: {
            token: currentToken,
            latitude: myLastLocation.latitude,
            longitude: myLastLocation.longitude,
          },
        });
      }
    } catch {
      // location might be temporarily unavailable
    }
  };

  // Initial update
  updateAndBroadcast();

  intervalId = setInterval(updateAndBroadcast, GPS_BROADCAST_INTERVAL_MS);
}

export async function stop() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  if (broadcastChannel) {
    supabase.removeChannel(broadcastChannel);
    broadcastChannel = null;
  }
  try {
    const hasStarted = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_PROXIMITY_TASK);
    if (hasStarted) {
      await Location.stopLocationUpdatesAsync(BACKGROUND_PROXIMITY_TASK);
    }
  } catch {}
  
  currentToken = null;
  myLastLocation = null;
}

export async function stopScanning() {
  // We do NOT stop the background service when stopScanning is called, 
  // because we want the background task to continue updating location.
  // We only stop the foreground broadcasting interval to save some battery.
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  if (broadcastChannel) {
    supabase.removeChannel(broadcastChannel);
    broadcastChannel = null;
  }
}

