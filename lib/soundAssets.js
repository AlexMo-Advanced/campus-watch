/**
 * Sound file registry — swap files in assets/sounds/ to use your own audio.
 * Supported formats: .wav (best for notifications), .mp3 also works for in-app SFX.
 * Keep filenames the same OR update the requires below.
 */

export const SOUND_ASSETS = {
  tap: require('../assets/sounds/tap.wav'),
  tabPress: require('../assets/sounds/tab_press.wav'),
  tabLongPress: require('../assets/sounds/tab_long_press.wav'),
  tabDragSnap: require('../assets/sounds/tab_press.wav'),
  barPress: require('../assets/sounds/bar_press.wav'),
  medium: require('../assets/sounds/medium.wav'),
  success: require('../assets/sounds/success.wav'),
  warning: require('../assets/sounds/warning.wav'),
  error: require('../assets/sounds/error.wav'),
  like: require('../assets/sounds/like.wav'),
  send: require('../assets/sounds/send.wav'),
  reportSubmitted: require('../assets/sounds/report_submitted.wav'),
  aiSend: require('../assets/sounds/send.wav'),
  aiReply: require('../assets/sounds/success.wav'),
};

/** Bundled notification sounds (need EAS build after adding/changing). */
export const NOTIFICATION_SOUND_FILES = {
  default: 'alert.wav',
  alert: 'alert.wav',
  comment: 'comment.wav',
  like: 'like_notification.wav',
  success: 'success.wav',
};

export const NOTIFICATION_TYPE_SOUND = {
  nearby_situation: 'alert.wav',
  report_comment: 'comment.wav',
  comment_reply: 'comment.wav',
  comment_like: 'like_notification.wav',
  report_like: 'like_notification.wav',
  alert_resolved: 'success.wav',
  alert_deleted: 'tap.wav',
  nearby_critical: 'alert.wav',
  nearby_high: 'alert.wav',
};
