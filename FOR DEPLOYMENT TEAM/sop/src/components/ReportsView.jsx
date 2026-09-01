/**
 * "Which report do I run" — the full-width report table.
 *
 * No list pane here, which is what the old body.reports-mode class expressed;
 * App.jsx does it with a different grid instead.
 *
 * New since the port: an editor can DELETE a row. The API has always exposed
 * DELETE /api/sop/reports/:case; the canonical UI only ever added rows, so a
 * mistyped one could not be removed from the app at all.
 */

import { useMemo, useState } from 'react';
import { useI18n } from '@vcb/shared';

import { Icon } from '../lib/icons.jsx';
import { errorKey } from '../lib/sopApi.js';
import { STATUS, useStore } from '../store.jsx';
import { BackBar, Button, Empty, Field, Modal, Notice, Spinner, TextArea, TextInput } from './ui.jsx';

const NOTEBOOK_LM_URL =
  'https://notebooklm.google.com/notebook/17c8699a-9e2d-4d3b-8a74-51a3cf8ba64c';

/* ------------------------------- new report ------------------------------- */

function NewReportModal({ onClose }) {
  const { t } = useI18n();
  const { reports, createReport } = useStore();

  const [caseNo, setCaseNo] = useState(
    () => (reports.length ? reports[reports.length - 1].case + 1 : 1)
  );
  const [scenario, setScenario] = useState('');
  const [path, setPath] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  async function save() {
    const s = scenario.trim();
    const p = path.trim();
    if (!s || !p) {
      setErr({ code: 'VALIDATION_FAILED' });
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      await createReport({ case: caseNo, scenario: s, path: p });
      onClose();
    } catch (e) {
      // The write was rejected — the row was NOT added. Stay open with the
      // typing intact so it can be retried after a refresh.
      setErr(e);
      setSaving(false);
    }
  }

  return (
    <Modal
      title={t('reports.newTitle')}
      onClose={onClose}
      size="md"
      footer={
        <>
          <Button onClick={onClose} className="ml-auto">
            {t('common.cancel')}
          </Button>
          <Button variant="primary" onClick={save} disabled={saving}>
            {saving ? t('common.saving') : t('common.save')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3.5">
        {err && (
          <Notice tone="danger">
            {err.code === 'VALIDATION_FAILED' ? t('reports.required') : t(errorKey(err))}
          </Notice>
        )}

        <Field label={t('reports.caseNo')}>
          <TextInput
            type="number"
            min={1}
            placeholder={t('reports.caseNoPh')}
            value={caseNo}
            onChange={(e) => setCaseNo(parseInt(e.target.value, 10) || 0)}
          />
        </Field>

        <Field label={t('reports.col2')}>
          <TextArea rows={2} value={scenario} onChange={(e) => setScenario(e.target.value)} />
        </Field>

        <Field label={t('reports.col3')}>
          <TextInput
            type="text"
            placeholder={t('reports.pathPh')}
            value={path}
            onChange={(e) => setPath(e.target.value)}
          />
        </Field>
      </div>
    </Modal>
  );
}

/* --------------------------------- table ---------------------------------- */

export default function ReportsView() {
  const { t } = useI18n();
  const { reports, status, query, canEdit, deleteReport, writeError, clearWriteError } = useStore();
  const [adding, setAdding] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);

  const q = query.trim().toLowerCase();
  const rows = useMemo(
    () =>
      reports.filter(
        (r) => !q || `${r.case} ${r.scenario} ${r.path}`.toLowerCase().includes(q)
      ),
    [reports, q]
  );

  if (status === STATUS.loading) return <Spinner />;

  return (
    <div>
      <BackBar to="/cases" label={t('detail.backModules')} />

      <div className="px-4 py-5 sm:px-6">
        <header className="mb-4 flex flex-wrap items-center gap-3 border-b border-line pb-3.5 dark:border-line-dark">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300">
            <Icon name="barchart" className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold break-thai">{t('reports.header')}</h1>
            <p className="text-[13px] text-ink-muted dark:text-ink-dark-muted">
              {t('reports.sub', { n: rows.length, t: reports.length })}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {canEdit && (
              <Button variant="primary" onClick={() => setAdding(true)}>
                <Icon name="plus" className="h-4 w-4" />
                <span className="hidden sm:inline">{t('reports.new')}</span>
              </Button>
            )}
            <a href={NOTEBOOK_LM_URL} target="_blank" rel="noopener noreferrer">
              <Button>
                <Icon name="externalLink" className="h-4 w-4" />
                <span className="hidden sm:inline">{t('reports.notebookLM')}</span>
              </Button>
            </a>
          </div>
        </header>

        {writeError && (
          <Notice tone="danger" className="mb-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex-1">{t(errorKey(writeError))}</span>
              <Button onClick={clearWriteError} className="py-1 text-xs">
                {t('common.close')}
              </Button>
            </div>
          </Notice>
        )}

        {rows.length === 0 ? (
          <Empty>{t('reports.none')}</Empty>
        ) : (
          // The table scrolls inside its own box; the page never scrolls
          // sideways, and Menu Path values are long.
          <div className="overflow-x-auto rounded-card border border-line dark:border-line-dark">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="bg-surface-sunken text-left dark:bg-surface-dark-sunken">
                  <th className="w-14 px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-ink-muted dark:text-ink-dark-muted">
                    {t('reports.col1')}
                  </th>
                  <th className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-ink-muted dark:text-ink-dark-muted">
                    {t('reports.col2')}
                  </th>
                  <th className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-ink-muted dark:text-ink-dark-muted">
                    {t('reports.col3')}
                  </th>
                  {canEdit && <th className="w-12 px-2 py-2.5" aria-label={t('common.delete')} />}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr
                    key={`${r.case}-${i}`}
                    className="border-t border-line hover:bg-surface-sunken dark:border-line-dark dark:hover:bg-surface-dark-sunken"
                  >
                    <td className="px-3 py-2.5 align-top font-bold text-brand-700 dark:text-brand-300">
                      {r.case}
                    </td>
                    <td className="px-3 py-2.5 align-top break-thai">{r.scenario}</td>
                    <td className="px-3 py-2.5 align-top font-mono text-[12px] text-ink-subtle break-thai dark:text-ink-dark-muted">
                      {r.path}
                    </td>
                    {canEdit && (
                      <td className="px-2 py-2.5 align-top">
                        {pendingDelete === r.case ? (
                          <span className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  await deleteReport(r.case);
                                } finally {
                                  setPendingDelete(null);
                                }
                              }}
                              className="rounded px-1.5 py-0.5 text-[11px] font-bold text-danger hover:bg-danger-bg dark:text-danger-dark"
                            >
                              {t('common.confirm')}
                            </button>
                            <button
                              type="button"
                              onClick={() => setPendingDelete(null)}
                              className="rounded px-1.5 py-0.5 text-[11px] text-ink-muted hover:bg-surface-sunken dark:text-ink-dark-muted"
                            >
                              {t('common.cancel')}
                            </button>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setPendingDelete(r.case)}
                            title={t('reports.delete')}
                            aria-label={t('reports.delete')}
                            className="rounded p-1 text-ink-muted hover:bg-danger-bg hover:text-danger dark:text-ink-dark-muted dark:hover:bg-danger/20 dark:hover:text-danger-dark"
                          >
                            <span aria-hidden="true">×</span>
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {adding && <NewReportModal onClose={() => setAdding(false)} />}
    </div>
  );
}
