// rebma-mobile/lib/color.ts
// Small, dependency-free hex/HSL conversion used by ColorPicker.tsx and
// ThemeProvider's custom-accent/custom-background derivation — no new
// npm package pulled in just for color math.
export interface HSL {
  h: number; // 0-360
  s: number; // 0-100
  l: number; // 0-100
}

export function isValidHex(hex: string): boolean {
  return /^#?[0-9a-fA-F]{6}$/.test(hex.trim());
}

export function normalizeHex(hex: string): string {
  const h = hex.trim().replace(/^#/, '').toUpperCase();
  return `#${h}`;
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  };
}

export function rgbToHex(r: number, g: number, b: number): string {
  const c = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`.toUpperCase();
}

export function rgbToHsl(r: number, g: number, b: number): HSL {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  const d = max - min;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case r: h = ((g - b) / d) % 6; break;
      case g: h = (b - r) / d + 2; break;
      default: h = (r - g) / d + 4;
    }
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: s * 100, l: l * 100 };
}

export function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  s /= 100; l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }
  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
}

export function hexToHsl(hex: string): HSL {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHsl(r, g, b);
}

export function hslToHex(h: number, s: number, l: number): string {
  const { r, g, b } = hslToRgb(h, s, l);
  return rgbToHex(r, g, b);
}

export function hexToRgba(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${alpha})`;
}

// Darkens a hex color by reducing HSL lightness — used to derive a
// "pressed" state color from a single user-picked accent.
export function darken(hex: string, amount = 15): string {
  const { h, s, l } = hexToHsl(hex);
  return hslToHex(h, s, Math.max(0, l - amount));
}

export interface DerivedBackground {
  bgPage: string;
  bgCard: string;
  bgInput: string;
  border: string;
  textPrimary: string;
}

// Builds a full coordinated background set (page/card/input/border/text)
// from ONE picked base color — same coordinated-tint idea every existing
// BACKGROUND_PALETTE entry already follows (one hue, several lightness
// steps), just computed instead of hand-tuned per preset.
export function deriveBackgroundSet(baseHex: string): DerivedBackground {
  const { h, s } = hexToHsl(baseHex);
  const tintSat = Math.min(s, 35);
  return {
    bgPage: hslToHex(h, tintSat, 97),
    bgCard: '#FFFFFF',
    bgInput: hslToHex(h, tintSat, 94),
    border: hslToHex(h, tintSat, 88),
    textPrimary: hslToHex(h, Math.min(s, 45), 16),
  };
}
