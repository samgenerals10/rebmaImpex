// Accent override system — injects a <style> tag with higher specificity
// so custom accent colors win over body.theme-* CSS variable declarations.

export function hexToRgba(hex: string, alpha: number): string {
  if (!hex || hex.length < 7) return `rgba(0,0,0,${alpha})`;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function darkenHex(hex: string, percent: number): string {
  if (!hex || hex.length < 7) return hex;
  const r = Math.max(0, Math.floor(parseInt(hex.slice(1, 3), 16) * (1 - percent / 100)));
  const g = Math.max(0, Math.floor(parseInt(hex.slice(3, 5), 16) * (1 - percent / 100)));
  const b = Math.max(0, Math.floor(parseInt(hex.slice(5, 7), 16) * (1 - percent / 100)));
  return '#' + r.toString(16).padStart(2, '0') + g.toString(16).padStart(2, '0') + b.toString(16).padStart(2, '0');
}

interface AppearanceData {
  template?: string;
  accentType?: string;
  accentSolid?: string;
  gradientColor1?: string;
  gradientColor2?: string;
  gradientDirection?: string;
}

export function applyAccentOverride(data: AppearanceData): void {
  // Remove previous override
  const existing = document.getElementById('erp-accent-override');
  if (existing) existing.remove();

  const { accentType, accentSolid, gradientColor1, gradientColor2, gradientDirection, template } = data;

  // Nothing to override — use the template's default accent
  if (!accentType || accentType === 'none') return;
  if (accentType === 'solid' && !accentSolid) return;
  if (accentType === 'gradient' && (!gradientColor1 || !gradientColor2)) return;

  let accentVal = '';
  let accent2Val = '';
  let accentSoftVal = '';
  let gradientVal = '';

  if (accentType === 'solid' && accentSolid) {
    accentVal     = accentSolid;
    accent2Val    = darkenHex(accentSolid, 15);
    accentSoftVal = hexToRgba(accentSolid, 0.10);
    gradientVal   = `linear-gradient(135deg,${accentSolid},${accent2Val})`;
  }

  if (accentType === 'gradient' && gradientColor1 && gradientColor2) {
    const dir     = gradientDirection || '135deg';
    accentVal     = gradientColor1;
    accent2Val    = gradientColor2;
    accentSoftVal = hexToRgba(gradientColor1, 0.10);
    gradientVal   = `linear-gradient(${dir},${gradientColor1},${gradientColor2})`;
  }

  const bgVal = accentType === 'gradient' ? gradientVal : accentVal;
  const themeClass = `theme-${template || 'salespulse'}`;

  const css = `
    body.${themeClass} {
      --accent: ${accentVal} !important;
      --accent-2: ${accent2Val} !important;
      --accent-soft: ${accentSoftVal} !important;
      --accent-gradient: ${gradientVal} !important;
      --accent-color: ${accentVal} !important;
      --accent-hover: ${accent2Val} !important;
      --accent-light: ${hexToRgba(accentVal, 0.15)} !important;
    }
    body.${themeClass} .bg-accent,
    body.${themeClass} .nav-item--active,
    body.${themeClass} .lf-nav-item span[style*="var(--accent)"],
    body.${themeClass} .lf-nav-icon[style*="var(--accent)"],
    body.${themeClass} .erp-btn-primary,
    body.${themeClass} [class*="bg-accent"]:not([class*="bg-accent-soft"]):not([class*="bg-accent-light"]),
    body.${themeClass} [class*="bg-[var(--accent)]"],
    body.${themeClass} [class*="bg-[var(--accent-hover)]"],
    body.${themeClass} [class*="bg-[var(--accent-2)]"],
    body.${themeClass} [style*="background: var(--accent)"],
    body.${themeClass} [style*="background-color: var(--accent)"],
    body.${themeClass} [style*="background:var(--accent)"],
    body.${themeClass} [style*="background-color:var(--accent)"] {
      background: ${bgVal} !important;
      background-image: ${bgVal} !important;
    }
    body.${themeClass} .text-accent,
    body.${themeClass} [class*="text-accent"] {
      color: ${accentVal} !important;
    }
    body.${themeClass} .border-accent {
      border-color: ${accentVal} !important;
    }
    body.${themeClass} .bg-accent-soft {
      background-color: ${accentSoftVal} !important;
    }
    body.${themeClass} .kpi-icon {
      background: ${gradientVal} !important;
      background-image: ${gradientVal} !important;
    }
    body.${themeClass} .nav-item[data-active="true"],
    body.${themeClass} .nav-item.active {
      background: ${bgVal} !important;
      background-image: ${bgVal} !important;
      color: #ffffff !important;
    }
  `;

  const style = document.createElement('style');
  style.id = 'erp-accent-override';
  style.innerHTML = css;
  document.head.appendChild(style);
}

export function clearAccentOverride(): void {
  const existing = document.getElementById('erp-accent-override');
  if (existing) existing.remove();
}
