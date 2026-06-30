import type { CSSVarStyle } from './types'

// Pure-CSS 3D globe — markup ported verbatim from index.html.
// The `--i` custom property drives each wireframe line's staggered draw-in delay.
const i = (n: number): CSSVarStyle => ({ '--i': n })

export default function Globe() {
  return (
    <div className="globe-stage">
      <div className="orbit orbit-2"></div>
      <div className="orbit orbit-1"></div>
      <div className="globe-wrap">
        <div className="globe">
          <div className="globe-core"></div>
          <div className="meridian m1" style={i(1)}></div>
          <div className="meridian m2" style={i(2)}></div>
          <div className="meridian m3" style={i(3)}></div>
          <div className="meridian m4" style={i(4)}></div>
          <div className="meridian m5" style={i(5)}></div>
          <div className="meridian m6" style={i(6)}></div>
          <div className="parallel p-eq" style={i(7)}></div>
          <div className="parallel p-n30" style={i(8)}></div>
          <div className="parallel p-s30" style={i(9)}></div>
          <div className="parallel p-n60" style={i(10)}></div>
          <div className="parallel p-s60" style={i(11)}></div>
        </div>
        <div className="scan"></div>
        <div className="globe-pulse"></div>
        <div className="globe-pulse p2"></div>
      </div>
    </div>
  )
}
