// rebma-mobile/lib/media.ts
//
// Phase 7.1, D12 (corrected — verified per-flow, not assumed uniform):
// cargo intake (StockIntakeForm.tsx / OperationsDashboard.tsx's port-cargo
// form) calls `canvas.toDataURL('image/jpeg', 0.8)` / FileReader and
// writes the resulting `data:image/jpeg;base64,...` string straight into
// `cargo_intake.product_image` — no bucket. Delivery proof photos
// (DeliveriesView.tsx's "Upload Proof" AND ProofOfDeliveryView.tsx) are
// DIFFERENT — both call `uploadFile(file, 'delivery-proofs', deliveryId)`
// (src/utils/uploadFile.ts), a real `supabase.storage` upload, and store
// the returned public URL in `delivery_logs.proof_photo`. Two genuinely
// different storage destinations on web; this file matches each exactly
// rather than assuming one shape for both. `pickOrCaptureImage()` is for
// the base64 flow; `pickOrCaptureImageAsset()` + lib/storage.ts's
// `uploadToBucket()` are for the Storage-bucket flow.
//
// Matches web's plain `<input type="file" accept="image/*">` (no `capture`
// attribute) used by both of those upload buttons — i.e. an OS picker
// offering a choice between the camera app and the photo library, not a
// live in-app camera. (ProofOfDeliveryScreen and ScannerScreen use
// `expo-camera`'s CameraView directly instead, since those two need a
// live in-app camera view with a front/back switch.)
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';

export interface PickedAsset {
  uri: string;
  mimeType: string;
}

async function requestCameraPerm(): Promise<boolean> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) {
    Alert.alert('Camera Permission Needed', 'Enable camera access in your device settings to take a photo.');
    return false;
  }
  return true;
}

async function requestLibraryPerm(): Promise<boolean> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    Alert.alert('Photo Library Permission Needed', 'Enable photo library access in your device settings to attach a photo.');
    return false;
  }
  return true;
}

function offerCameraOrLibrary<T>(onCamera: () => Promise<T | null>, onLibrary: () => Promise<T | null>): Promise<T | null> {
  return new Promise((resolve) => {
    Alert.alert(
      'Add Photo',
      undefined,
      [
        { text: 'Take Photo', onPress: () => onCamera().then(resolve) },
        { text: 'Choose from Library', onPress: () => onLibrary().then(resolve) },
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
      ],
      { cancelable: true, onDismiss: () => resolve(null) }
    );
  });
}

// Base64 data: URL flow — cargo_intake.product_image.
export function pickOrCaptureImage(): Promise<string | null> {
  return offerCameraOrLibrary(
    async () => {
      if (!(await requestCameraPerm())) return null;
      const r = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], base64: true, quality: 0.6 });
      return r.canceled || !r.assets?.[0]?.base64 ? null : `data:image/jpeg;base64,${r.assets[0].base64}`;
    },
    async () => {
      if (!(await requestLibraryPerm())) return null;
      const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], base64: true, quality: 0.6 });
      return r.canceled || !r.assets?.[0]?.base64 ? null : `data:image/jpeg;base64,${r.assets[0].base64}`;
    }
  );
}

// Raw asset flow — for Storage-bucket uploads via lib/storage.ts's
// uploadToBucket(). Returns the local file uri (not yet uploaded anywhere).
export function pickOrCaptureImageAsset(): Promise<PickedAsset | null> {
  return offerCameraOrLibrary(
    async () => {
      if (!(await requestCameraPerm())) return null;
      const r = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.6 });
      return r.canceled || !r.assets?.[0] ? null : { uri: r.assets[0].uri, mimeType: r.assets[0].mimeType || 'image/jpeg' };
    },
    async () => {
      if (!(await requestLibraryPerm())) return null;
      const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6 });
      return r.canceled || !r.assets?.[0] ? null : { uri: r.assets[0].uri, mimeType: r.assets[0].mimeType || 'image/jpeg' };
    }
  );
}

// Phase 7.7, D52: résumé/CV upload — a document, not a photo, so this uses
// expo-document-picker (new dependency) rather than the camera/library
// pickers above. Returns the same PickedAsset shape as
// pickOrCaptureImageAsset() so it plugs directly into lib/storage.ts's
// uploadToBucket() unchanged.
export async function pickDocument(): Promise<PickedAsset | null> {
  const r = await DocumentPicker.getDocumentAsync({
    type: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    copyToCacheDirectory: true,
  });
  if (r.canceled || !r.assets?.[0]) return null;
  return { uri: r.assets[0].uri, mimeType: r.assets[0].mimeType || 'application/pdf' };
}
