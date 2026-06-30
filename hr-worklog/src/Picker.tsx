import React, { useState, useEffect, useRef, useLayoutEffect } from 'react'
import type { Activity, Category } from './types'
import { useSettings } from './settings'

interface Props {
  anchor: HTMLElement
  activities: Activity[]
  categories: Category[]
  onApply: (value: string) => void
  onClose: () => void
}

// Two-step searchable picker — faithful port of the GAS oppOpen/oppRender/oppPick
// flow. Step 1 = กิจกรรม (Activity), Step 2 = หมวดงาน (Work Category). one-to-one
// activities skip step 2 and auto-assign their fixed cost. Stored value = "A-1 / 5".
export default function Picker({ anchor, activities, categories, onApply, onClose }: Props) {
  const { t } = useSettings()
  const [step, setStep] = useState<1 | 2>(1)
  const [q, setQ] = useState('')
  const [pending, setPending] = useState<Activity | null>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const [pos, setPos] = useState({ left: 0, top: 0, width: 360, maxHeight: 460 })

  useLayoutEffect(() => {
    const r = anchor.getBoundingClientRect()
    const vw = window.innerWidth, vh = window.innerHeight, margin = 8, gap = 4
    const w = Math.min(560, vw - 2 * margin)
    const left = Math.max(margin, Math.min(r.left, vw - w - margin))
    const spaceBelow = vh - r.bottom - margin - gap
    const spaceAbove = r.top - margin - gap
    let h: number, top: number
    if (Math.max(spaceBelow, spaceAbove) < 260) {
      h = Math.min(460, vh - 2 * margin); top = Math.max(margin, Math.round((vh - h) / 2))
    } else if (spaceBelow >= spaceAbove) {
      h = Math.min(460, spaceBelow); top = r.bottom + gap
    } else {
      h = Math.min(460, spaceAbove); top = Math.max(margin, r.top - gap - h)
    }
    setPos({ left, top, width: w, maxHeight: h })
  }, [anchor, step])

  useEffect(() => { searchRef.current?.focus() }, [step])

  useEffect(() => {
    function onDown(e: MouseEvent) { if (boxRef.current && !boxRef.current.contains(e.target as Node)) onClose() }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { if (step === 2) { setStep(1); setQ('') } else onClose() }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [step, onClose])

  const items: (Activity | Category)[] = step === 1 ? activities : categories
  const query = q.trim().toLowerCase()
  const filtered = query
    ? items.filter((it) => {
      const a = it as Activity
      return [a.name, a.desc, a.category, a.code].some((x) => String(x || '').toLowerCase().includes(query))
    })
    : items

  const groups: Record<string, (Activity | Category)[]> = {}
  const order: string[] = []
  filtered.forEach((it) => {
    const c = step === 1 ? (String((it as Activity).category || '').trim() || 'อื่น ๆ') : t('หมวดงาน (Work Category)')
    if (!groups[c]) { groups[c] = []; order.push(c) }
    groups[c].push(it)
  })

  function pick(it: Activity | Category) {
    if (step === 1) {
      const a = it as Activity
      const oneToOne = (a.mapping || 'one-to-many') === 'one-to-one'
      if (oneToOne) { onApply(a.fixed_cost ? `${a.code} / ${a.fixed_cost}` : a.code); return }
      setPending(a); setStep(2); setQ('')
    } else {
      onApply(`${pending ? pending.code : ''} / ${(it as Category).code}`)
    }
  }

  return (
    <div id="opPicker" className="open" ref={boxRef}
      style={{ left: pos.left, top: pos.top, width: pos.width, maxHeight: pos.maxHeight }}>
      <div id="opPickerTitle" className={step === 2 ? 'back' : ''}
        onMouseDown={(e) => { e.preventDefault(); if (step === 2) { setStep(1); setQ('') } }}>
        {step === 1
          ? <><span className="opp-step">1/2</span> {t('เลือกกิจกรรม (Activity)')}</>
          : <><span className="opp-back">‹</span> <span className="opp-step">2/2</span> {t('เลือกหมวดงาน')} · {t('งาน')}: <b>{pending?.code}</b></>}
      </div>
      <div id="opPickerHead">
        <input id="opPickerSearch" ref={searchRef} type="text" placeholder={t('ค้นหา…')} autoComplete="off"
          value={q} onChange={(e) => setQ(e.target.value)} />
        <span id="opPickerCount">{filtered.length}/{items.length}</span>
        <button className="opp-clear" title={t('ล้างเซลล์')} onMouseDown={(e) => { e.preventDefault(); onApply('') }}>{t('ล้าง')}</button>
      </div>
      <div id="opPickerList">
        {order.length === 0
          ? <div className="opp-empty">{t('ไม่พบรายการ')} "{q}"</div>
          : order.map((c) => (
            <React.Fragment key={c}>
              <div className="opp-cat">{c}</div>
              {groups[c].map((it) => {
                const a = it as Activity
                const oneToOne = step === 1 && (a.mapping || 'one-to-many') === 'one-to-one'
                return (
                  <div key={a.code} className="opp-item" onMouseDown={(e) => { e.preventDefault(); pick(it) }}>
                    <div className="opp-name">
                      {a.code && <span className="opp-code">{a.code}</span>}
                      {step === 1 && a.code && (
                        <span className={'opp-dot ' + (oneToOne ? 'fixed' : 'many')}
                          title={oneToOne ? t('กำหนดต้นทุนอัตโนมัติ · เลือกขั้นตอนเดียว') : t('เลือกหมวดต้นทุนต่อ · 2 ขั้นตอน')} />
                      )}
                      {a.name}
                    </div>
                    {a.desc && <div className="opp-desc">{a.desc}</div>}
                  </div>
                )
              })}
            </React.Fragment>
          ))}
      </div>
    </div>
  )
}
