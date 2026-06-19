import type { ButtonHTMLAttributes } from 'react';

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' }) {
  const base =
    'inline-flex items-center justify-center font-semibold rounded-cr-input px-cr-md py-cr-sm transition';
  const styles =
    variant === 'primary'
      ? 'text-white [background:linear-gradient(135deg,var(--color-primary),var(--color-primaryDark))] shadow-[0_8px_20px_var(--color-glow)]'
      : 'text-cr-text bg-cr-surface-alt';
  return <button className={`${base} ${styles} ${className}`} {...props} />;
}
