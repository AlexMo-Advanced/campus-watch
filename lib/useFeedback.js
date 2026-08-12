import { useCallback, useMemo } from 'react';
import { useHaptics } from './HapticsContext';
import { useSounds } from './SoundsContext';

/** Combined haptic + sound feedback for UI interactions. */
export function useFeedback() {
  const haptics = useHaptics();
  const sounds = useSounds();

  const wrap = useCallback(
    (hapticFn, soundName) => () => {
      hapticFn();
      if (soundName) sounds.play(soundName);
    },
    [sounds]
  );

  return useMemo(
    () => ({
      ...haptics,
      tap: wrap(haptics.tap, 'tap'),
      tabPress: wrap(haptics.tabPress, 'tabPress'),
      tabLongPress: wrap(haptics.tabLongPress, 'tabLongPress'),
      tabDragSnap: wrap(haptics.tabDragSnap, 'tabDragSnap'),
      barPress: wrap(haptics.barPress, 'barPress'),
      medium: wrap(haptics.medium, 'medium'),
      success: wrap(haptics.success, 'success'),
      warning: wrap(haptics.warning, 'warning'),
      error: wrap(haptics.error, 'error'),
      aiSend: wrap(haptics.aiSend, 'aiSend'),
      aiReply: wrap(haptics.aiReply, 'aiReply'),
      like: () => {
        haptics.tap();
        sounds.play('like');
      },
    }),
    [haptics, sounds, wrap]
  );
}
