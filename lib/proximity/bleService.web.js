/** Web stub — BLE proximity is mobile-only. */

export function getBleProximityService() {
  return {
    start: async () => {},
    stop: async () => {},
  };
}

export function isBleHardwareAvailable() {
  return false;
}
