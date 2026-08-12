import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { NOTIFICATION_TYPE_SOUND, SOUND_ASSETS } from './soundAssets';

const EFFECTS_KEY = '@campus_watch_sound_effects_enabled';
const NOTIFICATIONS_KEY = '@campus_watch_notification_sounds_enabled';

const SoundsContext = createContext(null);

export function SoundsProvider({ children }) {
  const [effectsEnabled, setEffectsEnabledState] = useState(true);
  const [notificationsEnabled, setNotificationsEnabledState] = useState(true);
  const poolRef = useRef({});
  const readyRef = useRef(false);

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(EFFECTS_KEY),
      AsyncStorage.getItem(NOTIFICATIONS_KEY),
    ]).then(([effects, notifications]) => {
      if (effects !== null) setEffectsEnabledState(effects === '1');
      if (notifications !== null) setNotificationsEnabledState(notifications === '1');
    });

    Audio.setAudioModeAsync({
      playsInSilentModeIOS: false,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    }).catch(() => {});

    return () => {
      Object.values(poolRef.current).forEach((sound) => {
        sound.unloadAsync().catch(() => {});
      });
      poolRef.current = {};
    };
  }, []);

  const playAsset = useCallback(async (asset, volume = 0.55) => {
    if (Platform.OS === 'web' || !asset) return;
    try {
      const key = String(asset);
      let sound = poolRef.current[key];
      if (!sound) {
        const created = await Audio.Sound.createAsync(asset, { volume, shouldPlay: false });
        sound = created.sound;
        poolRef.current[key] = sound;
        readyRef.current = true;
      } else {
        await sound.setPositionAsync(0);
      }
      await sound.setVolumeAsync(volume);
      await sound.replayAsync();
    } catch {
      // Simulator or missing asset — ignore quietly.
    }
  }, []);

  const play = useCallback(
    (name) => {
      if (!effectsEnabled) return;
      const asset = SOUND_ASSETS[name];
      if (asset) playAsset(asset);
    },
    [effectsEnabled, playAsset]
  );

  const preview = useCallback(
    (name) => {
      const asset = SOUND_ASSETS[name] || SOUND_ASSETS.tap;
      playAsset(asset, 0.6);
    },
    [playAsset]
  );

  const setEffectsEnabled = useCallback(async (value) => {
    setEffectsEnabledState(value);
    await AsyncStorage.setItem(EFFECTS_KEY, value ? '1' : '0');
    if (value) preview('tap');
  }, [preview]);

  const setNotificationsEnabled = useCallback(async (value) => {
    setNotificationsEnabledState(value);
    await AsyncStorage.setItem(NOTIFICATIONS_KEY, value ? '1' : '0');
  }, []);

  const getNotificationSound = useCallback(
    (type) => {
      if (!notificationsEnabled) return null;
      return NOTIFICATION_TYPE_SOUND[type] || NOTIFICATION_TYPE_SOUND.default;
    },
    [notificationsEnabled]
  );

  const value = useMemo(
    () => ({
      effectsEnabled,
      notificationsEnabled,
      setEffectsEnabled,
      setNotificationsEnabled,
      play,
      preview,
      getNotificationSound,
    }),
    [effectsEnabled, notificationsEnabled, setEffectsEnabled, setNotificationsEnabled, play, preview, getNotificationSound]
  );

  return <SoundsContext.Provider value={value}>{children}</SoundsContext.Provider>;
}

export function useSounds() {
  const ctx = useContext(SoundsContext);
  if (!ctx) {
    throw new Error('useSounds must be used within SoundsProvider');
  }
  return ctx;
}
