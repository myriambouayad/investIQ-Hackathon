/**
 * A segmented control — the period picker every quote screen has.
 *
 * Built from real radio semantics rather than buttons so arrow keys move
 * between periods, which is how anyone scrubbing a chart expects it to work.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  name,
  label,
  className = '',
}: {
  options: { value: T; label: string; hint?: string }[];
  value: T;
  onChange: (v: T) => void;
  name: string;
  label: string;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={`inline-flex items-center gap-0.5 rounded-md bg-gray-800 p-0.5 border border-gray-700/70 ${className}`}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            title={opt.hint}
            onClick={() => onChange(opt.value)}
            className={`px-2.5 py-1 rounded text-xs font-medium tabular transition-colors ${
              active
                ? 'bg-gray-700 text-gray-50'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
      <input type="hidden" name={name} value={value} />
    </div>
  );
}
