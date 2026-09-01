import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useI18n } from '@vcb/shared';
import { useHrData, siteColor } from './HrData';
import MonthNav from './MonthNav';
import CoverageGrid from './CoverageGrid';
import WeekGrid from './WeekGrid';
import Picker from './Picker';
import { Card, Empty, Field, Flash, Segmented, Select, Spinner } from './ui';
import { getMonth, saveCells, slotOf } from './lib/hrApi';
import { errorMessage, isEditWindowError } from './lib/errors';
import { daysInMonth, todayIso } from './lib/dates';

/**
 * The work-log entry screen.
 *
 * Two views over the same month: `coverage` (the whole month, read-only, for
 * spotting gaps) and `week` (seven days, where cells are actually edited).
 *
 * Saving is per cell and immediate — there is no Save button, matching the
 * sheet the live app replaced, where a cell committed the moment it was typed.
 * Each write is a one-cell batch to POST /api/hr/cells; batching several would
 * mean either an explicit save step or losing edits on a closed tab.
 */
export default function Entry() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { siteKey } = useParams();
  const { openSites, sites, lockDays, activityByCode, costByCode, activities, costs } = useHrData();

  const today = useMemo(todayIso, []);
  const [cur, setCur] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
  });
  const [mode, setMode] = useState('coverage');
  const [weekStart, setWeekStart] = useState(0);
  const [focus, setFocus] = useState(null);
  const [picker, setPicker] = useState(null);

  const [month, setMonth] = useState(null);
  const [entries, setEntries] = useState({});
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [flash, setFlash] = useState(null);
  const flashTimer = useRef(undefined);

  const site = siteKey || '';

  const showFlash = useCallback((kind, text, sticky = false) => {
    clearTimeout(flashTimer.current);
    setFlash({ kind, text });
    // An edit-window refusal stays until dismissed by the next action: it is a
    // rule the person has to understand, not a "saved ✓" they can ignore.
    if (!sticky) flashTimer.current = setTimeout(() => setFlash(null), 1800);
  }, []);

  useEffect(() => () => clearTimeout(flashTimer.current), []);

  /* ------------------------------- load month ------------------------------ */

  useEffect(() => {
    if (!site) {
      setMonth(null);
      setEntries({});
      return undefined;
    }
    const controller = new AbortController();
    setLoading(true);
    getMonth({ site, year: cur.year, month: cur.month, signal: controller.signal })
      .then((res) => {
        setMonth(res);
        setEntries(res.entries || {});
        setLoadError(null);
        setWeekStart(0);
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return;
        setLoadError(err);
        setMonth(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [site, cur.year, cur.month]);

  // Calendar days are computed locally: the API returns entries keyed by date,
  // not a day list, and the month's shape is arithmetic, not data.
  const days = useMemo(() => daysInMonth(cur.year, cur.month), [cur.year, cur.month]);
  const employees = month?.employees ?? [];
  const effectiveLockDays = Number(month?.lockDays ?? lockDays);
  const accent = siteColor(site);

  /* --------------------------------- saving -------------------------------- */

  /**
   * Write one cell and reconcile local state with what the server accepted.
   *
   * An EMPTY value deletes the slot rather than storing '' — the API does the
   * delete, and it matters: a stored blank row is still a row, and hr.mandays
   * would count it as a day worked. So the optimistic update deletes the field
   * too, keeping the screen honest about what is now in the database.
   */
  const applyCell = useCallback(
    async (eid, date, field, value) => {
      const before = entries;
      const trimmed = String(value || '').trim();

      // Optimistic: the grid is dense enough that a round-trip per click reads
      // as lag. A failure below restores the previous state exactly.
      setEntries((prev) => {
        const next = { ...prev };
        const row = { ...(next[eid] || {}) };
        const cell = { ...(row[date] || {}) };
        if (trimmed) cell[field] = trimmed;
        else delete cell[field];
        // A cell that has lost its last slot but still carries a note keeps the
        // note: the note belongs to the DAY, not to a slot.
        if (Object.keys(cell).length) row[date] = cell;
        else delete row[date];
        next[eid] = row;
        return next;
      });

      try {
        await saveCells({
          site,
          cells: [{ eid, date, slot: slotOf(field), value: trimmed || null }],
        });
        showFlash('ok', trimmed ? `${t('entry.saved')} ✓` : t('entry.cleared'));
      } catch (err) {
        setEntries(before);
        // These two are different in kind, and it matters which the reader
        // thinks they are seeing:
        //
        //   OUTSIDE_EDIT_WINDOW  the enforce_entry_window trigger refused a day
        //                        outside the editable range. Nothing is broken —
        //                        errorMessage() names the window so the person
        //                        can see why, rather than filing a bug against a
        //                        rule working exactly as designed. Shown in the
        //                        warning tone.
        //   anything else        an actual failure. Shown in the error tone.
        //
        // Both stay on screen until the next action: a rule the person has to
        // understand is not something to fade out after 1.8s.
        showFlash(
          isEditWindowError(err) ? 'warn' : 'error',
          errorMessage(err, t, { lockDays: effectiveLockDays }),
          true
        );
      }
    },
    [entries, site, showFlash, t, effectiveLockDays]
  );

  /* --------------------------------- picker -------------------------------- */

  const openPicker = useCallback((eid, date, field, anchor) => {
    setPicker({ eid, date, field, anchor });
  }, []);

  const jump = useCallback(
    (eid, date) => {
      const idx = days.findIndex((d) => d.date === date);
      if (idx < 0) return;
      setWeekStart(Math.floor(idx / 7) * 7);
      setFocus({ eid, date });
      setMode('week');
    },
    [days]
  );

  const visibleDays = useMemo(() => {
    if (mode !== 'week') return days;
    const start = Math.min(Math.max(0, weekStart), Math.max(0, days.length - 1));
    return days.slice(start, start + 7);
  }, [days, mode, weekStart]);

  /* ---------------------------------- view --------------------------------- */

  return (
    <>
      <Card className="flex flex-wrap items-end gap-3 px-4 py-3">
        <Field label={t('entry.site')} className="min-w-[16rem] flex-1">
          <Select
            value={site}
            onChange={(e) =>
              navigate(e.target.value ? `/entry/${encodeURIComponent(e.target.value)}` : '/entry')
            }
          >
            <option value="">{t('req.selectSite')}</option>
            {/* Closed projects accept no NEW work, so they are not offered
                here. They stay on the dashboard with their history intact. */}
            {openSites.map((s) => (
              <option key={s.key} value={s.key}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label={t('entry.month')}>
          <MonthNav value={cur} onChange={setCur} />
        </Field>

        <Field label={t('entry.view')}>
          <Segmented
            value={mode}
            onChange={setMode}
            options={[
              ['coverage', t('entry.overview')],
              ['week', t('entry.weekly')],
            ]}
          />
        </Field>
      </Card>

      {flash && <Flash kind={flash.kind}>{flash.text}</Flash>}

      {!site ? (
        <Empty icon="📋" title={t('entry.chooseSite')} />
      ) : loading ? (
        <Spinner />
      ) : loadError ? (
        <Empty icon="⚠️" title={t('err.loadFailed')}>
          {errorMessage(loadError, t)}
        </Empty>
      ) : !employees.length ? (
        <Empty icon="👷" title={t('entry.noEmployees')} />
      ) : (
        <Card style={{ borderTopColor: accent, borderTopWidth: 3 }}>
          {mode === 'week' && (
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={weekStart <= 0}
                onClick={() => setWeekStart((s) => Math.max(0, s - 7))}
                className="rounded-control border border-line px-3 py-1.5 text-sm text-ink disabled:opacity-40 dark:border-line-dark dark:text-ink-dark"
              >
                ‹ {t('entry.prevWeek')}
              </button>
              <span className="text-sm text-ink-muted dark:text-ink-dark-muted">
                {visibleDays.length > 0 &&
                  `${Number(visibleDays[0].date.slice(8, 10))}–${Number(
                    visibleDays[visibleDays.length - 1].date.slice(8, 10)
                  )}`}
              </span>
              <button
                type="button"
                disabled={weekStart + 7 >= days.length}
                onClick={() => setWeekStart((s) => s + 7)}
                className="rounded-control border border-line px-3 py-1.5 text-sm text-ink disabled:opacity-40 dark:border-line-dark dark:text-ink-dark"
              >
                {t('entry.nextWeek')} ›
              </button>
            </div>
          )}

          {mode === 'coverage' ? (
            <CoverageGrid
              days={days}
              employees={employees}
              entries={entries}
              today={today}
              lockDays={effectiveLockDays}
              onJump={jump}
              activityByCode={activityByCode}
              costByCode={costByCode}
            />
          ) : (
            <WeekGrid
              days={visibleDays}
              employees={employees}
              entries={entries}
              today={today}
              lockDays={effectiveLockDays}
              focus={focus}
              onOpenPicker={openPicker}
              activityByCode={activityByCode}
              costByCode={costByCode}
            />
          )}
        </Card>
      )}

      {picker && (
        <Picker
          anchor={picker.anchor}
          activities={activities}
          costs={costs}
          onApply={(value) => {
            applyCell(picker.eid, picker.date, picker.field, value);
            setPicker(null);
          }}
          onClose={() => setPicker(null)}
        />
      )}
    </>
  );
}
