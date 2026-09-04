import { useEffect, useRef } from 'react'

// The sign-in screen's full-bleed background: a glowing plexus-network globe
// on a canvas, ported from a standalone HTML prototype (self-contained,
// no dependencies). Replaces the earlier <video src="/globe.mp4"> — this
// draws live, so it never needs a shipped video asset or a poster frame,
// and it exposes a real hook (see startLogin below) for the sign-in button
// to trigger a "break apart" moment instead of just cutting to the next
// screen.
//
// Left mostly verbatim from the prototype: it is a self-contained animation
// loop with its own particle/sprite system, not something this app's other
// components share state with, so re-deriving it in smaller pieces would
// only make the two harder to compare against each other later.

const REF_W = 1920
const REF_H = 1080
const CX_R = 0.5
const CY_R = 0.5
const R_R = 458 / REF_H // tuned against the source radial profile

const SPRITE_LEVELS = 13 // 0 = sharp .. 12 = very soft (fine ladder)
const SPRITE_BASE = 48 // large enough for hexagon corners to resolve

const NET_N = 260 // plexus node count — every one is always fully connected
const MAXD = 0.115 // squared chord limit: short, clustered links

const DUR = 20.6333
const SPIN_PERIOD = 105 // seconds per revolution
const SPIN_PHASE = -1.06 // radians, aligns continents to the source

const FORM_DUR = 2600 // ms, slow build-in
const DEFORM_DUR = 650 // ms, fast break-apart
const FORM_SPREAD = 2.35 // start radius multiplier (relative to normal orbit)
const DEFORM_SPREAD = 3.2 // end radius multiplier on deform

function hash3(i, j, k) {
  let n = Math.imul(i | 0, 0x27d4eb2d) ^ Math.imul(j | 0, 0x165667b1) ^ Math.imul(k | 0, 0x9e3779b1)
  n ^= n >>> 15
  n = Math.imul(n, 0x85ebca6b)
  n ^= n >>> 13
  n = Math.imul(n, 0xc2b2ae35)
  n ^= n >>> 16
  return (n >>> 0) / 4294967295
}

function easeOutCubic(x) {
  return 1 - Math.pow(1 - x, 3)
}
function easeInCubic(x) {
  return x * x * x
}

/** Every element carries its own glow halo — a wide soft bloom, the shape,
 *  then a hot core — which is what gives the source its sense of volume. */
function makeSprite(level) {
  const c = document.createElement('canvas')
  c.width = c.height = SPRITE_BASE
  const g = c.getContext('2d')
  const cx = SPRITE_BASE / 2
  const blur = level * 0.09 // continuous ladder, kept inside the sprite canvas
  const R = SPRITE_BASE * 0.3 // shape radius

  const halo = g.createRadialGradient(cx, cx, 0, cx, cx, SPRITE_BASE * 0.19)
  halo.addColorStop(0.0, 'rgba(255,255,255,0.66)')
  halo.addColorStop(0.2, 'rgba(200,230,255,0.34)')
  halo.addColorStop(0.48, 'rgba(140,196,248,0.17)')
  halo.addColorStop(0.74, 'rgba(84,152,222,0.07)')
  halo.addColorStop(1.0, 'rgba(40,100,180,0)')
  g.fillStyle = halo
  g.beginPath()
  g.arc(cx, cx, SPRITE_BASE * 0.19, 0, 7)
  g.fill()

  g.filter = blur > 0 ? 'blur(' + blur.toFixed(1) + 'px)' : 'none'
  g.fillStyle = '#ffffff'
  g.beginPath()
  g.arc(cx, cx, R * 0.62, 0, 7)
  g.fill()
  return c
}

/** Anchor (cx, cy, R) for the composition at any viewport size, via a
 *  "cover" scale so the globe holds its position across aspect ratios. */
function layout(vw, vh) {
  const s = Math.max(vw / REF_W, vh / REF_H)
  return {
    cx: vw * 0.5 + (CX_R - 0.5) * REF_W * s,
    cy: vh * 0.5 + (CY_R - 0.5) * REF_H * s,
    R: R_R * REF_H * s,
  }
}

function project(x, y, z, rot, L) {
  const c = Math.cos(rot)
  const s = Math.sin(rot)
  const X = x * c + z * s
  const Z = -x * s + z * c
  return { sx: L.cx + X * L.R, sy: L.cy - y * L.R, z: Z }
}

function blit(ctx, spr, x, y, size, alpha) {
  if (alpha <= 0.035 || size < 0.8) return
  ctx.globalAlpha = alpha > 1 ? 1 : alpha
  ctx.drawImage(spr, x - size / 2, y - size / 2, size, size)
}

function buildNet() {
  const netPts = []
  for (let i = 0; i < NET_N; i++) {
    let y = 1 - (i / (NET_N - 1)) * 2
    y += (hash3(i, 1, 3) - 0.5) * 0.1
    y = Math.max(-1, Math.min(1, y))
    const r = Math.sqrt(Math.max(0, 1 - y * y))
    const th = Math.PI * (3 - Math.sqrt(5)) * i + (hash3(i, 2, 5) - 0.5) * 0.9
    const rr = 0.86 + hash3(i, 4, 9) * 0.3
    netPts.push({
      bx: Math.cos(th) * r,
      by: y,
      bz: Math.sin(th) * r,
      br: rr,
      tw: hash3(i, 6, 11) * Math.PI * 2,
      spin: (hash3(i, 7, 13) - 0.5) * 0.115,
      prec: (hash3(i, 8, 17) - 0.5) * 0.085,
      pph: hash3(i, 9, 19) * Math.PI * 2,
    })
  }
  const netLinks = []
  for (let i = 0; i < NET_N; i++) {
    const a = netPts[i]
    let b1 = -1
    let d1 = Infinity
    let b2 = -1
    let d2 = Infinity
    for (let j = i + 1; j < NET_N; j++) {
      const b = netPts[j]
      const dx = a.bx - b.bx
      const dy = a.by - b.by
      const dz = a.bz - b.bz
      const dd = dx * dx + dy * dy + dz * dz
      if (dd >= MAXD) continue
      if (dd < d1) {
        d2 = d1
        b2 = b1
        d1 = dd
        b1 = j
      } else if (dd < d2) {
        d2 = dd
        b2 = j
      }
    }
    if (b1 >= 0) netLinks.push([i, b1])
    if (b2 >= 0) netLinks.push([i, b2]) // always take the 2nd neighbour: a woven mesh
  }
  return { netPts, netLinks }
}

function buildDust() {
  const dust = []
  for (let i = 0; i < 950; i++) {
    const t = Math.random()
    dust.push({
      a: Math.random() * Math.PI * 2,
      rr: Math.pow(Math.random(), 1.9) * 1.02, // cube-biased: mostly near centre, long tail out
      sp: (Math.random() * 0.5 + 0.2) * (Math.random() < 0.5 ? -1 : 1),
      sz: 1.05 + t * t * 1.3,
      al: 0.16 + Math.random() * 0.44,
      ph: Math.random() * Math.PI * 2,
      dy: (Math.random() - 0.5) * 0.16,
      dr: (Math.random() - 0.5) * 0.1,
    })
  }
  return dust
}

/**
 * A ref, set once the effect mounts, exposing startLogin(onComplete) — call
 * it from the sign-in button so the globe visibly breaks apart as the
 * person proceeds past this screen. Purely a visual cue; it does not block
 * or perform navigation itself.
 */
export default function GlobeBackground({ apiRef }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const cv = canvasRef.current
    if (!cv) return undefined
    const ctx = cv.getContext('2d')
    if (!ctx) return undefined

    let VW = 0
    let VH = 0
    let DPR = 1
    function resize() {
      DPR = Math.min(window.devicePixelRatio || 1, 2)
      VW = window.innerWidth
      VH = window.innerHeight
      cv.width = Math.round(VW * DPR)
      cv.height = Math.round(VH * DPR)
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0)
    }
    window.addEventListener('resize', resize)
    resize()

    const SPR_DOT = []
    for (let i = 0; i < SPRITE_LEVELS; i++) SPR_DOT.push(makeSprite(i))

    const { netPts, netLinks } = buildNet()
    const dust = buildDust()

    let reduced = false
    try {
      reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    } catch {
      /* ignore */
    }

    const START = performance.now()
    let phase = 'form' // 'form' -> 'idle' -> 'deform' -> 'gone'
    let phaseStart = performance.now()
    let deformOnComplete = null

    function phaseState(now) {
      const elMs = now - phaseStart
      if (phase === 'form') {
        const t = Math.min(1, elMs / FORM_DUR)
        if (t >= 1) {
          phase = 'idle'
          phaseStart = now
        }
        const e = easeOutCubic(t)
        return { presence: e, spread: FORM_SPREAD + (1 - FORM_SPREAD) * e }
      }
      if (phase === 'deform') {
        const t = Math.min(1, elMs / DEFORM_DUR)
        const e = easeInCubic(t)
        if (t >= 1) {
          phase = 'gone'
          phaseStart = now
          if (deformOnComplete) {
            const cb = deformOnComplete
            deformOnComplete = null
            cb()
          }
        }
        return { presence: 1 - e, spread: 1 + (DEFORM_SPREAD - 1) * e }
      }
      if (phase === 'gone') return { presence: 0, spread: DEFORM_SPREAD }
      return { presence: 1, spread: 1 } // idle
    }

    if (apiRef) {
      apiRef.current = {
        startLogin(onComplete) {
          if (phase === 'deform' || phase === 'gone') return
          phase = 'deform'
          phaseStart = performance.now()
          deformOnComplete = typeof onComplete === 'function' ? onComplete : null
        },
      }
    }

    let raf = 0
    function frame(now) {
      const el = reduced ? 0 : (now - START) / 1000
      const L = layout(VW, VH)
      const rot = SPIN_PHASE + el * ((2 * Math.PI) / SPIN_PERIOD)
      const ps = phaseState(now)

      ctx.setTransform(DPR, 0, 0, DPR, 0, 0)
      ctx.globalAlpha = 1
      ctx.globalCompositeOperation = 'source-over'
      ctx.clearRect(0, 0, VW, VH)

      if (ps.presence > 0.001 || phase !== 'gone') {
        const g = ctx.createRadialGradient(
          L.cx - L.R * 0.1,
          L.cy - L.R * 0.05,
          L.R * 0.04,
          L.cx,
          L.cy,
          L.R * 1.02
        )
        g.addColorStop(0.0, 'rgba(5,28,54,0.10)')
        g.addColorStop(0.45, 'rgba(6,34,64,0.14)')
        g.addColorStop(0.78, 'rgba(8,44,80,0.22)')
        g.addColorStop(1.0, 'rgba(9,50,90,0.20)')
        ctx.fillStyle = g
        ctx.globalAlpha = ps.presence
        ctx.beginPath()
        ctx.arc(L.cx, L.cy, L.R * 1.02, 0, 7)
        ctx.fill()
        ctx.globalAlpha = 1

        ctx.globalCompositeOperation = 'lighter'

        const NR = 1.66 * ps.spread
        const np = netPts.map((p) => {
          const a1 = Math.sin(el * p.spin * 6.0 + p.pph) * 0.22
          const c1 = Math.cos(a1)
          const s1 = Math.sin(a1)
          const x = p.bx * c1 + p.bz * s1
          const z = -p.bx * s1 + p.bz * c1
          const y = p.by
          const a2 = Math.sin(el * p.prec * 6.0 + p.tw) * 0.16
          const c2 = Math.cos(a2)
          const s2 = Math.sin(a2)
          const y2 = y * c2 - z * s2
          const z2 = y * s2 + z * c2
          const rr = p.br
          return project(x * NR * rr, y2 * NR * rr, z2 * NR * rr, rot * 0.55, L)
        })
        ctx.lineWidth = 0.9
        for (const [i, j] of netLinks) {
          const a = np[i]
          const b = np[j]
          ctx.strokeStyle = 'rgba(150,196,238,' + (0.17 * 0.72 * ps.presence).toFixed(3) + ')'
          ctx.beginPath()
          ctx.moveTo(a.sx, a.sy)
          ctx.lineTo(b.sx, b.sy)
          ctx.stroke()
        }
        for (const p of np) {
          const d = p.z
          blit(ctx, SPR_DOT[0], p.sx, p.sy, d > 0 ? 8 + d * 4 : 6.5, 0.78 * 0.85 * 0.72 * ps.presence)
        }

        const cr = ctx.createRadialGradient(L.cx, L.cy, L.R * 0.93, L.cx, L.cy, L.R * 1.02)
        cr.addColorStop(0.0, 'rgba(120,180,235,0)')
        cr.addColorStop(0.72, 'rgba(150,200,240,0.055)')
        cr.addColorStop(1.0, 'rgba(190,225,252,0)')
        ctx.fillStyle = cr
        ctx.globalAlpha = ps.presence
        ctx.beginPath()
        ctx.arc(L.cx, L.cy, L.R * 1.02, 0, 7)
        ctx.fill()

        const ob = ctx.createRadialGradient(L.cx, L.cy, L.R * 0.95, L.cx, L.cy, L.R * 1.34)
        ob.addColorStop(0.0, 'rgba(126,190,240,0)')
        ob.addColorStop(0.08, 'rgba(126,190,240,0.72)')
        ob.addColorStop(0.28, 'rgba(98,166,222,0.54)')
        ob.addColorStop(0.6, 'rgba(58,124,188,0.26)')
        ob.addColorStop(1.0, 'rgba(18,56,112,0)')
        ctx.fillStyle = ob
        ctx.beginPath()
        ctx.arc(L.cx, L.cy, L.R * 1.34, 0, 7)
        ctx.fill()
        ctx.globalAlpha = 1

        const scale = L.R / 440
        for (const d of dust) {
          const a2 = d.a + el * 0.03 * d.sp
          const rr2 = d.rr + Math.sin(el * 0.11 + d.ph) * d.dr
          const x = L.cx + Math.cos(a2) * L.R * rr2
          const y = L.cy + Math.sin(a2) * L.R * rr2 * 0.92 + d.dy * L.R * 0.22
          const al = d.al * 0.81 * ps.presence
          blit(ctx, SPR_DOT[0], x, y, d.sz * scale * 2.0, al)
        }

        ctx.globalAlpha = 1
        ctx.globalCompositeOperation = 'source-over'
      }

      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    return () => {
      window.removeEventListener('resize', resize)
      if (raf) cancelAnimationFrame(raf)
      if (apiRef) apiRef.current = null
    }
  }, [apiRef])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full select-none"
    />
  )
}
