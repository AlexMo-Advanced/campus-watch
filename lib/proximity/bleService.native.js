/** Native BLE stub — Metro .native.js entry; real impl gated by bleNativeEnabled.js */
import { BLE_NATIVE_ENABLED } from './bleNativeEnabled';

const disabled = {
  start: async () => {},
  stop: async () => {},
  stopScanning: async () => {},
};

export function getBleProximityService() {
  if (!BLE_NATIVE_ENABLED) return disabled;
  try {
    return require('./bleService.impl.native.js').getBleProximityService();
  } catch {
    return disabled;
  }
}

export function isBleHardwareAvailable() {
  if (!BLE_NATIVE_ENABLED) return false;
  try {
    return require('./bleService.impl.native.js').isBleHardwareAvailable();
  } catch {
    return false;
  }
}
