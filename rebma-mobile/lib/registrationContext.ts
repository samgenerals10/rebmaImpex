// rebma-mobile/lib/registrationContext.ts
//
// What gets recorded about the device and place someone registers from,
// for the CEO to review before approving (see
// supabase_registration_details.sql). The server adds the network address
// and an approximate location itself, so this only covers what the phone
// knows: the device, and a GPS position if the person allows it.
//
// GPS is asked for, never required. A refusal or a timeout just records
// why, and the CEO sees the approximate network location instead.
import { Platform, Dimensions } from 'react-native';
import * as Device from 'expo-device';
import * as Location from 'expo-location';
import Constants from 'expo-constants';

export interface RegistrationDevice {
  kind?: string; platform?: string; os?: string; osVersion?: string; model?: string;
  manufacturer?: string; browser?: string; appVersion?: string; userAgent?: string; screen?: string;
}
export interface RegistrationLocation {
  latitude?: number; longitude?: number; accuracy?: number; address?: string; source?: string; refusedReason?: string;
}

const KIND: Record<number, string> = {
  [Device.DeviceType.PHONE]: 'Phone',
  [Device.DeviceType.TABLET]: 'Tablet',
  [Device.DeviceType.DESKTOP]: 'Computer',
  [Device.DeviceType.TV]: 'TV',
};

function browserName(ua: string): string | undefined {
  if (/Edg\//.test(ua)) return 'Edge';
  if (/OPR\//.test(ua)) return 'Opera';
  if (/Firefox\//.test(ua)) return 'Firefox';
  if (/Chrome\//.test(ua)) return 'Chrome';
  if (/Safari\//.test(ua)) return 'Safari';
  return undefined;
}

export function getRegistrationDevice(): RegistrationDevice {
  const { width, height } = Dimensions.get('screen');
  const ua = Platform.OS === 'web' && typeof navigator !== 'undefined' ? navigator.userAgent : '';
  return {
    kind: (Device.deviceType != null && KIND[Device.deviceType]) || (Platform.OS === 'web' ? 'Computer or browser' : 'Unknown'),
    platform: Platform.OS === 'web' ? 'Web browser' : Platform.OS === 'ios' ? 'iPhone app' : Platform.OS === 'android' ? 'Android app' : Platform.OS,
    os: Device.osName || undefined,
    osVersion: Device.osVersion || undefined,
    model: Device.modelName || undefined,
    manufacturer: Device.manufacturer || Device.brand || undefined,
    browser: ua ? browserName(ua) : undefined,
    appVersion: Constants.expoConfig?.version || undefined,
    userAgent: ua || undefined,
    screen: `${Math.round(width)} x ${Math.round(height)}`,
  };
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([p, new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))]);
}

export async function getRegistrationLocation(): Promise<RegistrationLocation> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return { refusedReason: 'Location permission was not given.' };
    const pos = await withTimeout(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }), 15000);
    const result: RegistrationLocation = {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      accuracy: pos.coords.accuracy != null ? Math.round(pos.coords.accuracy) : undefined,
      source: 'GPS',
    };
    // Street address is a bonus; not available on every platform (web).
    try {
      const [place] = await withTimeout(Location.reverseGeocodeAsync({ latitude: result.latitude!, longitude: result.longitude! }), 8000);
      if (place) {
        result.address = [place.name || [place.streetNumber, place.street].filter(Boolean).join(' '), place.district, place.city, place.region, place.country]
          .filter((v, i, a) => v && a.indexOf(v) === i)
          .join(', ') || undefined;
      }
    } catch { /* coordinates alone are still useful */ }
    return result;
  } catch (e: any) {
    return { refusedReason: e?.message === 'timeout' ? 'Location took too long to find.' : 'Location could not be read on this device.' };
  }
}
