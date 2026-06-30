import type { ReactNode } from 'react'
import { BOOT, SITES } from './mock'
import { useSettings } from './settings'

function Seg<T extends string>({ value, onChange, options }:
  { value: T; onChange: (v: T) => void; options: [T, string][] }) {
  return (
    <div className="seg">
      {options.map(([v, l]) => (
        <button key={v} className={value === v ? 'on' : ''} onClick={() => onChange(v)}>{l}</button>
      ))}
    </div>
  )
}

function Row({ title, desc, children }: { title: string; desc?: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', padding: '.7rem 0', borderBottom: '1px solid var(--sett-cardline)' }}>
      <div>
        <div style={{ fontWeight: 700 }}>{title}</div>
        {desc && <div className="hint">{desc}</div>}
      </div>
      <div>{children}</div>
    </div>
  )
}

export default function SettingsPage() {
  const s = useSettings()
  const { t } = s
  return (
    <div className="wrap narrow" style={{ padding: 0 }}>
      <div className="card" style={{ padding: '.85rem 1.1rem' }}>
        <h1 style={{ margin: 0 }}>⚙️ {t('ตั้งค่า')}</h1>
        <div className="sub" style={{ margin: '.1rem 0 0' }}>{t('ปรับแต่งการแสดงผลและการทำงานของระบบ')}</div>
      </div>

      <div className="card">
        <h2>{t('การแสดงผล')}</h2>
        <Row title={t('ธีม')} desc="light / dark / auto">
          <Seg value={s.theme} onChange={s.setTheme}
            options={[['light', '☀ ' + t('สว่าง')], ['dark', '🌙 ' + t('มืด')], ['auto', t('อัตโนมัติ')]]} />
        </Row>
        <Row title={t('ภาษา')} desc="ไทย / English">
          <Seg value={s.lang} onChange={s.setLang} options={[['th', 'ไทย'], ['en', 'EN']]} />
        </Row>
        <Row title={t('รูปแบบปี')} desc="2569 / 2026">
          <Seg value={s.yearFmt} onChange={s.setYearFmt} options={[['be', 'พ.ศ.'], ['ce', 'ค.ศ.']]} />
        </Row>
        <Row title={t('มุมมองเริ่มต้นของแดชบอร์ด')}>
          <Seg value={s.dashDefault} onChange={s.setDashDefault}
            options={[['progress', t('ความคืบหน้า')], ['topact', t('กิจกรรมหลัก')], ['topcost', t('หมวดงานหลัก')]]} />
        </Row>
        <Row title={t('การแสดงในตารางสัปดาห์')} desc={t('แสดงเซลล์เป็นรหัส หรือชื่อกิจกรรมเต็ม')}>
          <Seg value={s.cellNames} onChange={s.setCellNames} options={[['code', t('รหัส')], ['name', t('ชื่อเต็ม')]]} />
        </Row>
      </div>

      <div className="card">
        <h2>{t('หน่วยงานที่แสดง')}</h2>
        <div className="sub">{t('ซ่อนหน่วยงานที่ทำเสร็จแล้วออกจากแดชบอร์ด (เฉพาะอุปกรณ์นี้)')}</div>
        {SITES.map((site) => {
          const hidden = s.hiddenSites.includes(site.key)
          return (
            <Row key={site.key} title={site.name} desc={site.company}>
              <Seg value={hidden ? 'hide' : 'show'} onChange={(v) => s.toggleSite(site.key, v === 'hide')}
                options={[['show', t('แสดง')], ['hide', t('ซ่อน')]]} />
            </Row>
          )
        })}
      </div>

      <div className="card">
        <h2>{t('ระบบ')}</h2>
        <Row title="LOCK_DAYS" desc={t('จำนวนวันที่ยังแก้เซลล์ย้อนหลังได้ (0–30)')}>
          <input type="number" defaultValue={3} min={0} max={30} style={{ width: 90 }} />
        </Row>
        <Row title={t('คู่มือการใช้งาน')}>
          <button className="btn sec">{t('เปิดคู่มือ')}</button>
        </Row>
      </div>

      <div className="card">
        <h2>{t('เกี่ยวกับระบบ')}</h2>
        <Row title={t('เวอร์ชัน')}><code>react-0.1.0</code></Row>
        <Row title={t('ผู้ใช้งาน')}><span>{BOOT.email}</span></Row>
        <Row title={t('สิทธิ์')}><span className="pill sup">{BOOT.role}</span></Row>
        <Row title={t('หน่วยงานที่ดูแล')}><span>{BOOT.sites.length}</span></Row>
      </div>
    </div>
  )
}
