/**
 * Copies a deep link to the current case or flow.
 *
 * The link is now just the route (origin + /cases/12), because routing is real
 * — the canonical app had to synthesise `?case=12` against a server-injected
 * app URL. Old `?case=` links still resolve; see LegacyQueryRedirect in App.jsx.
 */

import { useEffect, useRef, useState } from 'react';
import { useI18n } from '@vcb/shared';

import { Icon } from '../lib/icons.jsx';
import { copyText } from '../lib/copy.js';
import { Button } from './ui.jsx';

export default function ShareButton({ path }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const timer = useRef(null);

  // A pending timer must not fire into an unmounted component — navigating
  // away right after copying is the normal case, not an edge one.
  useEffect(() => () => clearTimeout(timer.current), []);

  function onClick() {
    const url = window.location.origin + path;
    copyText(url).then((ok) => {
      if (!ok) return;
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <Button onClick={onClick} aria-live="polite">
      <Icon name={copied ? 'check' : 'link'} className="h-4 w-4" />
      <span className="hidden sm:inline">{copied ? t('detail.shareCopied') : t('detail.share')}</span>
    </Button>
  );
}
