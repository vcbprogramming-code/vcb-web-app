import { useEffect, useState } from 'react'
import type { CSSVarStyle } from './types'

// Pure-CSS 3D globe — markup ported verbatim from index.html.
// The `--i` custom property drives each wireframe line's staggered draw-in delay.
const i = (n: number): CSSVarStyle => ({ '--i': n })

interface PreviewApp {
  name: string
  preview: string
  accent: string
}

interface GlobeProps {
  onActivate?: () => void
  label?: string
  mission: string[]
  previewApp?: PreviewApp | null | undefined
}

export default function Globe({ onActivate, label, mission, previewApp }: GlobeProps) {
  const [isTouch, setIsTouch] = useState(false)
  const [missionOpen, setMissionOpen] = useState(false)
  // Content shown right now, kept one tick behind `previewApp`/`mission` so a
  // change first fades the text out, then swaps it, then fades back in —
  // matching the crossfade in index.html instead of an instant text cut.
  const [displayedApp, setDisplayedApp] = useState(previewApp ?? null)
  const [swapping, setSwapping] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(hover: none), (pointer: coarse)')
    setIsTouch(mq.matches)
  }, [])

  useEffect(() => {
    const next = previewApp ?? null
    if (next === displayedApp) return
    setSwapping(true)
    const t = window.setTimeout(() => {
      setDisplayedApp(next)
      setSwapping(false)
    }, 180)
    return () => window.clearTimeout(t)
    // displayedApp intentionally omitted: this effect only reacts to previewApp changing
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewApp])

  useEffect(() => {
    if (!missionOpen) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setMissionOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [missionOpen])

  function handleClick() {
    if (isTouch) {
      setMissionOpen((open) => !open)
    } else {
      onActivate?.()
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (isTouch) setMissionOpen((open) => !open)
      else onActivate?.()
    }
  }

  return (
    <div
      className={`globe-stage${missionOpen ? ' is-open' : ''}${previewApp ? ' card-hover' : ''}`}
      style={displayedApp ? ({ '--mission-accent': displayedApp.accent } as CSSVarStyle) : undefined}
      role="button"
      tabIndex={0}
      aria-label={isTouch ? 'Show VCB Connect mission' : label}
      aria-describedby="globe-mission"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      <div
        className="globe-mission"
        id="globe-mission"
        role="tooltip"
        onClick={
          isTouch
            ? (e) => {
                e.stopPropagation()
                setMissionOpen(false)
              }
            : undefined
        }
      >
        <div
          id="globe-mission-text"
          className={`${swapping ? 'swapping' : ''}${displayedApp ? ' app-preview' : ''}`}
        >
          {displayedApp ? (
            <>
              <p className="globe-mission-app-name">{displayedApp.name}</p>
              <p>{displayedApp.preview}</p>
            </>
          ) : (
            mission.map((paragraph, idx) => <p key={idx}>{paragraph}</p>)
          )}
        </div>
      </div>
      {isTouch && (
        <div
          className="globe-mission-backdrop"
          onClick={(e) => {
            e.stopPropagation()
            setMissionOpen(false)
          }}
        ></div>
      )}
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
