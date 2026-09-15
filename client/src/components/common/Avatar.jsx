function initialsOf(name = '') {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

const SIZES = {
  6: 'h-6 w-6 text-[10px]',
  8: 'h-8 w-8 text-xs',
  10: 'h-10 w-10 text-sm',
};

export default function Avatar({ name, size = 8 }) {
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full bg-accent/10 font-semibold text-accent ${SIZES[size] || SIZES[8]}`}
      aria-hidden="true"
    >
      {initialsOf(name) || '?'}
    </div>
  );
}
