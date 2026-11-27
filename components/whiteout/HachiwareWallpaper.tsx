/** Red hachiware cat wallpaper (a repeating SVG tile) for the whiteout desktop. */
export default function HachiwareWallpaper({ opacity = 0.14 }: { opacity?: number }) {
  return (
    <svg className="pointer-events-none fixed inset-0 h-full w-full" aria-hidden="true" style={{ opacity }}>
      <defs>
        <pattern id="hachiware" width="72" height="72" patternUnits="userSpaceOnUse">
          <g transform="translate(36 38)">
            <path d="M-15 -6 L-13 -22 L-4 -13 Z M15 -6 L13 -22 L4 -13 Z" fill="#c8001a" />
            <circle r="16" fill="#c8001a" />
            {/* The 八-shaped split: white from the forehead down over the muzzle. */}
            <path d="M0 -10 L-11 9 Q0 17 11 9 Z" fill="#fff" />
            <circle cx="-6" cy="-1" r="1.6" fill="#1a0306" />
            <circle cx="6" cy="-1" r="1.6" fill="#1a0306" />
            <path d="M-1.5 5 L1.5 5 L0 7 Z" fill="#f9a8b8" />
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#hachiware)" />
    </svg>
  );
}
