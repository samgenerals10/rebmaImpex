// rebma-mobile/components/ui/ProductImage.tsx
//
// The one shared piece behind the cargo-photo lifecycle requirement:
// the photo captured at Port Ingestion (cargo_intake.product_image /
// goods_prices.product_image — both plain base64 data: URI text
// columns, no Storage bucket, matching lib/media.ts's own documented
// convention) has to be visible, clickable, and downloadable on every
// screen it passes through — Risk, Management, Finance, Admin &
// Warehouse, Delivery — but NOT the separate Proof-of-Delivery photo,
// which is a different field entirely and never routes through here.
//
// `editable` is Management's own capability, per direct correction: an
// intake photo is often an impromptu snap "just for the delivery sake,"
// and Management is the one role allowed to replace it with a more
// professional shot. Replacing writes back through `onReplace`, which
// each screen wires to whichever column it owns (cargo_intake vs
// goods_prices) — this component never touches Supabase itself.
import { useState } from 'react';
import { View, Text, Image, Pressable, Modal, Dimensions, ActivityIndicator } from 'react-native';
import { ImageOff, X, Download, Pencil } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { pickOrCaptureImage, saveBase64Image } from '../../lib/media';

interface Props {
  uri: string | null | undefined;
  label: string;
  size?: number;
  editable?: boolean;
  onReplace?: (dataUri: string) => void | Promise<void>;
}

export default function ProductImage({ uri, label, size = 44, editable = false, onReplace }: Props) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const thumb = (
    <Pressable
      onPress={() => uri && setOpen(true)}
      hitSlop={4}
      style={{
        width: size,
        height: size,
        borderRadius: t.radius.md,
        overflow: 'hidden',
        backgroundColor: t.colors.bgInput,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: t.colors.border,
      }}
    >
      {uri ? (
        <Image source={{ uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
      ) : (
        <ImageOff size={Math.round(size * 0.4)} color={t.colors.textMuted} strokeWidth={1.8} />
      )}
    </Pressable>
  );

  const handleDownload = async () => {
    if (!uri) return;
    setBusy(true);
    try {
      await saveBase64Image(uri, label);
    } finally {
      setBusy(false);
    }
  };

  const handleReplace = async () => {
    const next = await pickOrCaptureImage();
    if (!next || !onReplace) return;
    setBusy(true);
    try {
      await onReplace(next);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {thumb}
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' }}>
          <Pressable onPress={() => setOpen(false)} style={{ position: 'absolute', top: 50, right: 20, padding: 8, zIndex: 1 }}>
            <X size={26} color="#fff" />
          </Pressable>
          <Text style={{ position: 'absolute', top: 56, left: 20, right: 70, color: 'rgba(255,255,255,0.85)', fontFamily: t.font.semibold, fontSize: t.type.body12.size }} numberOfLines={2}>
            {label}
          </Text>
          {uri ? (
            <Image
              source={{ uri }}
              style={{ width: Dimensions.get('window').width - 40, height: Dimensions.get('window').height * 0.62 }}
              resizeMode="contain"
            />
          ) : null}
          <View style={{ flexDirection: 'row', gap: 16, marginTop: 24 }}>
            <Pressable
              onPress={handleDownload}
              disabled={busy}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 18, borderRadius: t.radius.pill, backgroundColor: 'rgba(255,255,255,0.15)' }}
            >
              {busy ? <ActivityIndicator size="small" color="#fff" /> : <Download size={16} color="#fff" />}
              <Text style={{ color: '#fff', fontFamily: t.font.bold, fontSize: t.type.body12.size }}>Download</Text>
            </Pressable>
            {editable ? (
              <Pressable
                onPress={handleReplace}
                disabled={busy}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 18, borderRadius: t.radius.pill, backgroundColor: t.colors.accent }}
              >
                <Pencil size={16} color={t.colors.onAccent} />
                <Text style={{ color: t.colors.onAccent, fontFamily: t.font.bold, fontSize: t.type.body12.size }}>Replace Photo</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </Modal>
    </>
  );
}
