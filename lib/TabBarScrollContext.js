import React, { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Easing, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

const TabBarScrollContext = createContext(null);

const HIDE_SPRING = { damping: 28, stiffness: 320 };
const SHOW_TIMING = { duration: 180, easing: Easing.out(Easing.cubic) };

export function TabBarScrollProvider({ children }) {
  const tabBarOffset = useSharedValue(0);
  const hiddenLockCountRef = useRef(0);
  const [hiddenLockCount, setHiddenLockCount] = useState(0);

  const showTabBar = useCallback(() => {
    if (hiddenLockCountRef.current > 0) return;
    tabBarOffset.value = withTiming(0, SHOW_TIMING);
  }, [tabBarOffset]);

  const hideTabBar = useCallback(() => {
    tabBarOffset.value = withSpring(1, HIDE_SPRING);
  }, [tabBarOffset]);

  const lockTabBarHidden = useCallback(() => {
    hiddenLockCountRef.current += 1;
    setHiddenLockCount(hiddenLockCountRef.current);
    hideTabBar();
  }, [hideTabBar]);

  const unlockTabBarHidden = useCallback(() => {
    hiddenLockCountRef.current = Math.max(0, hiddenLockCountRef.current - 1);
    setHiddenLockCount(hiddenLockCountRef.current);
    if (hiddenLockCountRef.current === 0) {
      tabBarOffset.value = withTiming(0, SHOW_TIMING);
    }
  }, [tabBarOffset]);

  const value = useMemo(
    () => ({
      tabBarOffset,
      hiddenLockCount,
      showTabBar,
      hideTabBar,
      lockTabBarHidden,
      unlockTabBarHidden,
    }),
    [tabBarOffset, hiddenLockCount, showTabBar, hideTabBar, lockTabBarHidden, unlockTabBarHidden]
  );

  return (
    <TabBarScrollContext.Provider value={value}>
      {children}
    </TabBarScrollContext.Provider>
  );
}

export function useTabBarOffset() {
  return useContext(TabBarScrollContext)?.tabBarOffset ?? null;
}

export function useTabBarScrollControls() {
  const ctx = useContext(TabBarScrollContext);
  return {
    tabBarOffset: ctx?.tabBarOffset ?? null,
    hiddenLockCount: ctx?.hiddenLockCount ?? 0,
    showTabBar: ctx?.showTabBar,
    hideTabBar: ctx?.hideTabBar,
    lockTabBarHidden: ctx?.lockTabBarHidden,
    unlockTabBarHidden: ctx?.unlockTabBarHidden,
  };
}

/** Keep the tab bar fully hidden while `active` is true (survives child remounts). */
export function useTabBarHiddenLock(active) {
  const { lockTabBarHidden, unlockTabBarHidden, showTabBar } = useTabBarScrollControls();

  useLayoutEffect(() => {
    if (!active) return undefined;
    lockTabBarHidden?.();
    return () => {
      unlockTabBarHidden?.();
      showTabBar?.();
    };
  }, [active, lockTabBarHidden, unlockTabBarHidden, showTabBar]);
}

/** Attach to ScrollView / FlatList to auto-hide the tab bar while scrolling down. */
export function useTabBarScrollHandler() {
  const ctx = useContext(TabBarScrollContext);
  const lastY = useRef(0);

  const onScroll = useCallback(
    (event) => {
      if (!ctx || ctx.hiddenLockCount > 0) return;

      const y = event.nativeEvent.contentOffset.y;

      if (y <= 8) {
        ctx.showTabBar();
      } else if (y > lastY.current + 10) {
        ctx.hideTabBar();
      } else if (y < lastY.current - 10) {
        ctx.showTabBar();
      }

      lastY.current = y;
    },
    [ctx]
  );

  if (!ctx) {
    return { onScroll: undefined, scrollEventThrottle: 16 };
  }

  return { onScroll, scrollEventThrottle: 16 };
}
