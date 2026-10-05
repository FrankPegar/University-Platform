import { useState } from 'react';

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
  16: 'h-16 w-16 text-lg',
};

export default function Avatar({ name, size = 8, src }) {
  const [failedSrc, setFailedSrc] = useState(null);
  const showImage = src && src !== failedSrc;
  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent/10 font-semibold text-accent ${SIZES[size] || SIZES[8]}`}
      aria-hidden="true"
    >
      {showImage ? <img src={src} alt="" className="h-full w-full object-cover" onError={() => setFailedSrc(src)} referrerPolicy="no-referrer" /> : initialsOf(name) || '?'}
    </div>
  );
}
