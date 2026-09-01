import React from 'react';
import { useI18n } from '@vcb/shared';
import { useMinutesData } from '../MinutesData';
import * as minutesApi from '../lib/minutesApi';
import { errorMessage } from '../lib/errors';
import { isInboxProject } from '../lib/minutes';
import { Badge, Button, Dot, Modal } from '../ui';

/**
 * Generic English words that show up as tokens from nameEn ("Financial
 * Review", "Business Development") but are common enough in ANY business
 * transcript that matching them says little about which project a recording is
 * actually about. Weighted far below the strong signals, so "Financial" alone
 * cannot outscore a project whose id or Thai name is mentioned directly — that
 * is what once made an ERP/PO/PR meeting wrongly suggest FIN.
 */
const WEAK_WORDS = new Set([
  'all',
  'project',
  'review',
  'section',
  'sections',
  'business',
  'development',
  'monthly',
  'quarterly',
  'meeting',
  'overview',
  'financial',
  'highway',
]);

function stripHtml(html) {
  const d = document.createElement('div');
  d.innerHTML = html || '';
  return d.textContent || '';
}

/**
 * Score how well each project's own keywords appear in the recording, and
 * return the best if it clears the bar.
 *
 * A SUGGESTION ONLY, never auto-applied. Project content can be sensitive and
 * filing a recording into the wrong project exposes it to that project's
 * viewers, so an admin always chooses explicitly.
 */
function suggestProjectFor(meeting, candidates) {
  const text = `${meeting.title} ${stripHtml(meeting.html || '')}`.toLowerCase();
  let best = null;
  let bestScore = 0;

  for (const p of candidates) {
    let score = 0;

    // Strong: the project id itself, the short alias in parentheses in nameEn
    // ("Bang Toey Sections 1+2 (BT)" -> "BT", the shorthand Fathom titles
    // actually use), and either full name as a whole phrase.
    if (p.id && p.id.length >= 2 && text.includes(p.id.toLowerCase())) score += 5;
    const alias = (p.nameEn || '').match(/\(([^)]+)\)/);
    if (alias && alias[1].length >= 2 && text.includes(alias[1].toLowerCase())) score += 5;
    for (const full of [p.name, p.nameEn]) {
      const f = (full || '').trim().toLowerCase();
      if (f.length >= 4 && text.includes(f)) score += 5;
    }

    // Weak: individual words out of either name, one point each, and only the
    // ones that are not generic.
    const tokens = `${p.name || ''} ${p.nameEn || ''}`
      .split(/[\s()+.,·-]+/)
      .map((s) => s.trim().toLowerCase())
      .filter((s) => s.length >= 3 && !WEAK_WORDS.has(s));
    for (const tok of tokens) if (text.includes(tok)) score += 1;

    if (score > bestScore) {
      bestScore = score;
      best = p;
    }
  }

  // More than one weak word alone. A single generic match is not a suggestion.
  return bestScore >= 2 ? best : null;
}

/**
 * File an inbox recording into a project.
 *
 * This only ADDS a tag. The recording stays in its inbox permanently — an
 * inbox is a permanent archive, not a staging area, and nothing here moves a
 * row out of one.
 */
export default function TagPickerModal({ open, meeting, onClose, onTagged, onToast, onBusy }) {
  const { t } = useI18n();
  const { projects } = useMinutesData();

  if (!open || !meeting) return null;

  const already = new Set(meeting.taggedProjectIds || []);
  const candidates = projects.filter((p) => !isInboxProject(p.id) && !already.has(p.id));
  const suggestion = suggestProjectFor(meeting, candidates);

  const pick = async (target) => {
    onClose();
    onBusy(t('meeting.taggingInto', { name: target.name }));
    try {
      await minutesApi.tagMeeting(meeting.id, target.id);
      await onTagged(target.name);
    } catch (err) {
      onToast(errorMessage(err, t));
    } finally {
      onBusy(null);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={t('tag.title')}
      subtitle={t('tag.hint')}
      width="max-w-[420px]"
      actions={<Button onClick={onClose}>{t('common.cancel')}</Button>}
    >
      {candidates.length ? (
        <div className="flex flex-col gap-1">
          {candidates.map((p) => {
            const suggested = suggestion?.id === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => pick(p)}
                className={`flex items-center gap-2.5 rounded-[9px] px-2.5 py-[9px] text-left transition-colors ${
                  suggested
                    ? 'bg-warn-bg ring-[1.5px] ring-inset ring-[#e8c94a] hover:bg-[#fff4c8] dark:bg-[#2e2712] dark:ring-[#a4822c] dark:hover:bg-[#3a3018]'
                    : 'hover:bg-surface-sunken dark:hover:bg-surface-dark-sunken'
                }`}
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
                {suggested ? <Badge tone="suggest">{t('tag.suggested')}</Badge> : null}
              </button>
            );
          })}
        </div>
      ) : (
        <p className="py-4 text-center text-[13px] text-ink-muted dark:text-ink-dark-muted">
          {t('tag.noCandidates')}
        </p>
      )}
    </Modal>
  );
}
