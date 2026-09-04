import { useCallback, useRef, useState } from 'react';
import { useI18n } from '@vcb/shared';

// Ported from showRewardToast/showToast in the original app's progress.html:
// a brief, randomized "Nice work!" style message on every task checked off —
// small, frequent positive feedback distinct from the two bigger milestone
// pop-ups (phase complete, 90-days complete). Fixed-position so it never
// participates in document flow/layout height, matching the fixed-toast
// pattern used for the same reason elsewhere in this project (HR Work Log's
// Flash).
const REWARD_KEYS = [
  'content.niceWork',
  'content.greatJob',
  'content.keepItUp',
  'content.wellDone',
  'content.youReOnTrack',
];

// 2200ms, matching the original's reward toast — shorter than the
// save-failed/locked toasts (3200ms), which carry more to read.
const REWARD_DURATION = 2200;

export function useRewardToast() {
  const { t } = useI18n();
  const [message, setMessage] = useState(null);
  const timerRef = useRef(null);

  const showReward = useCallback(() => {
    const key = REWARD_KEYS[Math.floor(Math.random() * REWARD_KEYS.length)];
    setMessage(t(key));
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setMessage(null), REWARD_DURATION);
  }, [t]);

  const node = message ? (
    <div
      role="status"
      className="fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-control border border-emerald-500/40 bg-emerald-500/95 px-4 py-2.5 text-sm font-semibold text-white shadow-card-hover"
    >
      🎉 {message}
    </div>
  ) : null;

  return { showReward, node };
}
