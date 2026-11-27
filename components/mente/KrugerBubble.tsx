import { Jost } from 'next/font/google';

// Futura where installed (macOS / iOS), Jost (an open geometric face in the Futura tradition) otherwise.
const jost = Jost({ subsets: ['latin'], weight: ['700'], style: ['italic'], variable: '--font-jost' });

export const KRUGER_FONT = `${jost.variable}`;
export const KRUGER_FAMILY = 'Futura, "Futura PT", var(--font-jost), "Century Gothic", sans-serif';

type Props = {
  name: string;
  text: string;
  at?: string;
  align?: 'left' | 'right' | 'full';
  className?: string;
};

/**
 * Chat bubble in a Kruger-like layout: white geometric bold italic type on a flat red bar,
 * the speaker on a black tag. Bars are hard-edged rectangles, never rounded speech balloons.
 */
export default function KrugerBubble({ name, text, at, align = 'left', className = '' }: Props) {
  return (
    <div className={`${KRUGER_FONT} flex flex-col ${align === 'right' ? 'items-end' : 'items-start'} ${className}`}>
      <span className="bg-black px-1.5 py-0.5 text-[9px] font-bold italic tracking-wide text-white" style={{ fontFamily: KRUGER_FAMILY }}>
        {name}{at ? ` · ${at}` : ''}
      </span>
      <p
        className={`${align === 'full' ? 'w-full' : 'max-w-[92%]'} bg-[#d6001c] px-2 py-1 text-[13px] font-bold italic leading-snug text-white`}
        style={{ fontFamily: KRUGER_FAMILY }}
      >
        {text}
      </p>
    </div>
  );
}
