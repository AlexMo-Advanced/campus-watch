import NetInfo from '@react-native-community/netinfo';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

const NetworkContext = createContext({ isOnline: true, wasOffline: false });

export function NetworkProvider({ children }) {
  const [isOnline, setIsOnline] = useState(true);
  const wasOfflineRef = useRef(false);
  const [wasOffline, setWasOffline] = useState(false);

  const handleChange = useCallback((state) => {
    const online = !!(state.isConnected && state.isInternetReachable !== false);
    if (!online) wasOfflineRef.current = true;
    if (online && wasOfflineRef.current) {
      setWasOffline(true);
      // Reset after consumers have had a chance to react
      setTimeout(() => setWasOffline(false), 3000);
    }
    setIsOnline(online);
  }, []);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(handleChange);
    NetInfo.fetch().then(handleChange);
    return unsubscribe;
  }, [handleChange]);

  return (
    <NetworkContext.Provider value={{ isOnline, wasOffline }}>
      {children}
    </NetworkContext.Provider>
  );
}

export function useNetwork() {
  return useContext(NetworkContext);
}
