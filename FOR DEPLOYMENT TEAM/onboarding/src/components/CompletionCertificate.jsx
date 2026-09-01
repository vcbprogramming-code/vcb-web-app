import { Fragment } from 'react';
import { useI18n } from '@vcb/shared';
import { useContentText } from '../lib/contentText.js';

// The printable performance-review form, ported from the original app's
// buildCompletionCertificateHtml (progress.html). The original built it as a
// raw HTML string opened in a new window; here it is a real component printed
// via window.print() from CompletionPage.
//
// Structure is unchanged: letterhead, meta, one rated table per phase
// (Required Reading deliberately excluded — whether someone read the material
// is already proven, or not, by whether they could produce Required Outputs),
// then a page-2 attitude section and signature blocks.
//
// Styling is print-first: fixed black-on-white, no dark: variants. This is
// only ever rendered inside `print:block`, and a certificate that came out of
// the printer in dark-mode colours would be unreadable.

const ATTITUDE_KEYS = [
  'cert.attitude.discipline',
  'cert.attitude.teamwork',
  'cert.attitude.communication',
  'cert.attitude.initiative',
  'cert.attitude.reliability',
  'cert.attitude.adaptability',
];

function RatingDots() {
  return (
    <span className="flex gap-1.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-black/40 text-[0.65rem]"
        >
          {n}
        </span>
      ))}
    </span>
  );
}

function isItemVisible(item, level) {
  return item.level !== 'senior' || level === 'senior';
}

export default function CompletionCertificate({ name, dept, level }) {
  const { t, formatDate } = useI18n();
  const tc = useContentText();
  const today = formatDate(new Date(), { year: 'numeric', month: 'long', day: 'numeric' });

  const meta = [
    [t('cert.employee'), name],
    [t('cert.department'), tc(dept.content.title)],
    [t('cert.track'), t(level === 'senior' ? 'checklist.senior' : 'checklist.junior')],
    [t('cert.date'), today],
  ];

  return (
    <div className="bg-white p-8 text-black">
      <header className="mb-6 border-b-2 border-black pb-3">
        <div className="text-xl font-extrabold">{t('app.company')}</div>
        <div className="text-sm">{t('cert.subtitle')}</div>
      </header>

      <div className="mb-6 grid grid-cols-2 gap-3">
        {meta.map(([label, value]) => (
          <div key={label} className="flex flex-col">
            <span className="text-[0.7rem] uppercase tracking-wide text-black/60">{label}</span>
            <span className="font-semibold">{value}</span>
          </div>
        ))}
      </div>

      {dept.content.phases.map((phase) => (
        <table key={phase.dayRange} className="mb-6 w-full border-collapse text-sm">
          <colgroup>
            <col />
            <col className="w-[220px]" />
          </colgroup>
          <tbody>
            <tr>
              <td colSpan={2} className="border-b border-black bg-black/5 px-2 py-1.5 font-bold">
                {tc(phase.page.eyebrow)}
              </td>
            </tr>
            {phase.page.blocks
              .filter((block) => block.heading !== 'Required Reading')
              .map((block) => (
                // Fragment with an explicit key: a block contributes a header
                // row plus its item rows, and React needs the key on the
                // wrapper. The pre-conversion version used a bare <> here,
                // which warns and makes reconciliation positional.
                <Fragment key={block.heading}>
                  <tr>
                    <td colSpan={2} className="border-b border-black/20 px-2 py-1.5">
                      <span className="font-semibold">{tc(block.heading)}</span>
                      <span className="ml-2 rounded-pill border border-black/30 px-2 py-0.5 text-[0.6rem]">
                        {t('cert.rating')}
                      </span>
                    </td>
                  </tr>
                  {block.items
                    .filter((item) => isItemVisible(item, level))
                    .map((item) => (
                      <tr key={item.id}>
                        <td className="border-b border-black/10 px-2 py-1.5 align-top">
                          <span className="mr-1.5">✓</span>
                          {tc(item.text)}
                          {item.level === 'senior' && (
                            <span className="ml-2 rounded-pill border border-black/30 px-1.5 py-0.5 text-[0.6rem]">
                              {t('checklist.senior')}
                            </span>
                          )}
                        </td>
                        <td className="border-b border-black/10 px-2 py-1.5">
                          <RatingDots />
                        </td>
                      </tr>
                    ))}
                </Fragment>
              ))}
          </tbody>
        </table>
      ))}

      {/* break-before-page is a real print rule Tailwind does express. */}
      <div className="break-before-page" />
      <h2 className="mb-1 mt-6 text-lg font-bold">{t('cert.attitudeTitle')}</h2>
      <p className="mb-4 text-sm text-black/70">{t('cert.attitudeSub')}</p>

      {ATTITUDE_KEYS.map((key) => (
        <div key={key} className="flex items-center justify-between border-b border-black/10 py-2">
          <span className="text-sm">{t(key)}</span>
          <RatingDots />
        </div>
      ))}

      <div className="mt-4 h-24 border border-black/20" />

      <div className="mt-10 grid grid-cols-2 gap-10">
        <div>
          <div className="border-b border-black" />
          <div className="mt-1 text-xs">
            {t('cert.employeeSignature')} — {name}
          </div>
        </div>
        <div>
          <div className="border-b border-black" />
          <div className="mt-1 text-xs">
            {t('cert.headSignature')} — {dept.content.supervisor.split(' (')[0]}
          </div>
        </div>
      </div>

      <div className="mt-8 text-center text-[0.7rem] text-black/60">{t('cert.footer')}</div>
    </div>
  );
}
