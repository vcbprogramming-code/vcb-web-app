// Translating the department content in src/data/.
//
// That content — five departments, three phases each, plus the org chart and
// the home page — is a large body of English strings held as DATA. The old
// t() took the English sentence itself as the lookup key. The shared i18n
// wants stable dot keys, and rewriting several thousand lines of content into
// key references would touch every data file for no behavioural gain.
//
// So this bridges the two: CONTENT_KEY_BY_EN (generated in i18n.js from the
// original translations.ts) maps an English source string to its dot key, and
// tContent() resolves it. A string with no entry falls through to itself,
// which is exactly what the old t() did for untranslated text — English is
// shown rather than a key, because unlike UI chrome this content is legible
// as-is.
//
// NEW UI copy should use a dot key directly through t(). This shim exists for
// the migrated content body, not as the general way to translate.

import { useCallback } from 'react';
import { useI18n } from '@vcb/shared';
import { CONTENT_KEY_BY_EN } from '../i18n.js';

/**
 * Resolve one English content string in the current language.
 * @param {(key: string) => string} t
 * @param {string} text
 */
export function translateContent(t, text) {
  if (text == null) return '';
  const key = CONTENT_KEY_BY_EN[text];
  // No key: the string was never translated. Render it as written.
  if (!key) return text;
  const translated = t(key);
  // translate() returns the key itself when an entry is missing; showing
  // 'content.someKey' to an employee would be worse than showing the English.
  return translated === key ? text : translated;
}

/**
 * Hook form: `const tc = useContentText()` then `tc(item.text)`.
 *
 * Returns a stable callback so it can sit in dependency arrays without
 * re-running effects on every render.
 */
export function useContentText() {
  const { t } = useI18n();
  return useCallback((text) => translateContent(t, text), [t]);
}
