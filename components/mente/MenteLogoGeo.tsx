import { MENTE_LETTERS, MENTE_VIEWBOX } from '@/lib/menteLogo';

/** MENTE, taken apart into geometric shapes (Futura-like construction, drawn by hand as paths). */
export default function MenteLogoGeo({ className = 'h-8', ink = '#7a0f22', dot = '#c8001a' }: { className?: string; ink?: string; dot?: string }) {
  return (
    <svg viewBox={MENTE_VIEWBOX} className={className} role="img" aria-label="MENTE">
      {MENTE_LETTERS.map((d) => <path key={d} d={d} fill={ink} />)}
      <circle cx={65.5} cy={12.2} r={1.8} fill={dot} />
    </svg>
  );
}
