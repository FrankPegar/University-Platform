const VARIANTS = {
  primary: 'bg-accent text-white hover:bg-accent-hover disabled:opacity-50',
  secondary:
    'bg-surface text-ink border border-border hover:border-ink-muted disabled:opacity-50',
  ghost: 'text-ink hover:bg-border/40 disabled:opacity-50',
  danger: 'bg-danger text-white hover:opacity-90 disabled:opacity-50',
};

export default function Button({
  as: Component = 'button',
  variant = 'primary',
  className = '',
  loading = false,
  children,
  disabled,
  ...props
}) {
  return (
    <Component
      className={`inline-flex items-center justify-center gap-2 rounded px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed ${VARIANTS[variant]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <span
          className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden="true"
        />
      )}
      {children}
    </Component>
  );
}
