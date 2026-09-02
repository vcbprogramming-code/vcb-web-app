import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '@vcb/shared';
import { useHrData, siteColor } from './HrData';
import { usePrefs, useMonthName } from './prefs';
import MonthNav from './MonthNav';
import { Card, Empty, Segmented, Spinner, Hint, Button } from './ui';
import { getSummary, exportMandayReport } from './lib/hrApi';
import { errorMessage } from './lib/errors';
import { dayNum, isoMinus, isoPlus, todayIso } from './lib/dates';

/* ------------------------------- mini calendar ---------------------------- */

/**
 * One tile per day of the month, coloured by state.
 *
 * `filled` is the count of PEOPLE with a manday on that date — it comes from
 * the hr.mandays view, so someone who logged both งานหลัก and งานเสริม counts
 * once, not twice. The denominator is the site's headcount.
 */
function MiniCal({ days, headcount, today, lockDays, accent }) {
  const cutoff = isoMinus(today, lockDays);
  const ahead = isoPlus(today, 1);
  const byDate = useMemo(
    () => new Map(days.map((d) => [d.date, d.filled])),
    [days]
  );

  // The API returns only days that HAVE entries, so the strip is built from the
  // calendar and looked up — otherwise an empty month would render nothing at
  // all, which reads as "no data" rather than "nobody has logged anything".
  const all = useMemo(() => {
    if (!days.length) return [];
    const first = days[0].date;
    const [y, m] = first.split('-').map(Number);
    const last = new Date(y, m, 0).getDate();
    const out = [];
    for (let d = 1; d <= last; d++) {
      const date = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dow = new Date(y, m - 1, d).getDay();
      out.push({ date, dow, weekend: dow === 0, filled: byDate.get(date) ?? 0 });
    }
    return out;
  }, [days, byDate]);

  return (
    <div className="no-scrollbar -mx-1 flex gap-0.5 overflow-x-auto px-1 py-1">
      {all.map((day) => {
        const complete = headcount > 0 && day.filled >= headcount;
        let cls = 'bg-cov-miss text-white';
        if (day.date === today) cls = 'text-white';
        else if (day.weekend) cls = 'bg-cov-rest text-cov-rest-ink';
        else if (day.date > ahead) cls = 'bg-cov-future text-cov-future-ink';
        else if (day.date >= cutoff) cls = 'bg-cov-edit text-cov-edit-ink';
        else if (complete) cls = 'bg-cov-ok text-white';

        return (
          <div
            key={day.date}
            title={`${day.date} · ${day.filled}/${headcount}`}
            style={day.date === today ? { background: accent } : undefined}
            className={`grid h-6 w-6 shrink-0 place-items-center rounded text-[0.6rem] font-semibold ${cls}`}
          >
            {dayNum(day.date)}
          </div>
        );
      })}
    </div>
  );
}

/* --------------------------------- top list ------------------------------- */

/**
 * The activity / cost-code mix, as a hand-written bar list.
 *
 * TECH_STACK.md rules out chart libraries, and a bar list is a div with a
 * width anyway. The percentage is share-of-entries within this list, computed
 * from the counts the API returned.
 *
 * These counts are PER ENTRY, not per manday, deliberately: a day on which
 * someone did two different activities genuinely used both, and this list is
 * activity mix. Workload is the `mandays` figure, and only that.
 */
function TopList({ items, accent }) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const LIMIT = 5;

  if (!items.length) {
    return (
      <p className="py-8 text-center text-sm text-ink-muted dark:text-ink-dark-muted">
        {t('dash.noEntriesThisMonth')}
      </p>
    );
  }

  const total = items.reduce((a, b) => a + b.count, 0) || 1;
  const shown = expanded ? items : items.slice(0, LIMIT);

  return (
    <div className="grid gap-2">
      {shown.map((item) => {
        const pct = Math.round((item.count / total) * 100);
        return (
          <div key={item.name} title={`${item.name} — ${item.count}`}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate text-sm text-ink dark:text-ink-dark">{item.name}</span>
              <span className="shrink-0 text-xs text-ink-muted dark:text-ink-dark-muted">
                <b className="text-ink dark:text-ink-dark">{item.count}</b> · {pct}%
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-pill bg-surface-sunken dark:bg-surface-dark-sunken">
              <i
                className="bar-fill block h-full rounded-pill"
                style={{ '--w': `${Math.max(2, Math.min(100, pct))}%`, background: accent }}
              />
            </div>
          </div>
        );
      })}
      {items.length > LIMIT && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="mt-1 text-xs font-semibold text-brand-700 hover:underline dark:text-brand-300"
        >
          {expanded ? `${t('dash.collapse')} ▴` : `${t('dash.showAll')} (${items.length}) ▾`}
        </button>
      )}
    </div>
  );
}

/* ----------------------------------- ring --------------------------------- */

const RING_R = 27;
const RING_LEN = 2 * Math.PI * RING_R; // 169.65

/** A progress ring, hand-drawn as two SVG circles. No chart library. */
function Ring({ pct, color }) {
  const clamped = Math.max(0, Math.min(100, pct));
  const end = RING_LEN - (clamped / 100) * RING_LEN;
  return (
    <div className="relative grid h-16 w-16 place-items-center">
      <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true">
        <circle
          cx="32"
          cy="32"
          r={RING_R}
          fill="none"
          strokeWidth="7"
          className="stroke-line dark:stroke-line-dark"
        />
        <circle
          cx="32"
          cy="32"
          r={RING_R}
          fill="none"
          stroke={color}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={RING_LEN}
          strokeDashoffset={end}
          transform="rotate(-90 32 32)"
          className="ring-fill"
          style={{ '--ring-len': RING_LEN, '--ring-end': end }}
        />
      </svg>
      <span className="absolute text-sm font-bold" style={{ color }}>
        {clamped}%
      </span>
    </div>
  );
}

/* --------------------------------- site card ------------------------------ */

function SiteCard({ row, today, lockDays, view, monthLabel, onOpen, canEntry }) {
  const { t, formatNumber } = useI18n();
  const accent = siteColor(row.site_key);
  const isTop = view === 'topact' || view === 'topcost';
  const items = view === 'topcost' ? row.topCostCodes : row.topActivities;

  /* Coverage = mandays logged, out of the mandays that COULD have been logged
     on the working days already past. Both halves come from the API's manday
     counts, never from an entry-row count: a day with งานหลัก and งานเสริม both
     filled is one manday, and counting rows would inflate exactly the sites
     that log extra work. */
  const { pct, logged, possible } = useMemo(() => {
    const past = row.daysFilled.filter((d) => d.date <= today);
    const loggedDays = past.reduce((a, d) => a + d.filled, 0);
    // Only weekdays that have already happened can be complete. The API sends
    // one row per date that has any entry, so days nobody logged are absent —
    // the denominator has to come from the calendar, not from that list.
    const [y, m] = (row.daysFilled[0]?.date || today).split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    let workdays = 0;
    for (let d = 1; d <= lastDay; d++) {
      const date = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      if (date > today) break;
      if (new Date(y, m - 1, d).getDay() !== 0) workdays++;
    }
    const denom = workdays * row.n_emp;
    return {
      logged: loggedDays,
      possible: denom,
      pct: denom ? Math.round((loggedDays / denom) * 100) : 0,
    };
  }, [row, today]);

  return (
    <Card className="flex flex-col gap-3 overflow-hidden p-0">
      <div className="h-1 w-full shrink-0" style={{ background: accent }} />
      <div className="flex flex-col gap-3 p-4 pt-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="m-0 truncate text-base font-bold" style={{ color: accent }}>
              {row.site_name}
            </h2>
            <Hint>{row.company}</Hint>
            {row.active === false && (
              <span className="ml-1 rounded-pill bg-surface-sunken px-1.5 py-0.5 text-[0.65rem] font-semibold text-ink-muted dark:bg-surface-dark-sunken dark:text-ink-dark-muted">
                {t('set.closeProject')}
              </span>
            )}
          </div>
          {isTop ? (
            <div className="shrink-0 text-right">
              <b className="text-xl" style={{ color: accent }}>
                {formatNumber(row.mandays)}
              </b>
              <div>
                <Hint>{t('dash.mandays')}</Hint>
              </div>
            </div>
          ) : (
            <div className="flex shrink-0 items-center gap-2">
              <Ring pct={pct} color={accent} />
              <div className="text-xs leading-tight text-ink-muted dark:text-ink-dark-muted">
                {t('dash.complete')}
                <br />
                <b className="text-ink dark:text-ink-dark">
                  {formatNumber(logged)} / {formatNumber(possible)}
                </b>
                <br />
                {t('dash.mandays')}
              </div>
            </div>
          )}
        </div>

        {isTop ? (
          <TopList items={items} accent={accent} />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 border-y border-line py-2 dark:border-line-dark">
              <div>
                <b className="text-lg text-ink dark:text-ink-dark">{row.n_emp}</b>{' '}
                <span className="text-xs text-ink-muted dark:text-ink-dark-muted">
                  {t('entry.employees')}
                </span>
                <div>
                  <Hint>
                    {row.n_support} {t('entry.support')} · {row.n_operation} {t('entry.operation')}
                  </Hint>
                </div>
              </div>
              <div>
                <b className="text-lg text-ink dark:text-ink-dark">{formatNumber(row.mandays)}</b>{' '}
                <span className="text-xs text-ink-muted dark:text-ink-dark-muted">
                  {t('dash.mandays')} · {monthLabel}
                </span>
                <div>
                  {/* Spelling out the rule where the number is read is the
                      cheapest place to stop someone "fixing" it upward. */}
                  <Hint>{t('dash.mandayRule')}</Hint>
                </div>
              </div>
            </div>
            <MiniCal
              days={row.daysFilled}
              headcount={row.n_emp}
              today={today}
              lockDays={lockDays}
              accent={accent}
            />
          </>
        )}

        {canEntry && row.active !== false && (
          <Button
            variant="primary"
            className="w-full border-transparent"
            style={{ background: accent }}
            onClick={() => onOpen(row.site_key)}
          >
            {t('dash.openLog')}
          </Button>
        )}
      </div>
    </Card>
  );
}

/* -------------------------------- dashboard ------------------------------- */

export default function Dashboard() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const monthName = useMonthName();
  const { lockDays, canEntry } = useHrData();
  const { dashView, hidden } = usePrefs();

  const today = useMemo(todayIso, []);
  const [cur, setCur] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
  });
  const [view, setView] = useState(dashView);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  /* The green download button the Apps Script dashboard has (#dExport), which
     was ported as a translation string but never as a control.

     It exports the month the dashboard is CURRENTLY SHOWING, not the current
     calendar month. The two diverge the moment anyone uses the month arrows,
     and handing someone a different month from the one on their screen is the
     kind of bug that never gets reported because they assume they misclicked. */
  const onExport = async () => {
    setExporting(true);
    try {
      await exportMandayReport({ year: cur.year, month: cur.month });
    } catch {
      // The API surfaces its own failures; a dead download needs no alert here.
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    getSummary({ year: cur.year, month: cur.month, signal: controller.signal })
      .then((res) => {
        setData(res);
        setError(null);
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return;
        setError(err);
        setData(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [cur.year, cur.month]);

  // `hidden` is a per-device decluttering preference, applied here at the last
  // moment: the API decides what this person MAY see, and this only decides
  // what they want to look at right now.
  const rows = (data?.rows ?? []).filter((r) => !hidden.includes(r.site_key));
  const monthLabel = `${monthName(cur.month)}`;

  return (
    <>
      <Card className="flex flex-wrap items-center gap-4 px-4 py-3">
        <div className="min-w-0">
          <h1 className="m-0 text-xl font-bold text-ink dark:text-ink-dark">
            {t('nav.dashboard')}
          </h1>
          <p className="m-0 text-sm text-ink-muted dark:text-ink-dark-muted">{t('dash.sub')}</p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-3">
          <Segmented
            value={view}
            onChange={setView}
            options={[
              ['progress', t('dash.progress')],
              ['topact', t('dash.topAct')],
              ['topcost', t('dash.topCost')],
            ]}
          />
          <MonthNav value={cur} onChange={setCur} />
          <Button
            variant="primary"
            onClick={onExport}
            disabled={exporting || loading}
            title={t('dash.mandayReportHint')}
            className="border-transparent bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500"
          >
            {exporting ? t('dash.exporting') : '\u2193 ' + t('dash.mandayReport')}
          </Button>
        </div>
      </Card>

      {loading ? (
        <Spinner />
      ) : error ? (
        <Empty icon="⚠️" title={t('err.loadFailed')}>
          {errorMessage(error, t)}
        </Empty>
      ) : rows.length === 0 ? (
        <Empty icon="🗓️" title={t('dash.allHidden')}>
          {t('dash.allHiddenHelp')}
        </Empty>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((row) => (
            <SiteCard
              key={row.site_key}
              row={row}
              today={today}
              lockDays={lockDays}
              view={view}
              monthLabel={monthLabel}
              canEntry={canEntry}
              onOpen={(key) => navigate(`/entry/${encodeURIComponent(key)}`)}
            />
          ))}
        </div>
      )}
    </>
  );
}
