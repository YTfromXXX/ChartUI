// This project's Ethereum glyph: a honeycomb hexagon holding the three bars of Ξ (U+039E, the
// customary ether sign). An original mark — not the Ethereum Foundation logo — used where ₿ was.
export default function EthGlyph({ size = 24, color = 'currentColor', title = 'Ξ イーサリアム' }: { size?: number; color?: string; title?: string }) {
  const hex = Array.from({ length: 6 }, (_, k) => { const a = Math.PI / 6 + (k * Math.PI) / 3; return `${12 + 10.5 * Math.cos(a)},${12 + 10.5 * Math.sin(a)}`; }).join(' ');
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} role="img" aria-label={title}>
      <polygon points={hex} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M7.5 7.6h9M8.6 12h6.8M7.5 16.4h9" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
