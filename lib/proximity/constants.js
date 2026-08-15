/** Privacy-first BLE proximity constants — no user identifiers in broadcasts. */

export const PROXIMITY_OPT_IN_KEY = '@campus_watch_proximity_alerts_enabled';

/** Fixed CampusWatch BLE service UUID (never contains user identity). */
export const CAMPUSWATCH_BLE_SERVICE_UUID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

/** Manufacturer ID bytes used to identify CampusWatch advertisements. */
export const CAMPUSWATCH_MANUFACTURER_ID = 0xc007;

export const TOKEN_ROTATION_MS = 15 * 60 * 1000;
export const TOKEN_SEEN_TTL_MS = 5 * 60 * 1000;
export const HEARTBEAT_INTERVAL_MS = 60 * 1000;
export const SCAN_PURGE_INTERVAL_MS = 30 * 1000;

export const TIGHT_RADIUS_M = 50;
export const WIDE_RADIUS_M = 300;
