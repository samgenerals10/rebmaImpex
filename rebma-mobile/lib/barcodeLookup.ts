// rebma-mobile/lib/barcodeLookup.ts
//
// Wires the real "Barcode / Product Lookup" API key from Control Center's
// API Keys section (ControlCenterScreen.tsx, key: api_key_scanner_lookup)
// into an actual external service — Barcode Lookup (barcodelookup.com),
// picked because its API is exactly the "one key, one query param" shape
// the Control Center field's own copy already promises ("Paste your
// lookup API key"), with no second account id or config value needed.
// If a different provider is ever wanted, this is the one place to swap
// the request shape — ScannerScreen.tsx only calls lookupProductBarcode().
//
// Returns null (not a throw) whenever there's nothing real to show: no
// key configured, the barcode isn't in their database, or the request
// itself fails — the caller's job is to fall back to the existing
// "Unrecognized Code" behavior in every one of those cases, not to show
// a broken/empty result card.
import { getCeoSetting } from './ceoSetting';

export interface ProductLookupResult {
  barcode: string;
  title: string;
  brand: string | null;
  category: string | null;
  description: string | null;
  imageUrl: string | null;
}

export async function lookupProductBarcode(code: string): Promise<ProductLookupResult | null> {
  const apiKey = await getCeoSetting<string>('api_key_scanner_lookup', '');
  if (!apiKey) return null;

  try {
    const url = `https://api.barcodelookup.com/v3/products?barcode=${encodeURIComponent(code)}&formatted=y&key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    const product = json?.products?.[0];
    if (!product) return null;
    return {
      barcode: product.barcode_number || code,
      title: product.title || product.product_name || 'Unknown product',
      brand: product.brand || product.manufacturer || null,
      category: product.category || null,
      description: product.description || null,
      imageUrl: Array.isArray(product.images) && product.images.length > 0 ? product.images[0] : null,
    };
  } catch {
    return null;
  }
}
