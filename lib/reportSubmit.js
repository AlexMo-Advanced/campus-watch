import * as Location from 'expo-location';
import { checkToxicity } from './gemini';
import { dispatchProximityAlerts } from './proximity/proximityApi';
import { supabase } from './supabase';

export async function uploadReportImage(uri, userId) {
  if (!uri) return null;
  if (uri.startsWith('http')) return uri;

  const response = await fetch(uri);
  const blob = await response.blob();
  const arrayBuffer = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsArrayBuffer(blob);
  });

  const fileExt = uri.split('.').pop()?.toLowerCase() || 'jpeg';
  const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
  const filePath = `${userId}/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('reports')
    .upload(filePath, arrayBuffer, {
      contentType: `image/${fileExt}`,
    });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from('reports').getPublicUrl(filePath);
  return data.publicUrl;
}

export async function captureCurrentLocation() {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') return null;

  const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  const { latitude, longitude } = loc.coords;

  let locationLabel = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
  try {
    const geocoded = await Location.reverseGeocodeAsync({ latitude, longitude });
    if (geocoded.length > 0) {
      const addr = geocoded[0];
      const parts = [addr.name, addr.street, addr.district, addr.city].filter(Boolean);
      if (parts.length) locationLabel = parts.join(', ');
    }
  } catch {
    // keep coordinate label
  }

  return { latitude, longitude, locationLabel };
}

export async function submitReport({
  title,
  category,
  severity,
  location,
  description,
  imageUri,
  isAnonymous = true,
  latitude = null,
  longitude = null,
  nearbyTokens = [],
}) {
  if (!location?.trim() || !description?.trim()) {
    throw new Error('Please add a location and description.');
  }

  try {
    const { isToxic, reason } = await checkToxicity(`${title} ${description}`);
    if (isToxic) {
      throw new Error(reason || 'Your report contains inappropriate content. Please revise it.');
    }
  } catch (err) {
    if (err.message?.includes('inappropriate') || err.message?.includes('Blocked')) {
      throw err;
    }
  }

  const { data: { user } } = await supabase.auth.getUser();

  let publicImageUrl = null;
  if (imageUri) {
    publicImageUrl = await uploadReportImage(imageUri, user ? user.id : 'anonymous');
  }

  const payload = {
    title: (title || description.slice(0, 60)).trim(),
    category,
    severity,
    location: location.trim(),
    description: description.trim(),
    is_anonymous: isAnonymous,
    image_url: publicImageUrl,
    status: 'pending',
    user_id: user ? user.id : null,
  };

  if (latitude !== null && longitude !== null) {
    payload.latitude = latitude;
    payload.longitude = longitude;
  }

  const { data, error } = await supabase.from('reports').insert([payload]).select('id').single();
  if (error) throw error;

  await dispatchProximityAlerts(data.id, nearbyTokens).catch(() => {});

  return { ...payload, id: data.id };
}
