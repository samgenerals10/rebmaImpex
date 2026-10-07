// An address box with a map pin inside it, the phone twin of the web's
// components/common/AddressInput.tsx. Typing works as normal; the pin opens
// the place finder (search a place, or use where you are now) and fills the
// address in. Used by every address field (staff, guarantor, customer).
import { useState } from 'react';
import { View, Pressable } from 'react-native';
import { MapPin } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeProvider';
import Input from '../ui/Input';
import Sheet from '../ui/Sheet';
import Button from '../ui/Button';
import LocationPicker, { type LocationValue } from './LocationPicker';

interface Props {
  value: string;
  onChangeText: (text: string) => void;
  /** Optional: receives the exact point when one is found. */
  onLocation?: (loc: LocationValue | null) => void;
  placeholder?: string;
  editable?: boolean;
}

export default function AddressInput({ value, onChangeText, onLocation, placeholder, editable = true }: Props) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<LocationValue | null>(null);

  return (
    <>
      <View style={{ position: 'relative', justifyContent: 'center' }}>
        <Input value={value} onChangeText={onChangeText} placeholder={placeholder} editable={editable} style={{ paddingRight: 44 }} />
        <Pressable
          onPress={() => editable && setOpen(true)}
          accessibilityLabel="Find on the map"
          hitSlop={8}
          style={{ position: 'absolute', right: 6, width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: t.colors.accentSoft }}
        >
          <MapPin size={16} color={t.colors.accent} />
        </Pressable>
      </View>

      <Sheet open={open} onClose={() => setOpen(false)} title="Find the address" subtitle="Search a place, or use where you are now. The address box fills in for you." side="bottom" maxHeight={560}
        footer={<Button label="Use this address" fullWidth onPress={() => setOpen(false)} />}>
        <LocationPicker
          value={picked}
          onChange={(loc) => {
            setPicked(loc);
            if (loc?.address) onChangeText(loc.address);
            onLocation?.(loc);
          }}
        />
      </Sheet>
    </>
  );
}
