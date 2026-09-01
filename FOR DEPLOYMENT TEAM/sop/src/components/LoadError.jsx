/**
 * The SOP could not be loaded. Distinct from NotSeeded: there the API answered
 * correctly and there is simply no content yet; here the request failed.
 *
 * The message comes from the API's error CODE through t(), never from
 * err.message — shared/src/api.js is explicit that `error` is a machine code,
 * not prose meant for a person.
 */

import { useI18n } from '@vcb/shared';

import { Icon } from '../lib/icons.jsx';
import { errorKey } from '../lib/sopApi.js';
import { useStore } from '../store.jsx';
import { Button, Notice } from './ui.jsx';

export default function LoadError() {
  const { t } = useI18n();
  const { error, refresh } = useStore();

  return (
    <div className="mx-auto max-w-lg px-4 py-12 text-center sm:px-6">
      <span className="inline-flex h-14 w-14 items-center justify-center rounded-pill bg-danger-bg text-danger dark:bg-danger/20 dark:text-danger-dark">
        <Icon name="alert" className="h-7 w-7" />
      </span>

      <h1 className="mt-4 text-lg font-bold break-thai">{t('error.title')}</h1>

      <Notice tone="danger" className="mt-4 text-left">
        {t(errorKey(error))}
      </Notice>

      <Button variant="primary" onClick={refresh} className="mt-5">
        <Icon name="refresh" className="h-4 w-4" />
        {t('common.retry')}
      </Button>
    </div>
  );
}
