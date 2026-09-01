import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useI18n } from '@vcb/shared';
import { useHrData } from './HrData';
import { Button, Card, Field, Flash, Hint, Segmented, Select, Spinner, TextInput } from './ui';
import { cancelLeave, decideLeave, getRoster, listLeave, requestLeave, LEAVE_TYPES } from './lib/hrApi';
import { errorMessage } from './lib/errors';
import { dayCount, fmtDate, fmtRange, shortBy } from './lib/dates';

/* ---------------------------------------------------------------------------
   The requests hub ("คำขอ").

   A submit form on the left, and one card on the right holding three sibling
   tabs — My Requests / Pending Approval / Decision History. They are the same
   tickets seen from different angles, so they share one tab strip rather than
   stacking as three separate cards.
--------------------------------------------------------------------------- */

function StatusBadge({ status }) {
  const { t } = useI18n();
  const map = {
    approved: ['req.approved', 'bg-ok-bg text-ok-fg dark:bg-ok/20 dark:text-ok-dark'],
    rejected: ['req.rejected', 'bg-danger-bg text-danger-fg dark:bg-danger/20 dark:text-danger-dark'],
    pending: ['req.pending', 'bg-warn-bg text-warn-fg dark:bg-warn/20 dark:text-warn-dark'],
  };
  const [key, cls] = map[status] || map.pending;
  return (
    <span className={`inline-block rounded-pill px-2 py-0.5 text-xs font-semibold ${cls}`}>
      {t(key)}
    </span>
  );
}

/**
 * One ticket row. Rendered as a definition-style stack rather than a table so
 * it reflows on a narrow screen instead of scrolling sideways — these are read
 * on site tablets as often as on a desk.
 */
function Ticket({ row, siteName, showName, showActions, showCancel, showDecided, busy, onApprove, onReject, onCancel }) {
  const { t } = useI18n();
  const typeKey = LEAVE_TYPES.find((x) => x.code === row.leave_type)?.key;

  return (
    <div
      className={
        'grid gap-2 rounded-control border border-line p-3 md:grid-cols-[1fr_auto] ' +
        'dark:border-line-dark ' +
        (busy ? 'opacity-50' : '')
      }
    >
      <div className="min-w-0">
        {showName && (
          <div className="truncate font-semibold text-ink dark:text-ink-dark">
            {row.emp_name}
            <span className="ml-2 text-xs font-normal text-ink-muted dark:text-ink-dark-muted">
              {siteName}
            </span>
          </div>
        )}
        <div className="text-sm text-ink dark:text-ink-dark">
          {fmtRange(row.from_date, row.to_date)}
          <span className="ml-2 text-ink-muted dark:text-ink-dark-muted">
            {dayCount(row.from_date, row.to_date)} {t('set.daysUnit')}
          </span>
          <span className="ml-2 rounded bg-surface-sunken px-1.5 py-0.5 text-xs dark:bg-surface-dark-sunken">
            {typeKey ? t(typeKey) : t('req.unspecified')}
          </span>
        </div>
        {row.reason && (
          <div className="truncate text-xs text-ink-muted dark:text-ink-dark-muted" title={row.reason}>
            {row.reason}
          </div>
        )}
      </div>

      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
        <StatusBadge status={row.status} />
        {showDecided && row.decided_by && (
          <Hint>
            {shortBy(row.decided_by)}
            {row.decided_at ? ` · ${fmtDate(String(row.decided_at).slice(0, 10))}` : ''}
          </Hint>
        )}
        {showActions && row.status === 'pending' && (
          <>
            <Button variant="primary" disabled={busy} onClick={onApprove}>
              {t('req.approve')}
            </Button>
            <Button disabled={busy} onClick={onReject}>
              {t('req.reject')}
            </Button>
          </>
        )}
        {/* Cancel exists only while pending — once decided the row is a record,
            not a draft. */}
        {showCancel && row.status === 'pending' && (
          <Button variant="danger" disabled={busy} onClick={onCancel} title={t('req.cancel')}>
            ✕
          </Button>
        )}
      </div>
    </div>
  );
}

export default function Requests() {
  const { t } = useI18n();
  const { openSites, siteName, isAdmin, role } = useHrData();
  const canDecide = isAdmin || role === 'manager';

  /* --------------------------------- form -------------------------------- */
  const [site, setSite] = useState('');
  const [eid, setEid] = useState('');
  const [roster, setRoster] = useState([]);
  const [leaveType, setLeaveType] = useState('sick');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [reason, setReason] = useState('');
  const [flash, setFlash] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  /* --------------------------------- lists ------------------------------- */
  const [tab, setTab] = useState('mine');
  const [histFilter, setHistFilter] = useState('all');
  const [busyId, setBusyId] = useState('');
  const [mine, setMine] = useState({ rows: [], total: 0 });
  const [pending, setPending] = useState({ rows: [], total: 0 });
  const [decided, setDecided] = useState({ rows: [], total: 0 });
  const [listLoading, setListLoading] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => setReloadKey((n) => n + 1), []);

  useEffect(() => {
    if (!site) {
      setRoster([]);
      setEid('');
      return undefined;
    }
    const controller = new AbortController();
    getRoster(site, { signal: controller.signal })
      .then((list) => setRoster(Array.isArray(list) ? list : []))
      .catch((err) => {
        if (err?.name !== 'AbortError') setRoster([]);
      });
    setEid('');
    return () => controller.abort();
  }, [site]);

  // One endpoint serves all three tabs; the filters narrow, and the caller's
  // site scope is what decides what is visible at all.
  useEffect(() => {
    const controller = new AbortController();
    setListLoading(true);
    const jobs = [
      eid
        ? listLeave({ eid, limit: 200, signal: controller.signal })
        : Promise.resolve({ rows: [], total: 0 }),
      canDecide
        ? listLeave({ status: 'pending', limit: 200, signal: controller.signal })
        : Promise.resolve({ rows: [], total: 0 }),
      canDecide
        ? listLeave({ limit: 200, signal: controller.signal })
        : Promise.resolve({ rows: [], total: 0 }),
    ];
    Promise.all(jobs)
      .then(([m, p, all]) => {
        setMine(m);
        setPending(p);
        // "Decided" is everything that is no longer pending. The API has no
        // status=decided, and asking for approved and rejected separately would
        // be two round-trips for one list.
        setDecided({
          rows: (all.rows || []).filter((r) => r.status !== 'pending'),
          total: all.total ?? 0,
        });
      })
      .catch((err) => {
        if (err?.name !== 'AbortError') setFlash({ kind: 'error', text: errorMessage(err, t) });
      })
      .finally(() => {
        if (!controller.signal.aborted) setListLoading(false);
      });
    return () => controller.abort();
  }, [eid, canDecide, reloadKey, t]);

  const histRows = useMemo(
    () => (histFilter === 'all' ? decided.rows : decided.rows.filter((r) => r.status === histFilter)),
    [decided.rows, histFilter]
  );

  async function submit() {
    if (!eid) return setFlash({ kind: 'error', text: t('req.needEmployee') });
    if (!from || !to) return setFlash({ kind: 'error', text: t('req.needRange') });
    if (to < from) return setFlash({ kind: 'error', text: t('req.badRange') });
    setSubmitting(true);
    try {
      await requestLeave({
        eid,
        from_date: from,
        to_date: to,
        reason: reason.trim(),
        leave_type: leaveType,
      });
      setFlash({ kind: 'ok', text: t('req.submitted') });
      setFrom('');
      setTo('');
      setReason('');
      reload();
    } catch (err) {
      setFlash({ kind: 'error', text: errorMessage(err, t) });
    } finally {
      setSubmitting(false);
    }
    return undefined;
  }

  async function decide(id, approve) {
    setBusyId(id);
    try {
      await decideLeave(id, approve);
      setFlash({ kind: 'ok', text: approve ? t('req.approved') : t('req.rejected') });
      reload();
    } catch (err) {
      // 409 ALREADY_DECIDED means another manager got there first — the row is
      // not broken, it is simply no longer this person's to decide.
      setFlash({ kind: 'error', text: errorMessage(err, t) });
    } finally {
      setBusyId('');
    }
  }

  async function cancel(id) {
    setBusyId(id);
    try {
      await cancelLeave(id, eid);
      setFlash({ kind: 'ok', text: t('req.cancelled') });
      reload();
    } catch (err) {
      setFlash({ kind: 'error', text: errorMessage(err, t) });
    } finally {
      setBusyId('');
    }
  }

  const tabs = [
    { id: 'mine', label: t('req.mine'), count: mine.rows.length },
    ...(canDecide
      ? [
          { id: 'pending', label: t('req.pendingTab'), count: pending.rows.length },
          { id: 'history', label: t('req.history'), count: decided.rows.length },
        ]
      : []),
  ];

  return (
    <>
      <Card className="px-4 py-3">
        <h1 className="m-0 text-xl font-bold text-ink dark:text-ink-dark">{t('nav.requests')}</h1>
        <p className="m-0 text-sm text-ink-muted dark:text-ink-dark-muted">{t('req.sub')}</p>
      </Card>

      {flash && <Flash kind={flash.kind}>{flash.text}</Flash>}

      <div className="grid gap-4 lg:grid-cols-requests">
        {/* ------------------------------ form ------------------------------ */}
        <Card className="grid content-start gap-3">
          <h2 className="m-0 text-base font-bold text-ink dark:text-ink-dark">{t('req.new')}</h2>

          <Field label={t('entry.site')}>
            <Select value={site} onChange={(e) => setSite(e.target.value)}>
              <option value="">{t('req.selectSite')}</option>
              {/* A leave request is new work against a project, so closed ones
                  are not offered. They stay on the dashboard regardless. */}
              {openSites.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label={t('req.empName')}>
            <Select value={eid} disabled={!site} onChange={(e) => setEid(e.target.value)}>
              <option value="">{site ? t('req.selectName') : t('req.selectSiteFirst')}</option>
              {roster.map((r) => (
                <option key={r.eid} value={r.eid}>
                  {r.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label={t('req.leaveType')}>
            <Select value={leaveType} onChange={(e) => setLeaveType(e.target.value)}>
              {LEAVE_TYPES.map((x) => (
                <option key={x.code} value={x.code}>
                  {t(x.key)}
                </option>
              ))}
            </Select>
          </Field>

          <Field label={t('req.fromDate')}>
            <TextInput
              type="date"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                // Single-day leave is the common case, so End follows Start.
                if (!to || to < e.target.value) setTo(e.target.value);
              }}
            />
          </Field>

          <Field label={t('req.toDate')}>
            <TextInput type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>

          {/* Native date inputs render in the browser's locale, often
              mm/dd/yyyy, and HTML gives no way to override that — so this line
              is what confirms the dates actually picked. */}
          <Hint className="-mt-1 block min-h-[1em]">
            {from && to && to >= from
              ? `${fmtRange(from, to)} · ${dayCount(from, to)} ${t('set.daysUnit')}`
              : ''}
          </Hint>

          <Field label={t('req.reasonOptional')}>
            <TextInput
              value={reason}
              maxLength={300}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t('req.reasonPlaceholder')}
            />
          </Field>

          <Button variant="primary" disabled={submitting} onClick={submit}>
            {submitting ? t('req.submitting') : t('req.submit')}
          </Button>
        </Card>

        {/* ------------------------------ lists ----------------------------- */}
        <Card className="min-w-0">
          <div className="mb-3 flex flex-wrap gap-1 border-b border-line dark:border-line-dark">
            {tabs.map((x) => (
              <button
                key={x.id}
                type="button"
                onClick={() => setTab(x.id)}
                className={
                  'relative -mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors ' +
                  (tab === x.id
                    ? 'border-brand-700 text-brand-700 dark:border-brand-300 dark:text-brand-300'
                    : 'border-transparent text-ink-muted hover:text-ink dark:text-ink-dark-muted')
                }
              >
                {x.label}
                {x.count > 0 && (
                  <span className="rounded-pill bg-surface-sunken px-1.5 text-xs font-semibold dark:bg-surface-dark-sunken">
                    {x.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {listLoading ? (
            <Spinner />
          ) : tab === 'mine' ? (
            !eid ? (
              <p className="text-sm text-ink-muted dark:text-ink-dark-muted">
                {t('req.pickToSeeMine')}
              </p>
            ) : !mine.rows.length ? (
              <p className="text-sm text-ink-muted dark:text-ink-dark-muted">{t('req.noneMine')}</p>
            ) : (
              <div className="grid gap-2">
                {mine.rows.map((r) => (
                  <Ticket
                    key={r.id}
                    row={r}
                    siteName={siteName(r.site_key)}
                    showCancel
                    busy={busyId === r.id}
                    onCancel={() => cancel(r.id)}
                  />
                ))}
              </div>
            )
          ) : tab === 'pending' ? (
            <>
              <Hint className="mb-2 block">{t('req.yourSites')}</Hint>
              {!pending.rows.length ? (
                <p className="text-sm text-ink-muted dark:text-ink-dark-muted">
                  {t('req.nonePending')}
                </p>
              ) : (
                <div className="grid gap-2">
                  {pending.rows.map((r) => (
                    <Ticket
                      key={r.id}
                      row={r}
                      siteName={siteName(r.site_key)}
                      showName
                      showActions
                      busy={busyId === r.id}
                      onApprove={() => decide(r.id, true)}
                      onReject={() => decide(r.id, false)}
                    />
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <Segmented
                className="mb-3"
                value={histFilter}
                onChange={setHistFilter}
                options={[
                  ['all', t('req.all')],
                  ['approved', t('req.approved')],
                  ['rejected', t('req.rejected')],
                ]}
              />
              {!histRows.length ? (
                <p className="text-sm text-ink-muted dark:text-ink-dark-muted">
                  {t('req.noHistory')}
                </p>
              ) : (
                <>
                  {/* Say plainly when the server capped the list, so a partial
                      history never reads as the whole record. */}
                  {decided.total > decided.rows.length && (
                    <Hint className="mb-2 block">
                      <b>
                        {t('req.showing')} {decided.rows.length}/{decided.total}
                      </b>
                    </Hint>
                  )}
                  <div className="grid gap-2">
                    {histRows.map((r) => (
                      <Ticket
                        key={r.id}
                        row={r}
                        siteName={siteName(r.site_key)}
                        showName
                        showDecided
                        busy={false}
                      />
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </Card>
      </div>
    </>
  );
}
