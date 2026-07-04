/**
 * Animated futuristic "globe" rendered entirely in SVG + CSS (no images, no
 * libraries). A glowing wireframe sphere with latitude/longitude lines, two
 * orbiting rings, and a soft radial glow. Used on the Portal hero and Login.
 *
 * Props: size (px), className.
 */
export default function GlowOrb({ size = 340, className = '' }) {
  return (
    <div
      className={`pointer-events-none relative ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {/* ambient glow behind the sphere */}
      <div
        className="absolute inset-0 animate-pulse-glow rounded-full blur-2xl"
        style={{ background: 'radial-gradient(circle, rgba(34,211,238,0.35), rgba(59,130,246,0.12) 55%, transparent 72%)' }}
      />

      {/* orbiting rings (tilted ellipses) */}
      <div className="absolute inset-0 animate-orbit-spin" style={{ transform: 'rotateX(72deg)' }}>
        <div className="absolute inset-[8%] rounded-full border border-cyan-300/30" />
      </div>
      <div className="absolute inset-0 animate-orbit-spin-rev" style={{ transform: 'rotateX(60deg) rotateZ(30deg)' }}>
        <div className="absolute inset-[2%] rounded-full border border-blue-400/25" />
      </div>

      {/* the wireframe sphere */}
      <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full">
        <defs>
          <radialGradient id="orb-fill" cx="42%" cy="38%" r="65%">
            <stop offset="0%" stopColor="#22D3EE" stopOpacity="0.22" />
            <stop offset="55%" stopColor="#1E3A8A" stopOpacity="0.14" />
            <stop offset="100%" stopColor="#060B18" stopOpacity="0.0" />
          </radialGradient>
          <linearGradient id="orb-stroke" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#67E8F9" />
            <stop offset="100%" stopColor="#3B82F6" />
          </linearGradient>
        </defs>

        <circle cx="100" cy="100" r="72" fill="url(#orb-fill)" stroke="url(#orb-stroke)" strokeOpacity="0.55" strokeWidth="0.8" />

        {/* longitude ellipses */}
        <g stroke="url(#orb-stroke)" strokeOpacity="0.4" strokeWidth="0.6" fill="none">
          <ellipse cx="100" cy="100" rx="24" ry="72" />
          <ellipse cx="100" cy="100" rx="48" ry="72" />
          <ellipse cx="100" cy="100" rx="68" ry="72" />
        </g>
        {/* latitude lines */}
        <g stroke="url(#orb-stroke)" strokeOpacity="0.32" strokeWidth="0.6" fill="none">
          <line x1="30" y1="76" x2="170" y2="76" />
          <line x1="28" y1="100" x2="172" y2="100" />
          <line x1="30" y1="124" x2="170" y2="124" />
          <ellipse cx="100" cy="100" rx="72" ry="24" />
          <ellipse cx="100" cy="100" rx="72" ry="48" />
        </g>

        {/* a few node dots */}
        <g fill="#67E8F9">
          <circle cx="132" cy="70" r="1.6" />
          <circle cx="72" cy="120" r="1.4" />
          <circle cx="112" cy="132" r="1.4" />
          <circle cx="80" cy="70" r="1.2" />
        </g>
      </svg>
    </div>
  );
}
