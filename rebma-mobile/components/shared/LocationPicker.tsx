// rebma-mobile/components/shared/LocationPicker.tsx
//
// Phase 7.3, D20. Ports rebma-web/src/components/dispatch/DestinationLocator.tsx's
// real, dependency-free capabilities — free-text → Nominatim geocode,
// raw "lat, lng" paste, and GPS "use my current location" (reverse
// geocoded back to an address) — WITHOUT the drop-a-pin-on-a-Leaflet-map
// interaction, which needs an actual embedded map. Per Phase 7.1's D8
// (no embedded native map without a dev client — react-native-maps/
// expo-maps both require one, and Phase 7.0's plan already deferred all
// EAS/native-folder work to a later "platform hardening" phase), that one
// piece is dropped; resolving an address or GPS fix to coordinates is a
// plain fetch()/expo-location call and is fully preserved.
//
// Shared between CreateOrderScreen (order destination) and the customer
// form (GPS location) — built once here.
import { useState } from 'react';
import { View, Text, Alert } from 'react-native';
import * as Location from 'expo-location';
import { Search, MapPin, LocateFixed } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeProvider';
import Input from '../ui/Input';
import Button from '../ui/Button';

export interface LocationValue {
  address: string;
  lat: number;
  lng: number;
}

interface Props {
  value: LocationValue | null;
  onChange: (value: LocationValue | null) => void;
  placeholder?: string;
}

const RAW_COORD_RE = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/;

export default function LocationPicker({ value, onChange, placeholder = 'Search an address, or paste "lat, lng"' }: Props) {
  const t = useTheme();
  const [query, setQuery] = useState(value?.address || '');
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);

  const search = async () => {
    const q = query.trim();
    if (!q) return;

    const rawMatch = q.match(RAW_COORD_RE);
    if (rawMatch) {
      const lat = parseFloat(rawMatch[1]);
      const lng = parseFloat(rawMatch[2]);
      onChange({ address: q, lat, lng });
      return;
    }

    setSearching(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&countrycodes=gh&limit=1&q=${encodeURIComponent(q)}`, {
        headers: { 'User-Agent': 'RebmaImpexMobile/1.0' },
      });
      const results = await res.json();
      if (!results || results.length === 0) {
        Alert.alert('Not Found', 'No matching location found. Try a different search or paste "lat, lng".');
        return;
      }
      const r = results[0];
      onChange({ address: r.display_name || q, lat: parseFloat(r.lat), lng: parseFloat(r.lon) });
      setQuery(r.display_name || q);
    } catch {
      Alert.alert('Search Failed', 'Could not reach the location search service.');
    } finally {
      setSearching(false);
    }
  };

  const useCurrentLocation = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Location Permission Needed', 'Enable location access in your device settings.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { latitude, longitude } = pos.coords;
      let address = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`, {
          headers: { 'User-Agent': 'RebmaImpexMobile/1.0' },
        });
        const r = await res.json();
        if (r?.display_name) address = r.display_name;
      } catch {}
      onChange({ address, lat: latitude, lng: longitude });
      setQuery(address);
    } catch (e: any) {
      Alert.alert('Could Not Get Location', e.message || 'GPS lookup failed.');
    } finally {
      setLocating(false);
    }
  };

  return (
    <View style={{ gap: t.spacing.sm }}>
      <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
        <View style={{ flex: 1 }}>
          <Input value={query} onChangeText={setQuery} placeholder={placeholder} />
        </View>
        <Button icon={<Search size={14} color="#fff" />} label="Go" onPress={search} loading={searching} disabled={searching || !query.trim()} style={{ paddingHorizontal: t.spacing.md }} />
      </View>
      <Button
        variant="ghost"
        size="sm"
        icon={<LocateFixed size={13} color={t.colors.textSecondary} />}
        label={locating ? 'Locating…' : 'Use Current Location'}
        onPress={useCurrentLocation}
        loading={locating}
        disabled={locating}
      />
      {value ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, backgroundColor: t.colors.accentSoft, borderRadius: t.radius.sm, padding: t.spacing.sm }}>
          <MapPin size={13} color={t.colors.accentPressed} />
          <Text style={{ flex: 1, fontFamily: t.font.medium, fontSize: t.type.meta10.size, color: t.colors.accentPressed }} numberOfLines={2}>
            {value.address} ({value.lat.toFixed(5)}, {value.lng.toFixed(5)})
          </Text>
        </View>
      ) : null}
    </View>
  );
}
