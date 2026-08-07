// Resizes/re-encodes a photo client-side before upload — driver proof-of-delivery
// shots come straight off a phone camera (often several MB) and this app runs on
// Ghana's variable mobile data, so shrinking to a reasonable JPEG first matters.
export function compressImageToDataUrl(file: File, maxDimension = 1280, quality = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the photo.'));
    reader.onload = () => { img.src = reader.result as string; };
    img.onerror = () => reject(new Error('Could not read the photo.'));
    img.onload = () => {
      const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Could not process the photo.')); return; }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    reader.readAsDataURL(file);
  });
}
