import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  prefix?: string;
  suffix?: string;
}

/**
 * Values are set in mono with tabular figures: an amount being typed here is
 * the same quantity that appears in the results, and it should look like it.
 */
export function Input({
  label,
  error,
  hint,
  prefix,
  suffix,
  className = '',
  id,
  ...props
}: InputProps) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="eyebrow">
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        {prefix && (
          <span className="absolute left-3 text-gray-500 text-sm select-none mono">{prefix}</span>
        )}
        <input
          id={inputId}
          {...props}
          className={`
            w-full rounded-md border bg-gray-800 text-gray-50 placeholder-gray-600
            mono text-sm tracking-tight
            focus:outline-none focus:border-[var(--color-accent)]
            focus:ring-1 focus:ring-[var(--color-accent)]
            transition-colors duration-150
            ${error ? 'border-red-500' : 'border-gray-700'}
            ${prefix ? 'pl-7' : 'pl-3'}
            ${suffix ? 'pr-12' : 'pr-3'}
            py-2
            ${className}
          `}
        />
        {suffix && (
          <span className="absolute right-3 text-gray-500 text-xs select-none">{suffix}</span>
        )}
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      {hint && !error && <p className="text-xs text-gray-500 leading-snug">{hint}</p>}
    </div>
  );
}
