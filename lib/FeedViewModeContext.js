import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  FEED_VIEW_LIST,
  getStoredFeedViewMode,
  setStoredFeedViewMode,
} from './feedViewPreferences';

const FeedViewModeContext = createContext(null);

export function FeedViewModeProvider({ children }) {
  const [mode, setModeState] = useState(FEED_VIEW_LIST);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    getStoredFeedViewMode().then((stored) => {
      setModeState(stored);
      setReady(true);
    });
  }, []);

  const setMode = useCallback(async (newMode) => {
    setModeState(newMode);
    await setStoredFeedViewMode(newMode);
  }, []);

  const value = useMemo(
    () => ({ mode, ready, setMode }),
    [mode, ready, setMode]
  );

  return (
    <FeedViewModeContext.Provider value={value}>
      {children}
    </FeedViewModeContext.Provider>
  );
}

export function useFeedViewMode() {
  const ctx = useContext(FeedViewModeContext);
  if (!ctx) {
    throw new Error('useFeedViewMode must be used within FeedViewModeProvider');
  }
  return ctx;
}
