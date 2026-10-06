// rebma-web/src/components/auth/AuthBrand.tsx
//
// The sign-in pages' header and styles, matching the phone app's
// (rebma-mobile/components/auth/AuthBrandHeader.tsx and
// AuthGradientButton.tsx): the cropped logo mark, the "REBMA IMPEX"
// wordmark, the page title, and the same three colours sampled from the
// logo. Turquoise for the main button, amber for field icons, forest
// green for links. Shared so the four pages can't drift apart again.

export const AUTH_COLORS = {
  turquoise: '#02afd9',
  amber: '#f2a72e',
  forest: '#0c5c34',
  ink: '#111827',
  muted: '#6b7280',
  field: '#f3f4f6',
};

export const authCls = {
  label: 'block text-sm font-bold text-[#111827] mb-1',
  field: 'flex items-center gap-2.5 h-[52px] px-4 bg-[#f3f4f6] rounded-xl transition-shadow focus-within:ring-2 focus-within:ring-[#02afd9]/40',
  input: 'w-full !bg-transparent !border-0 !shadow-none !rounded-none p-0 text-sm font-semibold text-[#111827] placeholder:text-[#6b7280] placeholder:font-medium focus:ring-0 focus:outline-none',
  icon: 'w-[18px] h-[18px] text-[#f2a72e] shrink-0',
  button: 'w-full h-[52px] rounded-full bg-[#02afd9] hover:opacity-90 active:scale-[0.99] disabled:opacity-70 disabled:cursor-not-allowed text-white text-sm font-bold transition-all cursor-pointer flex items-center justify-center gap-2',
  outlineButton: 'w-full h-[52px] rounded-full border-[1.5px] border-[#02afd9] text-[#02afd9] hover:bg-[#02afd9]/5 text-sm font-bold transition-all cursor-pointer',
  link: 'text-[#0c5c34] hover:underline font-bold cursor-pointer',
  error: 'p-3 bg-rose-50 rounded-xl text-center text-xs text-rose-700 font-semibold leading-normal whitespace-pre-wrap',
  success: 'p-4 bg-emerald-50 rounded-xl text-center text-sm text-emerald-800 font-semibold',
};

export default function AuthBrand({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex flex-col items-center text-center mb-5">
      <div className="flex flex-col items-center lg:hidden mb-8">
        <img src="/logo-mark.png" alt="REBMA IMPEX" className="h-[34px] w-auto select-none pointer-events-none" />
        <span className="mt-1 text-xs font-extrabold tracking-wide text-[#111827]">REBMA IMPEX</span>
      </div>
      <h3 className="text-[22px] font-extrabold text-[#111827]">{title}</h3>
      {subtitle && <p className="mt-1.5 text-[13px] font-semibold text-[#6b7280] leading-relaxed px-2">{subtitle}</p>}
    </div>
  );
}
