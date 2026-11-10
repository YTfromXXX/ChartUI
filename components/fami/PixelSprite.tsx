import { FAMI_PALETTE, type Sprite } from '@/lib/famiSprites';

type Props = {
  sprite: Sprite;
  /** Optional per-pixel colour override (row-major, same size as the sprite). */
  colors?: (string | null)[];
  className?: string;
  title?: string;
};

/** Crisp pixel sprite (one rect per opaque pixel). */
export default function PixelSprite({ sprite, colors, className = '', title }: Props) {
  const w = sprite.rows[0].length; const h = sprite.rows.length;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={className} shapeRendering="crispEdges" role="img" aria-label={title ?? sprite.label}>
      {sprite.rows.flatMap((row, y) => [...row].map((ch, x) => {
        if (ch === '.') return null;
        const fill = colors?.[y * w + x] ?? FAMI_PALETTE[ch] ?? '#ff00ff';
        return <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={fill} />;
      }))}
    </svg>
  );
}
