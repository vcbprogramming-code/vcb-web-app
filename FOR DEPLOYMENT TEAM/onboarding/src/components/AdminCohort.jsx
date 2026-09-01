import { useEffect, useState } from 'react';
import { useI18n } from '@vcb/shared';
import { listAdminEmployees } from '../lib/onboardingApi.js';
import { ErrorBanner, Section } from './ui.jsx';

// Who is onboarding, and how far along.
//
// GET /api/onboarding/admin/employees — requireAuth + requireRole('portal',
// 'admin'). This endpoint existed in the API with nothing calling it; the old
// Supabase-era admin page had no cohort view at all, because reading the whole
// employees table from the browser would have meant an anon-key select over
// every row. Now that the API owns the query and the role check, showing it is
// both safe and useful: an admin can see who has started and who has stalled.
//
// The bar is hand-drawn from a div, not a chart library — TECH_STACK.md rules
// those out, and a single proportion needs no library anyway. tasks_done has
// no denominator in the API response (the API does not know how many items a
// department's content defines), so this shows the COUNT and scales the bar
// against the largest count in the cohort rather than inventing a percentage.

export default function AdminCohort() {
  const { t, formatDate } = useI18n();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const list = await listAdminEmployees({ signal: controller.signal });
        setRows(list ?? []);
      } catch (err) {
        if (err?.name === 'AbortError') return;
        setError('admin.cohortLoadFailed');
      }
    })();
    return () => controller.abort();
  }, []);

  if (error) {
    return (
      <Section title={t('admin.cohort')}>
        <ErrorBanner>{t(error)}</ErrorBanner>
      </Section>
    );
  }

  if (!rows) {
    return (
      <Section title={t('admin.cohort')}>
        <p className="text-sm text-ink-muted dark:text-ink-dark-muted">{t('common.loading')}</p>
      </Section>
    );
  }

  if (rows.length === 0) {
    return (
      <Section title={t('admin.cohort')}>
        <p className="text-sm text-ink-muted dark:text-ink-dark-muted">{t('common.empty')}</p>
      </Section>
    );
  }

  const maxDone = Math.max(1, ...rows.map((r) => r.tasks_done || 0));

  return (
    <Section title={t('admin.cohort')}>
      {/* The table scrolls inside its own container so a long department name
          never makes the whole page scroll sideways. */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-line text-left dark:border-line-dark">
              <th className="py-2 pr-4 font-semibold">{t('auth.name')}</th>
              <th className="py-2 pr-4 font-semibold">{t('cert.department')}</th>
              <th className="py-2 pr-4 font-semibold">{t('cert.track')}</th>
              <th className="py-2 pr-4 font-semibold">{t('admin.tasksDone')}</th>
              <th className="py-2 font-semibold">{t('date.date')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name} className="border-b border-line/60 dark:border-line-dark/60">
                <td className="py-2 pr-4 font-medium">{r.name}</td>
                <td className="py-2 pr-4 text-ink-muted dark:text-ink-dark-muted">
                  {r.department || '—'}
                </td>
                <td className="py-2 pr-4 text-ink-muted dark:text-ink-dark-muted">
                  {t(r.level === 'senior' ? 'checklist.senior' : 'checklist.junior')}
                </td>
                <td className="py-2 pr-4">
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-24 overflow-hidden rounded-pill bg-surface-sunken dark:bg-surface-dark-sunken">
                      <span
                        className="block h-full rounded-pill bg-accent dark:bg-accent-dark"
                        style={{ width: `${((r.tasks_done || 0) / maxDone) * 100}%` }}
                      />
                    </span>
                    <span className="tabular-nums">{r.tasks_done ?? 0}</span>
                  </span>
                </td>
                <td className="py-2 text-ink-muted dark:text-ink-dark-muted">
                  {r.created_at ? formatDate(r.created_at) : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}
