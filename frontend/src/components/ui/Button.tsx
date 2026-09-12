import React from 'react';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

/**
 * Primary sits dark-on-brass rather than white-on-brass. The accent is a
 * light mid-tone: white text on it lands around 2:1, which fails at any
 * size, and the inverted pair reads as a physical key on a console besides.
 */
const variants: Record<Variant, string> = {
  primary:
    'bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-gray-950 border-transparent font-semibold',
  secondary: 'bg-gray-800 hover:bg-gray-700 text-gray-100 border-gray-700',
  danger: 'bg-red-500 hover:bg-red-400 text-gray-950 border-transparent font-semibold',
  ghost: 'bg-transparent hover:bg-gray-800 text-gray-400 hover:text-gray-100 border-transparent',
};

const sizes: Record<Size, string> = {
  sm: 'px-2.5 py-1.5 text-xs gap-1.5',
  md: 'px-4 py-2 text-sm gap-2',
  lg: 'px-5 py-2.5 text-sm gap-2',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  className = '',
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={`
        inline-flex items-center justify-center rounded-md border tracking-tight
        transition-colors duration-150 focus:outline-none focus-visible:ring-2
        focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2
        focus-visible:ring-offset-[var(--color-bg)]
        disabled:opacity-45 disabled:cursor-not-allowed
        ${variants[variant]} ${sizes[size]} ${className}
      `}
    >
      {loading && (
        <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
      )}
      {children}
    </button>
  );
}
