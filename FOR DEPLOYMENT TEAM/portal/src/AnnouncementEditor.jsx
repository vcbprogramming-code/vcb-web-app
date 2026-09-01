import { useEffect, useState } from 'react';
import { useAuth, useI18n } from '@vcb/shared';
import { clearAnnouncement, getAnnouncement, saveAnnouncement } from './lib/portalApi';
import {
  Button,
  LABEL_CLASS,
  Message,
  Modal,
  ModalActions,
  ModalSub,
  ModalTitle,
  TextArea,
  TextField,
} from './ui';

// ---------------------------------------------------------------------------
// The admin password is gone. This is a role check plus a real token.
// ---------------------------------------------------------------------------
// The Apps Script version gated this editor on unlockAdmin(password), comparing
// against a hash in ScriptProperties, and cached a 30-minute token in
// localStorage. None of that survives a SPA: the hash and the comparison would
// both ship in the browser bundle, so anyone could read one and skip the other.
//
// api/src/routes/portal.js therefore guards every write with requireAuth +
// requireRole('portal','admin'), backed by the portal.portal_admins table. What
// is left on this side is hasRole('portal','admin'), which only decides whether
// to draw the form — the API decides whether a save is allowed, and it is the
// only opinion that counts. See the header of shared/src/auth.jsx.
// ---------------------------------------------------------------------------

const MAX_TITLE = 120; // matches announcementSchema in api/src/routes/portal.js
const MAX_BODY = 600;

export default function AnnouncementEditor({ open, onClose, onSaved }) {
  const { t } = useI18n();
  const { hasRole, signedIn } = useAuth();
  const isAdmin = hasRole('portal', 'admin');

  const [form, setForm] = useState({ title: '', body: '', show: true });
  const [msg, setMsg] = useState({ text: '', tone: '' });
  const [busy, setBusy] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  // Load the current record — including a hidden draft, which the API serves to
  // an admin and to nobody else.
  useEffect(() => {
    if (!open || !isAdmin) return undefined;
    const controller = new AbortController();
    setConfirmClear(false);
    setMsg({ text: t('admin.loading'), tone: '' });

    getAnnouncement({ signal: controller.signal })
      .then((ann) => {
        setForm({
          title: ann?.title ?? '',
          body: ann?.body ?? '',
          show: ann ? Boolean(ann.show) : true,
        });
        setMsg({ text: '', tone: '' });
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return;
        setMsg({ text: t(`error.${err.code}`), tone: 'err' });
      });

    return () => controller.abort();
  }, [open, isAdmin, t]);

  function submitSave() {
    if (!form.title.trim() && !form.body.trim()) {
      setMsg({ text: t('admin.needTitleOrBody'), tone: 'err' });
      return;
    }
    setBusy(true);
    setMsg({ text: t('common.saving'), tone: '' });

    saveAnnouncement({
      title: form.title.trim(),
      body: form.body.trim(),
      show: Boolean(form.show),
    })
      .then((saved) => {
        setMsg({ text: t('common.saved'), tone: 'ok' });
        onSaved(saved);
        window.setTimeout(onClose, 500);
      })
      .catch((err) => setMsg({ text: t(`error.${err.code}`), tone: 'err' }))
      .finally(() => setBusy(false));
  }

  function performClear() {
    setBusy(true);
    setMsg({ text: t('common.working'), tone: '' });

    clearAnnouncement()
      .then((cleared) => {
        setMsg({ text: t('admin.cleared'), tone: 'ok' });
        setForm({ title: '', body: '', show: false });
        setConfirmClear(false);
        // The API blanks the row rather than deleting it, so what comes back is
        // an announcement with show=false — which the portal treats as "no
        // banner". Pass it straight through.
        onSaved(cleared);
        window.setTimeout(onClose, 500);
      })
      .catch((err) => {
        setMsg({ text: t(`error.${err.code}`), tone: 'err' });
        setConfirmClear(false);
      })
      .finally(() => setBusy(false));
  }

  return (
    <Modal open={open} onClose={onClose} labelledBy="admin-title">
      <ModalTitle id="admin-title">{t('admin.title')}</ModalTitle>

      {!isAdmin ? (
        <>
          <ModalSub>{signedIn ? t('admin.notAdmin') : t('admin.signInFirst')}</ModalSub>
          <ModalActions>
            <Button onClick={onClose}>{t('common.close')}</Button>
          </ModalActions>
        </>
      ) : (
        <>
          <ModalSub>{t('admin.sub')}</ModalSub>

          <div className="mt-5 space-y-4">
            <TextField
              id="f-title"
              label={t('admin.fieldTitle')}
              maxLength={MAX_TITLE}
              placeholder={t('admin.fieldTitlePlaceholder')}
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />

            <TextArea
              id="f-body"
              label={t('admin.fieldBody')}
              maxLength={MAX_BODY}
              rows={5}
              placeholder={t('admin.fieldBodyPlaceholder')}
              value={form.body}
              onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
            />

            <label className="flex items-center gap-2.5 text-sm text-ink dark:text-ink-dark">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-line accent-accent dark:border-line-dark dark:accent-accent-dark"
                checked={form.show}
                onChange={(e) => setForm((f) => ({ ...f, show: e.target.checked }))}
              />
              {t('admin.showBanner')}
            </label>
          </div>

          <Message text={msg.text} tone={msg.tone} />

          {!confirmClear ? (
            <ModalActions>
              <Button variant="ghostDanger" onClick={() => setConfirmClear(true)}>
                {t('admin.clear')}
              </Button>
              <Button onClick={onClose}>{t('common.close')}</Button>
              <Button variant="primary" onClick={submitSave} disabled={busy}>
                {t('common.save')}
              </Button>
            </ModalActions>
          ) : (
            <div className="mt-6 rounded-control border border-danger/30 bg-danger-bg p-4 dark:border-danger-dark/30 dark:bg-danger/10">
              <p className="text-sm font-semibold text-danger dark:text-danger-dark">
                {t('admin.confirmClear')}
              </p>
              <p className="mt-1 text-sm text-ink-muted dark:text-ink-dark-muted">
                {t('admin.confirmClearNote')}
              </p>
              <div className="mt-4 flex justify-end gap-2">
                <Button onClick={() => setConfirmClear(false)}>{t('common.cancel')}</Button>
                <Button variant="danger" onClick={performClear} disabled={busy}>
                  {t('admin.confirmClearYes')}
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
