/**
 * Small glowing globe/network mark used as the app logo on the futuristic
 * Portal header and the Login card. Pure SVG — a wireframe sphere (matches the
 * big GlowOrb) with a cyan→blue gradient stroke. Props: className (sizes it).
 */
export default function GlobeMark({ className = 'h-8 w-8' }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="globemark-stroke" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#67E8F9" />
          <stop offset="100%" stopColor="#3B82F6" />
        </linearGradient>
        <radialGradient id="globemark-fill" cx="42%" cy="38%" r="65%">
          <stop offset="0%" stopColor="#22D3EE" stopOpacity="0.30" />
          <stop offset="100%" stopColor="#0A1226" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="16" cy="16" r="12" fill="url(#globemark-fill)" stroke="url(#globemark-stroke)" strokeWidth="1.3" />
      {/* longitudes */}
      <ellipse cx="16" cy="16" rx="5" ry="12" stroke="url(#globemark-stroke)" strokeWidth="1" strokeOpacity="0.75" />
      {/* latitudes */}
      <line x1="4.6" y1="16" x2="27.4" y2="16" stroke="url(#globemark-stroke)" strokeWidth="1" strokeOpacity="0.75" />
      <ellipse cx="16" cy="16" rx="12" ry="5" stroke="url(#globemark-stroke)" strokeWidth="1" strokeOpacity="0.55" />
    </svg>
  );
}
