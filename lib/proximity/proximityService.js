import { BLE_NATIVE_ENABLED } from './bleNativeEnabled';
import * as gpsService from './gpsProximityService';

let bleService = null;
let isBleAvailable = false;
let isBlePermissionsGranted = false;

export function initialize() {
  if (BLE_NATIVE_ENABLED) {
    try {
      const mod = require('./bleService.impl.native.js');
      bleService = mod.getBleProximityService();
      isBleAvailable = mod.isBleHardwareAvailable();
    } catch {
      bleService = null;
      isBleAvailable = false;
    }
  }
}

export function isHardwareAvailable() {
  // Always true because if BLE is missing, we fallback to GPS which is always available (pending location permissions)
  return true;
}

export function getBlePermissionsGranted() {
  return isBlePermissionsGranted;
}

export async function start(token) {
  if (bleService && isBleAvailable) {
    try {
      await bleService.start();
      if (typeof bleService.isBlePermissionsGranted === 'function') {
        isBlePermissionsGranted = bleService.isBlePermissionsGranted();
      }
      return; // Successfully started BLE
    } catch (e) {
      // BLE start failed, fallback to GPS
    }
  }
  
  // Fallback to GPS proximity
  await gpsService.start(token);
}

export async function stop() {
  if (bleService) {
    try {
      await bleService.stop();
    } catch {}
  }
  await gpsService.stop();
}

export async function stopScanning() {
  if (bleService && typeof bleService.stopScanning === 'function') {
    try {
      await bleService.stopScanning();
    } catch {}
  }
  await gpsService.stopScanning();
}
