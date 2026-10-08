// The app's on/off switch: the same one as "Keep me logged in" on the
// login page. Turquoise when on, grey when off, a plain white knob with no
// shadow, and a short ease-in-out slide.
interface SwitchProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: string;
  title?: string;
  disabled?: boolean;
}

export default function Switch({ checked, onChange, label, title, disabled }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={title}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`flat relative shrink-0 w-9 h-5 rounded-full cursor-pointer transition-colors duration-200 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed ${checked ? 'bg-[#02afd9]' : 'bg-slate-300'}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-200 ease-in-out ${checked ? 'translate-x-4' : ''}`}
      />
    </button>
  );
}
