import { useState } from 'react'
import { ACTIVITIES, CATEGORIES } from './mock'
import { useSettings } from './settings'

export default function WorkIndex() {
  const { t } = useSettings()
  const [tab, setTab] = useState<'work' | 'cost'>('work')
  return (
    <>
      <div className="card" style={{ padding: '.85rem 1.1rem .2rem' }}>
        <h1 style={{ margin: 0 }}>{t('ดัชนีงาน')}</h1>
        <div className="sub" style={{ margin: '.1rem 0 .55rem' }}>
          {t('รายการมาตรฐานที่ใช้บันทึกงาน — แต่ละเซลล์เลือก 2 ชั้น: กิจกรรม แล้วตามด้วย หมวดงาน')}
        </div>
        <div className="idx-tabs">
          <button className={'idx-tab' + (tab === 'work' ? ' on' : '')} onClick={() => setTab('work')}>{t('กิจกรรม (Activity)')}</button>
          <button className={'idx-tab' + (tab === 'cost' ? ' on' : '')} onClick={() => setTab('cost')}>{t('หมวดงาน (Work Category)')}</button>
        </div>
      </div>

      <div className="card">
        {tab === 'work' ? (
          <>
            <div className="idx-toolbar">
              <span className="hint">{t('กิจกรรม (Activity)')} · {ACTIVITIES.length} {t('รายการ')}</span>
              <div className="idx-actions">
                <button className="btn xls-btn">⬇ Excel</button>
                <button className="btn sec idx-import">⬆ {t('นำเข้า')}</button>
                <button className="btn">{t('+ เพิ่มกิจกรรม')}</button>
              </div>
            </div>
            <table>
              <thead>
                <tr>
                  <th style={{ width: 80 }}>{t('รหัส')}</th>
                  <th style={{ width: 320 }}>{t('กิจกรรม (Activity)')}</th>
                  <th>{t('หมวดหมู่ (Category)')}</th>
                  <th style={{ width: 120 }}>{t('การจับคู่')}</th>
                  <th style={{ width: 150 }}></th>
                </tr>
              </thead>
              <tbody>
                {ACTIVITIES.map((a) => (
                  <tr key={a.code}>
                    <td><code style={{ fontWeight: 700, color: 'var(--blue)' }}>{a.code}</code></td>
                    <td><b>{a.name}</b></td>
                    <td className="hint">{a.category}</td>
                    <td>
                      <span className={'pill ' + (a.mapping === 'one-to-one' ? 'op' : 'sup')}>
                        {a.mapping === 'one-to-one' ? '1:1 · ' + (a.fixed_cost || '') : '1:N'}
                      </span>
                    </td>
                    <td className="right" style={{ whiteSpace: 'nowrap' }}>
                      <button className="btn sec">{t('แก้ไข')}</button>{' '}
                      <button className="btn sec" style={{ color: '#b3261e' }}>{t('ลบ')}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : (
          <>
            <div className="idx-toolbar">
              <span className="hint">{t('หมวดงาน (Work Category)')} · {CATEGORIES.length} {t('รายการ')}</span>
              <div className="idx-actions">
                <button className="btn xls-btn">⬇ Excel</button>
                <button className="btn sec idx-import">⬆ {t('นำเข้า')}</button>
                <button className="btn">{t('+ เพิ่มหมวดงาน')}</button>
              </div>
            </div>
            <table>
              <thead>
                <tr>
                  <th style={{ width: 80 }}>{t('รหัส')}</th>
                  <th style={{ width: 320 }}>{t('หมวดงาน (ไทย)')}</th>
                  <th>Work Category (English)</th>
                  <th style={{ width: 170 }}></th>
                </tr>
              </thead>
              <tbody>
                {CATEGORIES.map((c) => (
                  <tr key={c.id}>
                    <td><code style={{ fontWeight: 700, color: 'var(--blue)' }}>{c.code}</code></td>
                    <td><b>{c.name}</b></td>
                    <td className="hint" style={{ fontSize: '.85rem' }}>{c.name_en}</td>
                    <td className="right" style={{ whiteSpace: 'nowrap' }}>
                      <button className="btn sec">{t('แก้ไข')}</button>{' '}
                      <button className="btn sec" style={{ color: '#b3261e' }}>{t('ลบ')}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </>
  )
}
