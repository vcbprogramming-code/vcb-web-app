import React from 'react';
import { useAuth, useI18n } from '@vcb/shared';
import { useMinutesData } from '../MinutesData';
import { ALL_PROJECTS, isInboxProject } from '../lib/minutes';
import { Button, Dot } from '../ui';

/**
 * The project rail.
 *
 * A LOCKED project is simply absent from what the API returned for this caller,
 * so this component never filters for access and must not start: the sidebar
 * renders exactly the rows it was given. Adding a client-side check here would
 * imply the list might contain something it should hide, which is the mistake
 * the three-tier model exists to prevent.
 *
 * "All meetings" aggregates the TRACKED projects only. Neither inbox folds into
 * it — they are review queues with their own tile and their own count.
 */
export default function Sidebar({
  active,
  onPick,
  onNewMeeting,
  onNewProject,
  onRenameProject,
  onTimeline,
}) {
  const { t } = useI18n();
  const { hasRole } = useAuth();
  const { projects } = useMinutesData();

  const isAdmin = hasRole('minutes', 'admin');
  const canEdit = hasRole('minutes', 'admin', 'editor');

  const trackedTotal = projects.reduce(
    (sum, p) => (isInboxProject(p.id) ? sum : sum + (p.count || 0)),
    0
  );

  const rows = [
    {
      id: ALL_PROJECTS,
      name: t('nav.allMeetings'),
      nameEn: t('nav.allMeetingsSub'),
      color: '#0b3d62',
      count: trackedTotal,
    },
    ...projects,
  ];

  // Rename is offered for real, admin-editable projects only — not the ALL
  // aggregate and not either inbox, whose name and id are fixed by design.
  const canRename = (id) => isAdmin && id !== ALL_PROJECTS && !isInboxProject(id);

  return (
    <aside className="flex min-h-0 flex-col overflow-y-auto border-r border-line bg-surface-card p-3 dark:border-line-dark dark:bg-surface-dark-card">
      <Button onClick={onTimeline} className="mb-3 w-full justify-center">
        📅 {t('nav.timeline')}
      </Button>

      <div className="mx-2 mb-2 mt-1.5 text-[11px] font-semibold uppercase tracking-[.08em] text-ink-muted dark:text-ink-dark-muted">
        {t('nav.projects')}
      </div>

      <nav className="flex flex-col gap-0.5">
        {rows.map((p) => {
          const isActive = active === p.id;
          return (
            <div
              key={p.id}
              className={`group flex cursor-pointer items-center gap-2.5 rounded-[9px] px-2.5 py-[9px] transition-colors ${
                isActive
                  ? 'bg-brand-100 dark:bg-brand-600/20'
                  : 'hover:bg-surface-sunken dark:hover:bg-surface-dark-sunken'
              }`}
            >
              <button
                type="button"
                onClick={() => onPick(p.id)}
                aria-current={isActive ? 'page' : undefined}
                className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
              >
                <Dot color={p.color} />
                <span className="min-w-0 flex-1">
                  <b className="block truncate text-[13.5px] font-semibold text-ink dark:text-ink-dark">
                    {p.name}
                  </b>
                  <small className="block truncate text-[11px] text-ink-muted dark:text-ink-dark-muted">
                    {p.nameEn || ''}
                  </small>
                </span>
              </button>

              {canRename(p.id) ? (
                <button
                  type="button"
                  title={t('nav.renameProject')}
                  aria-label={t('nav.renameProject')}
                  onClick={() => onRenameProject(p.id)}
                  className="shrink-0 rounded-md px-1.5 py-[5px] text-xs leading-none text-ink-muted opacity-0 transition-opacity hover:bg-surface-sunken hover:text-ink focus-visible:opacity-100 group-hover:opacity-100 dark:text-ink-dark-muted dark:hover:bg-surface-dark-sunken dark:hover:text-ink-dark"
                >
                  ✎
                </button>
              ) : null}

              <span className="shrink-0 rounded-pill bg-surface-sunken px-2 py-px text-[11.5px] text-ink-muted dark:bg-surface-dark-sunken dark:text-ink-dark-muted">
                {p.count ?? 0}
              </span>
            </div>
          );
        })}
      </nav>

      {/* Both buttons are HINTS, not gates — the API refuses either action from
          someone without the role regardless of what is rendered here. */}
      {canEdit ? (
        <Button variant="primary" onClick={onNewMeeting} className="mt-3 w-full justify-center">
          {t('nav.newMeeting')}
        </Button>
      ) : null}
      {isAdmin ? (
        <Button onClick={onNewProject} className="mt-2 w-full justify-center">
          {t('nav.newProject')}
        </Button>
      ) : null}
    </aside>
  );
}
