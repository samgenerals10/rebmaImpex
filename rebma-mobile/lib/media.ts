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
import { Alert } from './appAlert';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export interface PickedAsset {
  uri: string;
  mimeType: string;
  size?: number;
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

// Step 6 of the tab-bar rebuild plan — the user's exact terminology,
// applied here since every one of the 8 screens that offer "add an
// image" routes through this one function: "Photo" means picking an
// existing picture file from the device; "Capture" means using the
// live camera. Renamed from the old "Take Photo"/"Choose from Library"
// labels to match, both here and in every call site's own button label
// (grep confirmed none hardcode the old wording independently).
//
// What did NOT change: the user's definition also says Capture should
// work for either a photo or a video. Checked every one of the 8 real
// destinations this function feeds — a profile photo, a staff/customer
// photo, a cargo product image, a company logo, a delivery-proof photo,
// a group-chat avatar — every one of them is a genuine single-still-image
// field (several literally build a `data:image/jpeg;base64,...` string
// for a column that expects exactly that). None of them can hold a
// video without breaking, and no video-attachment capability exists
// anywhere in this app yet (validateAttachment's own allow-list has no
// video mime type). So Capture stays photo-only here — adding video
// would corrupt real data, not fix anything. Flagged, not silently
// dropped: if a genuine video-capture need comes up somewhere (a video
// proof-of-delivery, a video chat attachment), that's new capability to
// build deliberately, not something this rename should silently imply.
function offerCameraOrLibrary<T>(onCamera: () => Promise<T | null>, onLibrary: () => Promise<T | null>): Promise<T | null> {
  return new Promise((resolve) => {
    Alert.alert(
      'Add Image',
      undefined,
      [
        { text: 'Capture', onPress: () => onCamera().then(resolve) },
        { text: 'Photo', onPress: () => onLibrary().then(resolve) },
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
      return r.canceled || !r.assets?.[0] ? null : { uri: r.assets[0].uri, mimeType: r.assets[0].mimeType || 'image/jpeg', size: r.assets[0].fileSize };
    },
    async () => {
      if (!(await requestLibraryPerm())) return null;
      const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6 });
      return r.canceled || !r.assets?.[0] ? null : { uri: r.assets[0].uri, mimeType: r.assets[0].mimeType || 'image/jpeg', size: r.assets[0].fileSize };
    }
  );
}

// The real Capture piece — a device camera that can take either a still
// photo or record a video, same native toggle every phone's own camera
// app already has (passing both mediaTypes is what turns that toggle on;
// nothing custom to build for the toggle itself). "Photo" stays a
// still-image-only library pick, matching the user's own definition —
// only "Capture" gets the photo/video choice.
//
// Built for, and only wired into, destinations that can actually hold
// and show a video result — right now that's Viber's chat attachments
// (MessengerThreadScreen's attachPhoto). It is NOT used for the 7 other
// still-image fields elsewhere in the app (profile/staff/customer photo,
// cargo/product image, company logo, delivery-proof photo, group-chat
// avatar) — every one of those is rendered as a fixed-size still image
// (an Avatar circle, a document logo, a base64 column that structurally
// cannot hold anything but a JPEG string) with no video player anywhere
// near it, so offering "record a video" there would capture something
// the app then shows as a broken image. That's not a video vs photo
// question, it's simply the wrong field for it. If a specific one of
// those should genuinely become video-capable later (e.g. a video
// proof-of-delivery), that's real new display work at that one screen,
// not a change to this shared picker.
export interface PickedMedia extends PickedAsset {
  kind: 'image' | 'video';
  durationMs?: number;
}

export function pickOrCaptureMedia(): Promise<PickedMedia | null> {
  return offerCameraOrLibrary<PickedMedia>(
    async () => {
      if (!(await requestCameraPerm())) return null;
      const r = await ImagePicker.launchCameraAsync({ mediaTypes: ['images', 'videos'], quality: 0.6, videoMaxDuration: 60 });
      if (r.canceled || !r.assets?.[0]) return null;
      const a = r.assets[0];
      const isVideo = a.type === 'video' || (a.mimeType || '').startsWith('video/');
      return {
        uri: a.uri,
        mimeType: a.mimeType || (isVideo ? 'video/mp4' : 'image/jpeg'),
        size: a.fileSize,
        kind: isVideo ? 'video' : 'image',
        durationMs: (a as any).duration ?? undefined,
      };
    },
    async () => {
      if (!(await requestLibraryPerm())) return null;
      const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6 });
      if (r.canceled || !r.assets?.[0]) return null;
      const a = r.assets[0];
      return { uri: a.uri, mimeType: a.mimeType || 'image/jpeg', size: a.fileSize, kind: 'image' };
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
  return { uri: r.assets[0].uri, mimeType: r.assets[0].mimeType || 'application/pdf', size: r.assets[0].size };
}

// Phase 11.3 — several photos sent together as one message. Library only
// (a camera can't produce "several" in one action) — capped at 10, a
// reasonable chat-appropriate batch, not a bulk-upload tool.
export async function pickMultipleImageAssets(limit = 10): Promise<PickedAsset[] | null> {
  if (!(await requestLibraryPerm())) return null;
  const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: limit, quality: 0.6 });
  if (r.canceled || !r.assets || r.assets.length === 0) return null;
  return r.assets.map((a) => ({ uri: a.uri, mimeType: a.mimeType || 'image/jpeg', size: a.fileSize }));
}

// Cargo-photo lifecycle work — saves/shares a base64 data: URI image
// (the exact shape cargo_intake.product_image / goods_prices.product_image
// already store) via the OS share sheet, same File+Sharing pattern
// lib/exportEngine.ts already uses for CSV/DOC. A data: URI can't be
// "downloaded" directly on native — it has to be written to a real file
// first, which is all this does.
function slugFileName(title: string): string {
  return title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'image';
}

export async function saveBase64Image(dataUri: string, label: string): Promise<void> {
  const match = /^data:image\/(\w+);base64,(.+)$/.exec(dataUri);
  const ext = match?.[1] === 'jpg' ? 'jpeg' : match?.[1] || 'jpeg';
  const base64 = match?.[2] ?? dataUri;
  const file = new File(Paths.cache, `${slugFileName(label)}.${ext}`);
  file.write(base64, { encoding: 'base64' });
  await Sharing.shareAsync(file.uri, { mimeType: `image/${ext}`, dialogTitle: label });
}

// Phase 11.3 — same cap/allowlist as web's validateAttachment(), so a
// rejected file gets the same "too big"/"unsupported type" reasoning on
// both platforms. Video mime types added alongside pickOrCaptureMedia()
// (step 6 follow-up) — real video attachments now exist in Viber, so
// this allow-list has to admit them; a larger cap applies to video since
// 15MB is unrealistic for even a short clip.
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const MAX_VIDEO_BYTES = 60 * 1024 * 1024;
const ALLOWED_ATTACHMENT_TYPES = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'application/pdf', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain', 'text/csv',
];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/x-m4v'];
export function validateAttachment(mimeType: string, sizeBytes?: number): string | null {
  const isVideo = ALLOWED_VIDEO_TYPES.includes(mimeType);
  if (isVideo) {
    if (sizeBytes && sizeBytes > MAX_VIDEO_BYTES) return 'That video is larger than 60MB.';
    return null;
  }
  if (sizeBytes && sizeBytes > MAX_IMAGE_BYTES) return 'That file is larger than 15MB.';
  if (!ALLOWED_ATTACHMENT_TYPES.includes(mimeType)) return "That file type isn't supported here.";
  return null;
}
