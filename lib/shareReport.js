import * as Sharing from 'expo-sharing';
import { Alert, Linking, Platform, Share } from 'react-native';
import { captureRef } from 'react-native-view-shot';

const SHARE_MESSAGE = (report) =>
  `Campus Watch Alert: ${report.title}\n` +
  `${report.severity ? `Severity: ${report.severity} · ` : ''}` +
  `Location: ${report.location || 'Campus'}\n\n` +
  `${report.description || ''}\n\n` +
  `#CampusWatch #CampusSafety`;

export async function captureReportGraphic(viewRef) {
  if (!viewRef?.current) throw new Error('Share card not ready.');
  const uri = await captureRef(viewRef, {
    format: 'png',
    quality: 1,
    result: 'tmpfile',
  });
  return uri;
}

export async function shareReportImage(uri, report) {
  const message = SHARE_MESSAGE(report);

  if (Platform.OS === 'web') {
    await Share.share({ message, url: uri });
    return;
  }

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(uri, {
      mimeType: 'image/png',
      dialogTitle: 'Share Campus Alert',
      UTI: 'public.png',
    });
    return;
  }

  await Share.share({ message, url: uri });
}

export async function shareReportToPlatform(platform, uri, report) {
  const message = SHARE_MESSAGE(report);

  switch (platform) {
    case 'instagram': {
      if (Platform.OS === 'ios') {
        const canOpen = await Linking.canOpenURL('instagram://app');
        if (canOpen) {
          await shareReportImage(uri, report);
          await Linking.openURL('instagram://app');
          return;
        }
      }
      await shareReportImage(uri, report);
      return;
    }
    case 'facebook': {
      const fbUrl = Platform.select({
        ios: 'fb://',
        android: 'fb://facewebmodal/f?href=https://facebook.com',
        default: 'https://facebook.com',
      });
      await shareReportImage(uri, report);
      if (fbUrl && (await Linking.canOpenURL(fbUrl))) {
        await Linking.openURL(fbUrl);
      }
      return;
    }
    case 'tiktok': {
      await shareReportImage(uri, report);
      const tiktok = Platform.OS === 'ios' ? 'tiktok://' : 'snssdk1233://';
      if (await Linking.canOpenURL(tiktok)) {
        await Linking.openURL(tiktok);
      }
      return;
    }
    case 'snapchat': {
      await shareReportImage(uri, report);
      const snap = 'snapchat://';
      if (await Linking.canOpenURL(snap)) {
        await Linking.openURL(snap);
      }
      return;
    }
    case 'more':
    default:
      await shareReportImage(uri, report);
  }
}

export async function shareCommentText(comment, report) {
  const body =
    `"${comment.text}"\n\n` +
    `— on "${report?.title || 'Campus Alert'}"\n` +
    `#CampusWatch`;

  try {
    await Share.share({ message: body });
  } catch {
    Alert.alert('Share', 'Could not open share sheet.');
  }
}

export { SHARE_MESSAGE };
