import { useEffect, useRef } from 'react'

// Original "data sphere" globe: full even particle-dot coverage (Fibonacci
// sphere sampling), rotated with real 3D rotation matrices + perspective
// projection each frame. Depth drives size/opacity so far-side vs near-side
// particles read as genuinely in front of / behind each other. Layered with
// glowing hexagon "node" markers + connector stems, thin radial burst rays,
// and scattered binary-digit background text — a cyberspace/data-network
// aesthetic. Orbit rings/pulse/glow stay as DOM overlays around the canvas.

const STAGE = 280 // matches the stage's h-[280px] w-[280px] — the canvas fills
// rays/digits have room to extend past the sphere itself
const RADIUS = 92 // sphere radius in canvas px
const ROT_SPEED = (Math.PI * 2) / 34000
const TILT = -10 * (Math.PI / 180)



function rotateY(p, a) {
  const c = Math.cos(a)
  const s = Math.sin(a)
  return { x: p.x * c + p.z * s, y: p.y, z: -p.x * s + p.z * c }
}
function rotateX(p, a) {
  const c = Math.cos(a)
  const s = Math.sin(a)
  return { x: p.x, y: p.y * c - p.z * s, z: p.y * s + p.z * c }
}
function sphereToVec3(lat, lon, r) {
  return {
    x: r * Math.cos(lat) * Math.cos(lon),
    y: r * Math.sin(lat),
    z: r * Math.cos(lat) * Math.sin(lon),
  }
}
function deg2rad(d) {
  return (d * Math.PI) / 180
}

// Draws a tiny filled hexagon centered at (x, y) — used for the surface
// particles and dust motes so the sphere reads as a mesh of small hex
// cells (matching the reference) instead of round dots.
function fillHex(ctx, x, y, r) {
  ctx.beginPath()
  for (let s = 0; s < 6; s++) {
    const a = (Math.PI / 3) * s - Math.PI / 6
    const hx = x + Math.cos(a) * r
    const hy = y + Math.sin(a) * r
    if (s === 0) ctx.moveTo(hx, hy)
    else ctx.lineTo(hx, hy)
  }
  ctx.closePath()
  ctx.fill()
}



// A handful of fixed "hotspot" centers (lat/lon) that pull extra particle
// density around them, so the sphere reads as clustered data regions rather
// than a uniform dot-grid — mirrors the uneven density in the reference.
const HOTSPOTS = [
  { lat: 25, lon: -25, weight: 1 },
  { lat: -20, lon: 35, weight: 0.85 },
  { lat: 35, lon: 90, weight: 0.9 },
  { lat: -30, lon: -80, weight: 0.7 },
  { lat: 5, lon: 150, weight: 0.75 },
  { lat: -50, lon: 10, weight: 0.6 },
]

function angularDist(lat1, lon1, lat2, lon2) {
  // Simple great-circle-ish distance via chord length between unit vectors —
  // cheap and good enough for a density falloff, not real navigation.
  const a = sphereToVec3(lat1, lon1, 1)
  const b = sphereToVec3(lat2, lon2, 1)
  const dx = a.x - b.x
  const dy = a.y - b.y
  const dz = a.z - b.z
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

// lat/lon here are in radians (as produced by asin/atan2 in buildParticles).
function densityAt(latRad, lonRad) {
  // Base ambient density is deliberately low (mostly empty space between
  // clusters), boosted near each hotspot — but capped well under 1 so even
  // the densest cluster keeps visible gaps between dots instead of tiling
  // into a solid tight mass.
  let d = 0.05
  for (const h of HOTSPOTS) {
    const dist = angularDist(latRad, lonRad, deg2rad(h.lat), deg2rad(h.lon))
    d += h.weight * 0.32 * Math.exp(-(dist * dist) / 0.35)
  }
  return Math.min(d, 0.55)
}

function buildParticles() {
  const particles = []
  // Oversample a uniform sphere, then keep points probabilistically based on
  // local density — hotspots stay denser, everywhere else thins out to
  // scattered/sparse dots instead of a flat even grid.
  const N = 4200
  const golden = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < N; i++) {
    const y = 1 - (i / (N - 1)) * 2
    const radiusAtY = Math.sqrt(1 - y * y)
    const theta = golden * i
    const x = Math.cos(theta) * radiusAtY
    const z = Math.sin(theta) * radiusAtY
    const lat = Math.asin(y)
    const lon = Math.atan2(z, x)

    const keepChance = densityAt(lat, lon)
    if (Math.random() > keepChance) continue

    particles.push({
      lat,
      lon,
      size: 0.4 + Math.random() * 0.85,
      twinkle: Math.random() * Math.PI * 2,
    })
  }
  return particles
}

// Hexagon "data node" markers, fixed at a handful of lat/lon points with a
// short connector stem pointing outward — echoes the cyberspace-style hex
// callouts. `big` nodes get a filled dot + ring; small ones are outline-only.
const NODES = [
  { lat: 28, lon: -30, big: true },
  { lat: 10, lon: 10, big: false },
  { lat: -18, lon: 40, big: true },
  { lat: 42, lon: 70, big: false },
  { lat: -35, lon: -60, big: false },
  { lat: 5, lon: -90, big: true },
  { lat: -8, lon: 120, big: false },
  { lat: 20, lon: 150, big: false },
]

// Radial burst rays: each ray originates from a fixed 3D point ON the
// sphere surface (so it rotates WITH the globe and genuinely recedes/
// foreshortens with depth — true 360° coverage over the whole sphere, not a
// flat 2D pinwheel), and shoots outward along that point's own surface
// normal. Each ray "pops" — a quick flash out, then a slower fade — on its
// own cycle/offset rather than pulsing continuously, so at any moment only
// a few are mid-burst while others are dark or just igniting.

const RAY_COUNT = 26
const RAYS = Array.from({ length: RAY_COUNT }, () => ({
  lat: Math.asin(Math.random() * 2 - 1), // uniform over the sphere, not just equator band
  lon: Math.random() * Math.PI * 2,
  len: 24 + Math.random() * 50,
  cycle: 2.2 + Math.random() * 2.6, // seconds per pop cycle
  offset: Math.random() * 10,
}))

// A burst envelope: sharp rise, hold, slower fade, then dark until the next
// cycle — not a smooth sine, so it reads as "popping" rather than breathing.
function burstEnvelope(tPhase) {
  // tPhase in [0, 1) — fraction through this ray's cycle.
  if (tPhase < 0.08) return tPhase / 0.08 // fast pop-in
  if (tPhase < 0.22) return 1 // brief hold at peak
  if (tPhase < 0.7) return 1 - (tPhase - 0.22) / (0.7 - 0.22) // fade out
  return 0 // dark rest of the cycle
}

// Floating "dust" particles: independent of the sphere's surface, drifting
// in a loose shell around it for parallax depth — like microscopic motes.

const DUST_COUNT = 220
const DUST = Array.from({ length: DUST_COUNT }, () => ({
  lat: Math.asin(Math.random() * 2 - 1),
  lon: Math.random() * Math.PI * 2,
  shellR: 1.05 + Math.random() * 0.65, // multiple of RADIUS
  driftSpeed: 0.04 + Math.random() * 0.09,
  phase: Math.random() * Math.PI * 2,
  size: 0.3 + Math.random() * 0.55,
}))

// Binary-digit "data" text, placed in a 3D shell around the sphere (like
// the dust) so it orbits WITH the globe's own rotation — same direction,
// same spin — instead of sitting at fixed 2D screen coordinates. That also
// naturally fills the middle orbit-ring band as digits swing through it,
// rather than leaving it empty. Digits actively mutate their characters
// (random bit flips on their own interval), not just fading.
function buildBinaryDigits(
  count,
  sizeRange,
  alphaRange,
  shellRange,
) {
  const digits = []
  for (let i = 0; i < count; i++) {
    const len = 3 + Math.floor(Math.random() * 4)
    const bits = []
    for (let j = 0; j < len; j++) bits.push(Math.random() > 0.5 ? '1' : '0')
    digits.push({
      lat: Math.asin(Math.random() * 2 - 1),
      lon: Math.random() * Math.PI * 2,
      shellR: shellRange[0] + Math.random() * (shellRange[1] - shellRange[0]),
      size: sizeRange[0] + Math.random() * (sizeRange[1] - sizeRange[0]),
      alpha: alphaRange[0] + Math.random() * (alphaRange[1] - alphaRange[0]),
      hue: Math.random() < 0.32 ? 'warm' : 'cool',
      bits,
      flipEvery: 0.3 + Math.random() * 0.6,
      nextFlip: Math.random() * 1.5,
    })
  }
  return digits
}

/**
 * @param dark  whether the dark palette is painted right now. Comes from the
 *              shared useTheme().isDark, passed in rather than read from the
 *              DOM so the canvas repaints on a theme switch.
 * @param size  stage size in CSS px. Defaults to STAGE (280), which is what the
 *              dashboard card was built around.
 *
 *              Pass a real number rather than scaling with a CSS transform: the
 *              canvas is a bitmap, so transform:scale(3) stretches 280px of
 *              pixels across 840 and the result is visibly soft. Everything
 *              here is drawn from a unit sphere and multiplied by the radius,
 *              so asking for a bigger size redraws at that size instead.
 */
export default function Globe({ dark = false, size: sizeProp = STAGE }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const size = sizeProp
    // Every distance below is expressed relative to the original 280px stage,
    // so one factor scales the sphere, the digits and the particle field
    // together and the composition holds at any size.
    const k = size / STAGE
    canvas.width = size * dpr
    canvas.height = size * dpr
    canvas.style.width = `${size}px`
    canvas.style.height = `${size}px`
    ctx.scale(dpr, dpr)
    // Draw in the original 280px coordinate system and let the canvas scale the
    // whole composition. Applied on top of the dpr scale, so a 900px stage on a
    // 2x display genuinely rasterises at 1800px — line widths, text and glows
    // all sharpen with it, which a CSS transform on the finished bitmap cannot
    // do. RADIUS and every literal offset below stay in their original units.
    if (k !== 1) ctx.scale(k, k)

    const particles = buildParticles()
    // Two depth layers: a smaller set of clear/sharp digits (as before) plus
    // a larger, more numerous set of faded background digits — mirrors the
    // reference's mix of crisp foreground numbers and hazy distant ones.
    const binaryDigits = [
      ...buildBinaryDigits(45, [6, 8.5], [0.35, 0.6], [1.03, 1.5]),
      ...buildBinaryDigits(70, [4.5, 7], [0.08, 0.2], [1.1, 2.1]),
    ]
    // The theme selector is now `class="dark"` on <html>, set by the shared
    // ThemeProvider — not [data-theme]. See shared/src/theme.jsx for why all
    // seven modules converged on one selector.
    //
    // Read from the prop rather than the DOM so a mid-session theme switch
    // re-runs this effect and repaints the canvas with the other palette;
    // reading the DOM here would leave the globe stuck in the colours it was
    // first drawn with.
    const isDark = dark
    // Every alpha in this file was tuned assuming a black backdrop, where
    // even 10-20% opacity glows brightly. On white, the same low alpha reads
    // as faint gray haze no matter how saturated the base color is — so
    // light theme needs a flat opacity boost on top of the darker colors.
    const opacityBoost = isDark ? 1 : 2.1
    // Light theme needs deep, saturated colors (not pale mid-tones) to read
    // against a white card — the dark-theme palette assumes a black backdrop
    // it can glow against, which white doesn't provide.
    const dotColor = isDark ? '110, 235, 220' : '10, 95, 130'
    const glowColor = isDark ? '110, 235, 220' : '20, 110, 150'
    const hexColor = isDark ? '120, 240, 230' : '5, 85, 120'
    const amberColor = isDark ? '235, 170, 90' : '190, 110, 15'
    const rayColorCool = isDark ? '150, 240, 230' : '15, 100, 150'
    const rayColorWarm = isDark ? '230, 180, 110' : '195, 120, 20'
    const digitColorCool = isDark ? '160, 225, 215' : '20, 90, 125'
    const digitColorWarm = isDark ? '235, 195, 120' : '180, 100, 15'

    // Assign a handful of particles as "amber" accents, fixed per index.
    const amberIdx = new Set()
    while (amberIdx.size < 26) amberIdx.add(Math.floor(Math.random() * particles.length))

    let raf = 0
    let reduced = false
    try {
      reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    } catch {
      /* ignore */
    }

    const start = performance.now()
    // STAGE, not size: the context is already scaled by k above, so the centre
    // has to be expressed in the same unscaled coordinate system as RADIUS and
    // every other literal here. Using `size` would apply the factor twice and
    // push the sphere off the canvas.
    const cx = STAGE / 2
    const cy = STAGE / 2
    const perspective = 420

    function project(p0, spin) {
      let p = rotateY(p0, spin)
      p = rotateX(p, TILT)
      const scale = perspective / (perspective + p.z)
      return { x: cx + p.x * scale, y: cy - p.y * scale, z: p.z, scale }
    }

    function frame(now) {
      const elapsed = reduced ? 0 : now - start
      const spin = -elapsed * ROT_SPEED // negative = clockwise as viewed on screen
      const t = elapsed / 1000

      ctx.clearRect(0, 0, size, size)

      // Radial burst rays: each anchored to a real 3D point on the sphere
      // surface (uniformly sampled over the full 360°, both hemispheres —
      // not just an equator band) and projected through the same rotation,
      // so they genuinely foreshorten/recede with depth instead of spinning
      // flat in 2D. Each ray pops on its own cycle (sharp rise, hold, fade,
      // then dark) rather than breathing continuously.
      for (const ray of RAYS) {
        const surf0 = sphereToVec3(ray.lat, ray.lon, RADIUS)
        const surf = project(surf0, spin)
        const depth = surf.z / RADIUS
        const nearness = (1 - depth) / 2
        if (nearness < 0.1) continue // hide rays on the far side

        const tPhase = (((t + ray.offset) % ray.cycle) / ray.cycle + 1) % 1
        const burst = burstEnvelope(tPhase)
        if (burst <= 0.001) continue

        const dx = surf.x - cx
        const dy = surf.y - cy
        const dist = Math.hypot(dx, dy) || 1
        const ux = dx / dist
        const uy = dy / dist
        const outLen = ray.len * burst * (0.55 + nearness * 0.7) * surf.scale
        const endX = surf.x + ux * outLen
        const endY = surf.y + uy * outLen
        const alpha = (0.08 + nearness * 0.24) * burst * opacityBoost
        const warm = ray.offset % 3 < 1
        const color = warm ? rayColorWarm : rayColorCool

        const grad = ctx.createLinearGradient(surf.x, surf.y, endX, endY)
        grad.addColorStop(0, `rgba(${color}, ${alpha})`)
        grad.addColorStop(1, `rgba(${color}, 0)`)
        ctx.strokeStyle = grad
        ctx.lineWidth = 0.6 + nearness * 0.6
        ctx.beginPath()
        ctx.moveTo(surf.x, surf.y)
        ctx.lineTo(endX, endY)
        ctx.stroke()
      }

      // Ambient sphere volume glow — gives the sphere visible shape/depth
      // even before particles are drawn on top.
      const bodyGrad = ctx.createRadialGradient(cx - 16, cy - 18, 4, cx, cy, RADIUS)
      if (isDark) {
        bodyGrad.addColorStop(0, 'rgba(60, 150, 170, 0.16)')
        bodyGrad.addColorStop(0.6, 'rgba(15, 45, 60, 0.16)')
        bodyGrad.addColorStop(1, 'rgba(4, 10, 16, 0.06)')
      } else {
        // Deep navy/teal glass tint instead of near-white — otherwise the
        // sphere body is invisible against a white card.
        bodyGrad.addColorStop(0, 'rgba(140, 190, 210, 0.4)')
        bodyGrad.addColorStop(0.55, 'rgba(30, 80, 115, 0.28)')
        bodyGrad.addColorStop(1, 'rgba(8, 35, 55, 0.16)')
      }
      ctx.beginPath()
      ctx.arc(cx, cy, RADIUS, 0, Math.PI * 2)
      ctx.fillStyle = bodyGrad
      ctx.fill()

      // Particles, depth-sorted back-to-front.
      const projected = particles.map((pt, i) => {
        const p0 = sphereToVec3(pt.lat, pt.lon, RADIUS)
        const proj = project(p0, spin)
        return { ...proj, size: pt.size, twinkle: pt.twinkle, amber: amberIdx.has(i) }
      })
      projected.sort((a, b) => b.z - a.z)

      for (const p of projected) {
        const depth = p.z / RADIUS
        const nearness = (1 - depth) / 2
        const flicker = 0.85 + 0.15 * Math.sin(t * 2 + p.twinkle)
        const alpha = Math.min(1, (0.12 + nearness * 0.8) * flicker * opacityBoost)
        const r = p.size * p.scale * (0.65 + nearness * 0.6)
        const color = p.amber && nearness > 0.3 ? amberColor : dotColor

        if (nearness > 0.6 && !p.amber) {
          ctx.beginPath()
          ctx.arc(p.x, p.y, r * 2.6, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(${glowColor}, ${alpha * 0.15})`
          ctx.fill()
        }
        ctx.fillStyle = `rgba(${color}, ${alpha})`
        fillHex(ctx, p.x, p.y, r)
      }

      // Floating dust: microscopic motes drifting in a loose shell around
      // the globe (independent radius per mote, own slow orbital drift) —
      // adds parallax depth distinct from the sphere's own surface dots.
      const dustProjected = DUST.map((d) => {
        const drift = t * d.driftSpeed
        const p0 = sphereToVec3(d.lat + Math.sin(d.phase + drift) * 0.08, d.lon + drift, RADIUS * d.shellR)
        const proj = project(p0, spin * 0.6)
        return { ...proj, size: d.size, phase: d.phase }
      })
      dustProjected.sort((a, b) => b.z - a.z)

      for (const d of dustProjected) {
        const depth = d.z / (RADIUS * 1.7)
        const nearness = Math.min(1, Math.max(0, (1 - depth) / 2))
        const twinkle = 0.6 + 0.4 * Math.sin(t * 1.6 + d.phase)
        const alpha = Math.min(1, (0.08 + nearness * 0.4) * twinkle * opacityBoost)
        const r = d.size * d.scale * (0.6 + nearness * 0.5)
        ctx.fillStyle = `rgba(${dotColor}, ${alpha})`
        fillHex(ctx, d.x, d.y, r)
      }

      // Hex node markers: outward-pointing connector stem + hexagon outline,
      // filled center dot for "big" nodes.
      for (const node of NODES) {
        const p0 = sphereToVec3(deg2rad(node.lat), deg2rad(node.lon), RADIUS)
        const proj = project(p0, spin)
        if (proj.z > RADIUS * 0.25) continue // hide on the far side
        const depth = proj.z / RADIUS
        const nearness = (1 - depth) / 2
        const alpha = Math.min(1, (0.25 + nearness * 0.65) * opacityBoost)
        const stemLen = node.big ? 13 : 8
        const hexR = node.big ? 4.2 : 2.8

        // outward direction = normalize(surface point from center)
        const dx = proj.x - cx
        const dy = proj.y - cy
        const dist = Math.hypot(dx, dy) || 1
        const ux = dx / dist
        const uy = dy / dist
        const stemEndX = proj.x + ux * stemLen
        const stemEndY = proj.y + uy * stemLen

        ctx.strokeStyle = `rgba(${hexColor}, ${alpha * 0.7})`
        ctx.lineWidth = 0.8
        ctx.beginPath()
        ctx.moveTo(proj.x, proj.y)
        ctx.lineTo(stemEndX, stemEndY)
        ctx.stroke()

        ctx.beginPath()
        for (let s = 0; s < 6; s++) {
          const a = (Math.PI / 3) * s - Math.PI / 6
          const hx = stemEndX + Math.cos(a) * hexR
          const hy = stemEndY + Math.sin(a) * hexR
          if (s === 0) ctx.moveTo(hx, hy)
          else ctx.lineTo(hx, hy)
        }
        ctx.closePath()
        ctx.strokeStyle = `rgba(${hexColor}, ${alpha})`
        ctx.lineWidth = 1
        ctx.stroke()

        if (node.big) {
          ctx.beginPath()
          ctx.arc(stemEndX, stemEndY, 1.3, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(${hexColor}, ${alpha})`
          ctx.fill()
        }
      }

      // Rim.
      ctx.beginPath()
      ctx.arc(cx, cy, RADIUS, 0, Math.PI * 2)
      ctx.strokeStyle = `rgba(${dotColor}, 0.14)`
      ctx.lineWidth = 1
      ctx.stroke()

      // Binary-digit "data" text: orbits in a 3D shell around the sphere
      // using the SAME spin as the globe/particles (same direction, same
      // speed), so it visibly rotates with it and sweeps through the middle
      // orbit-ring band instead of leaving it empty. Digits mutate their
      // characters on their own interval, not just fading.
      ctx.textBaseline = 'middle'
      const digitProjected = binaryDigits.map((d) => {
        const p0 = sphereToVec3(d.lat, d.lon, RADIUS * d.shellR)
        const proj = project(p0, spin)
        return { ...proj, d }
      })
      digitProjected.sort((a, b) => b.z - a.z)

      for (const { x, y, z, d } of digitProjected) {
        if (t >= d.nextFlip) {
          const idx = Math.floor(Math.random() * d.bits.length)
          d.bits[idx] = d.bits[idx] === '1' ? '0' : '1'
          d.nextFlip = t + d.flipEvery * (0.6 + Math.random() * 0.8)
        }
        const depth = z / (RADIUS * 1.8)
        const nearness = Math.min(1, Math.max(0, (1 - depth) / 2))
        const pulse = 0.6 + 0.4 * Math.sin(t * 1.3 + d.lon)
        const color = d.hue === 'warm' ? digitColorWarm : digitColorCool
        const digitAlpha = Math.min(1, d.alpha * pulse * (0.35 + nearness * 0.75) * opacityBoost)
        ctx.fillStyle = `rgba(${color}, ${digitAlpha})`
        ctx.font = `${d.size}px monospace`
        ctx.fillText(d.bits.join(''), x, y)
      }

      raf = reduced ? 0 : requestAnimationFrame(frame)
    }

    raf = requestAnimationFrame(frame)
    return () => {
      if (raf) cancelAnimationFrame(raf)
    }
    // Re-runs on a theme switch: every colour above is chosen from the `dark`
    // prop, so the canvas must be redrawn rather than left in the old palette.
  }, [dark])

  const k = sizeProp / STAGE

  return (
    /* The outer box is the true footprint. The inner stage keeps its original
       280px geometry — the orbit rings, bloom and scan are all hardcoded pixel
       offsets around a 280px centre — and one transform scales the finished
       composition, so the DOM overlays follow the canvas exactly.
       The canvas itself is NOT relying on that transform for resolution: it
       redraws at the real size (see the useEffect above), so it stays sharp.

       The -108px lift is deliberate on the dashboard, where the card clips the
       globe's top to sit it low in a short card. Off the dashboard there is
       nothing to clip against and the lift only pushes the sphere off the top
       of the screen, so it applies at the default size only. */
    <div
      className="globe-stage pointer-events-none relative grid place-items-center outline-none"
      style={{
        width: sizeProp,
        height: sizeProp,
        marginTop: k === 1 ? -108 : 0,
      }}
      aria-hidden="true"
    >
      {/* The canvas is a direct child, NOT inside the scaled wrapper below: it
          already redraws at the full pixel size in the effect above, so putting
          it under a transform would scale it a second time and throw the
          particle field far outside the frame. */}
      <canvas ref={canvasRef} className="absolute inset-0 drop-shadow-[0_10px_34px_rgba(58,91,255,0.18)] dark:drop-shadow-[0_10px_34px_rgba(0,0,0,0.45)]" />

      {/* Only the DOM overlays get scaled. Their offsets are hardcoded around a
          280px centre (-150px margins for a 300px ring, and so on), so one
          transform keeps them aligned to the canvas rather than rewriting a
          dozen literals.

          Pinned to the centre and translated back by half its own size before
          scaling: `absolute` alone anchors a box at the parent's top-left, so
          the overlays grew out of the corner of a 1400px stage while the canvas
          stayed centred — which read as a second, offset globe. */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 grid h-[280px] w-[280px] place-items-center"
        style={{ transform: `translate(-50%, -50%) scale(${k})` }}
      >
      {/* Orbit rings. The 3D rotation and the bead riding the rim are in
          index.css (.orbit-ring) — rotateX on a perspective parent and a
          ::after pseudo-element are both out of reach of a utility class. */}
      <div
        className="orbit-ring orbit-anim-2 -ml-[150px] -mt-[150px] h-[300px] w-[300px] animate-orbit2 border-dashed"
        style={{ '--bead': dark ? '#a78bfa' : '#7c5cff' }}
      />
      <div className="orbit-ring orbit-anim-1 -ml-[129px] -mt-[129px] h-[258px] w-[258px] animate-orbit1" />

      <div className="globe-bloom relative h-[190px] w-[190px] [transform-style:preserve-3d]">
        <div className="globe-scan scan-anim pointer-events-none absolute left-1/2 top-1/2 -ml-[95px] -mt-[95px] h-[190px] w-[190px] animate-scan-spin rounded-full opacity-45" />
        <div className="globe-pulse-ring pulse-anim absolute inset-0 animate-pulse-out rounded-full border" />
        <div
          className="globe-pulse-ring pulse-anim absolute inset-0 animate-pulse-out rounded-full border"
          style={{ animationDelay: '1.7s' }}
        />
      </div>
    </div>
    </div>
  )
}
