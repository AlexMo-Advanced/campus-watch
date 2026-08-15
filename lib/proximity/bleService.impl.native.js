import { Platform } from 'react-native';
import {
  CAMPUSWATCH_MANUFACTURER_ID,
  HEARTBEAT_INTERVAL_MS,
  SCAN_PURGE_INTERVAL_MS,
  TOKEN_ROTATION_MS,
  TOKEN_SEEN_TTL_MS,
} from './constants';
import { clearTokenCache, purgeExpiredTokens, recordSeenToken } from './tokenCache';
import { generateEphemeralToken, sendProximityHeartbeat } from './proximityApi';

let BleManagerClass = undefined;

function loadBleManagerClass() {
  if (BleManagerClass !== undefined) return BleManagerClass;
  if (Platform.OS === 'web') {
    BleManagerClass = null;
    return null;
  }
  try {
    const { NativeModules } = require('react-native');
    if (!NativeModules.BlePlx) {
      BleManagerClass = null;
      return null;
    }
    BleManagerClass = require('react-native-ble-plx').BleManager;
  } catch {
    BleManagerClass = null;
  }
  return BleManagerClass;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function bytesToToken(bytes) {
  if (!bytes || bytes.length !== 16) return null;
  const hex = bytes.map((b) => b.toString(16).padStart(2, '0')).join('');
  const token = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  return UUID_RE.test(token) ? token : null;
}

function parseManufacturerToken(manufacturerData) {
  if (!manufacturerData) return null;
  try {
    let bytes;
    if (typeof manufacturerData === 'string') {
      bytes = Uint8Array.from(atob(manufacturerData), (c) => c.charCodeAt(0));
    } else if (manufacturerData instanceof Uint8Array) {
      bytes = manufacturerData;
    } else {
      return null;
    }
    if (bytes.length < 18) return null;
    const companyId = bytes[0] | (bytes[1] << 8);
    if (companyId !== CAMPUSWATCH_MANUFACTURER_ID) return null;
    return bytesToToken(Array.from(bytes.slice(2, 18)));
  } catch {
    return null;
  }
}

function parseLocalNameToken(localName) {
  if (!localName || !localName.startsWith('cw:')) return null;
  const token = localName.slice(3);
  return UUID_RE.test(token) ? token : null;
}

class BleProximityService {
  constructor() {
    this.manager = null;
    this.managerInitAttempted = false;
    this.running = false;
    this.currentToken = null;
    this.rotationTimer = null;
    this.heartbeatTimer = null;
    this.purgeTimer = null;
    this.scanning = false;
  }

  getManager() {
    if (this.managerInitAttempted) return this.manager;
    this.managerInitAttempted = true;
    const BleManager = loadBleManagerClass();
    if (!BleManager) return null;
    try {
      this.manager = new BleManager();
    } catch {
      this.manager = null;
    }
    return this.manager;
  }

  async start() {
    if (this.running) return;
    this.running = true;
    await this.rotateToken();
    await this.startScanning();
    this.rotationTimer = setInterval(() => {
      this.rotateToken().catch(() => {});
    }, TOKEN_ROTATION_MS);
    this.heartbeatTimer = setInterval(() => {
      if (this.currentToken) {
        sendProximityHeartbeat(this.currentToken).catch(() => {});
      }
    }, HEARTBEAT_INTERVAL_MS);
    this.purgeTimer = setInterval(() => {
      purgeExpiredTokens(TOKEN_SEEN_TTL_MS);
    }, SCAN_PURGE_INTERVAL_MS);
  }

  async stop() {
    this.running = false;
    if (this.rotationTimer) clearInterval(this.rotationTimer);
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.purgeTimer) clearInterval(this.purgeTimer);
    this.rotationTimer = null;
    this.heartbeatTimer = null;
    this.purgeTimer = null;
    await this.stopScanning();
    this.currentToken = null;
    clearTokenCache();
  }

  async rotateToken() {
    const next = generateEphemeralToken();
    this.currentToken = next;
    await sendProximityHeartbeat(next);
  }

  async startScanning() {
    const manager = this.getManager();
    if (!manager || this.scanning || !this.running) return;
    try {
      const state = await manager.state();
      if (state !== 'PoweredOn') return;
      this.scanning = true;
      manager.startDeviceScan(null, { allowDuplicates: true }, (error, device) => {
        if (error || !device || !this.running) return;
        const fromManufacturer = parseManufacturerToken(device.manufacturerData);
        const fromName = parseLocalNameToken(device.localName);
        const token = fromManufacturer || fromName;
        if (token && token !== this.currentToken) {
          recordSeenToken(token);
        }
      });
    } catch {
      this.scanning = false;
    }
  }

  async stopScanning() {
    const manager = this.getManager();
    if (!manager || !this.scanning) return;
    try {
      manager.stopDeviceScan();
    } catch {
      // ignore
    }
    this.scanning = false;
  }
}

let singleton = null;

export function getBleProximityService() {
  if (!singleton) singleton = new BleProximityService();
  return singleton;
}

export function isBleHardwareAvailable() {
  return loadBleManagerClass() != null;
}
