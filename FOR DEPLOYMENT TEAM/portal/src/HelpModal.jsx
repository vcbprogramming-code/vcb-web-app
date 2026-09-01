import { useEffect, useState } from 'react';
import { useI18n } from '@vcb/shared';
import { appName } from './lib/appCopy';
import {
  Button,
  Message,
  Modal,
  ModalActions,
  ModalSub,
  ModalTitle,
  SelectField,
  TextArea,
} from './ui';

// ---------------------------------------------------------------------------
// This form has no endpoint. It composes a mailto: instead, and says so.
// ---------------------------------------------------------------------------
// The Apps Script version called sendIssueReport(), which used MailApp — free
// identity and free delivery, both gone. api/src/routes/portal.js exposes only
// /apps and /announcement: there is no issue-report route, no table in
// 002_portal.sql to hold one, and the shared api client cannot invent either.
//
// The options were to drop the button, to POST at a route that does not exist
// and show a failure every time, or to hand the text to the visitor's own mail
// client. The third keeps the report reaching a human, and help.unavailable
// tells the person exactly what is about to happen so the mail window is not a
// surprise. When the API grows a route, replace openMailClient() with a post()
// and delete that string.
// ---------------------------------------------------------------------------

const SUPPORT_MAILBOX = 'it@vcb-con.com';

export default function HelpModal({ open, onClose, apps }) {
  const { t, lang } = useI18n();
  const [area, setArea] = useState('');
  const [message, setMessage] = useState('');
  const [msg, setMsg] = useState({ text: '', tone: '' });

  useEffect(() => {
    if (!open) return;
    setArea('');
    setMessage('');
    setMsg({ text: '', tone: '' });
  }, [open]);

  function submit() {
    if (!area) {
      setMsg({ text: t('help.areaLabel'), tone: 'err' });
      return;
    }
    if (!message.trim()) {
      setMsg({ text: t('help.messageLabel'), tone: 'err' });
      return;
    }

    const chosen = apps.find((a) => a.key === area);
    const areaLabel = chosen ? appName(chosen, lang, t) : t('help.areaOther');
    const subject = `[VCB Connect] ${areaLabel}`;
    // encodeURIComponent, not a template alone: a Thai body and any line break
    // must survive the mailto: URL intact.
    const href =
      `mailto:${SUPPORT_MAILBOX}` +
      `?subject=${encodeURIComponent(subject)}` +
      `&body=${encodeURIComponent(message.trim())}`;

    setMsg({ text: t('help.unavailable'), tone: '' });
    try {
      window.location.href = href;
    } catch {
      /* no mail handler registered — the message above still explains */
    }
  }

  return (
    <Modal open={open} onClose={onClose} labelledBy="help-title">
      <ModalTitle id="help-title">{t('help.title')}</ModalTitle>
      <ModalSub>{t('help.sub')}</ModalSub>

      <div className="mt-5 space-y-4">
        <SelectField
          id="help-area"
          label={t('help.areaLabel')}
          value={area}
          onChange={(e) => setArea(e.target.value)}
        >
          <option value="">{t('help.areaPlaceholder')}</option>
          {apps.map((a) => (
            <option key={a.key} value={a.key}>
              {appName(a, lang, t)}
            </option>
          ))}
          <option value="other">{t('help.areaOther')}</option>
        </SelectField>

        <TextArea
          id="help-message"
          label={t('help.messageLabel')}
          maxLength={2000}
          rows={5}
          placeholder={t('help.messagePlaceholder')}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
      </div>

      <Message text={msg.text} tone={msg.tone} />

      <ModalActions>
        <Button onClick={onClose}>{t('help.close')}</Button>
        <Button variant="primary" onClick={submit}>
          {t('help.send')}
        </Button>
      </ModalActions>
    </Modal>
  );
}
