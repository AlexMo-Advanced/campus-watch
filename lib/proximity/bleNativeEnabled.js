/**
 * Native BLE is opt-in at build time. When disabled, proximity uses HTTP heartbeat +
 * geofence matching only (no BleManager / no react-native-ble-plx native calls).
 *
 * Re-enable after a stable EAS build with newArchEnabled: false and ble-plx linked.
 */
export const BLE_NATIVE_ENABLED = false;
