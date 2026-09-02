// Thai/English, hand-rolled. No i18n library — TECH_STACK.md forbids the extra
// dependency and the need is small: two languages, flat keys, one interpolation
// form.
//
// ---------------------------------------------------------------------------
// Thai is the default.
// ---------------------------------------------------------------------------
// Nearly every user is Thai-speaking, and the source text already in the
// modules is Thai — the hr-worklog dictionary is literally Thai keys with an
// optional English translation, so Thai is what exists and English is what is
// added. Defaulting to English would show most people a half-translated app on
// first load. A stored preference always wins over this default.
// ---------------------------------------------------------------------------

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

export const LANGS = ['th', 'en'];
export const DEFAULT_LANG = 'th';

// One key for all seven SPAs. The modules previously used vcb-lang, hr_lang,
// sop-lang and vcb_mm_lang, so switching language in one app left the others
// alone. Same key everywhere means the choice follows the person across the
// portal — which is the point of "one website".
export const LANG_KEY = 'vcb_lang';

function readStoredLang() {
  try {
    const v = localStorage.getItem(LANG_KEY);
    return LANGS.includes(v) ? v : null;
  } catch {
    // Private window / blocked storage. See the same note in api.js: this must
    // degrade to "no saved preference", never throw during render.
    return null;
  }
}

function writeStoredLang(lang) {
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch {
    /* preference will not survive a reload; the app still works */
  }
}

/** Browser hint, used only when nothing is stored. Thai unless clearly English. */
function detectLang() {
  try {
    const nav = navigator.languages || [navigator.language || ''];
    for (const l of nav) {
      const code = String(l).toLowerCase();
      if (code.startsWith('th')) return 'th';
      if (code.startsWith('en')) return 'en';
    }
  } catch {
    /* no navigator (SSR, tests) */
  }
  return DEFAULT_LANG;
}

/* ------------------------------- dictionaries ----------------------------- */

/**
 * Build a module dictionary.
 *
 *   export const dict = createDictionary({
 *     'entry.title': { th: 'บันทึกงาน', en: 'Entry' },
 *     'entry.saved': { th: 'บันทึกแล้ว',  en: 'Saved' },
 *   });
 *
 * Merged over the shared dictionary below, so a module may override a common
 * word where its own wording differs.
 */
export function createDictionary(entries) {
  return { ...entries };
}

/** Merge dictionaries left to right; later wins. */
export function mergeDictionaries(...dicts) {
  return Object.assign({}, ...dicts.filter(Boolean));
}

/**
 * Words every module needs. Kept small on purpose — anything that is only used
 * by one screen belongs in that module's own dictionary, not here.
 * Thai wording follows what the existing apps already say.
 */
export const commonDictionary = createDictionary({
  // actions
  'common.save': { th: 'บันทึก', en: 'Save' },
  'common.cancel': { th: 'ยกเลิก', en: 'Cancel' },
  'common.delete': { th: 'ลบ', en: 'Delete' },
  'common.edit': { th: 'แก้ไข', en: 'Edit' },
  'common.add': { th: 'เพิ่ม', en: 'Add' },
  'common.confirm': { th: 'ยืนยัน', en: 'Confirm' },
  'common.ok': { th: 'ตกลง', en: 'OK' },
  'common.close': { th: 'ปิด', en: 'Close' },
  'common.search': { th: 'ค้นหา', en: 'Search' },
  'common.filter': { th: 'ตัวกรอง', en: 'Filter' },
  'common.export': { th: 'ส่งออก', en: 'Export' },
  'common.import': { th: 'นำเข้า', en: 'Import' },
  'common.print': { th: 'พิมพ์', en: 'Print' },
  'common.refresh': { th: 'รีเฟรช', en: 'Refresh' },
  'common.back': { th: 'ย้อนกลับ', en: 'Back' },
  'common.next': { th: 'ถัดไป', en: 'Next' },
  'common.retry': { th: 'ลองใหม่', en: 'Retry' },

  // answers
  'common.yes': { th: 'ใช่', en: 'Yes' },
  'common.no': { th: 'ไม่', en: 'No' },
  'common.all': { th: 'ทั้งหมด', en: 'All' },
  'common.none': { th: 'ไม่มี', en: 'None' },

  // states
  'common.loading': { th: 'กำลังโหลด…', en: 'Loading…' },
  'common.saving': { th: 'กำลังบันทึก…', en: 'Saving…' },
  'common.saved': { th: 'บันทึกแล้ว', en: 'Saved' },
  'common.working': { th: 'กำลังดำเนินการ…', en: 'Working…' },
  'common.empty': { th: 'ไม่มีข้อมูล', en: 'No data' },
  'common.required': { th: 'จำเป็นต้องกรอก', en: 'Required' },

  // errors — keyed to the API's error codes so a catch block can do
  // t(`error.${err.code}`) and fall back to the code itself when unmapped.
  'common.error': { th: 'เกิดข้อผิดพลาด', en: 'An error occurred' },
  'error.NETWORK_ERROR': { th: 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้', en: 'Cannot reach the server' },
  'error.AUTH_REQUIRED': { th: 'กรุณาเข้าสู่ระบบ', en: 'Please sign in' },
  'error.AUTH_INVALID': { th: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่', en: 'Session expired — please sign in again' },
  'error.BAD_CREDENTIALS': { th: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง', en: 'Incorrect email or password' },
  'error.FORBIDDEN': { th: 'คุณไม่มีสิทธิ์ใช้งานส่วนนี้', en: 'You do not have access to this' },
  'error.FORBIDDEN_SITE': { th: 'คุณไม่มีสิทธิ์ในหน่วยงานนี้', en: 'You do not have access to this site' },
  'error.NOT_FOUND': { th: 'ไม่พบข้อมูล', en: 'Not found' },
  'error.VALIDATION_FAILED': { th: 'ข้อมูลไม่ถูกต้อง', en: 'Please check the form' },
  'error.ALREADY_EXISTS': { th: 'มีข้อมูลนี้อยู่แล้ว', en: 'This already exists' },
  'error.INTERNAL': { th: 'ระบบขัดข้อง กรุณาลองใหม่', en: 'Something went wrong — please try again' },

  // auth
  'auth.signIn': { th: 'เข้าสู่ระบบ', en: 'Sign in' },
  'auth.signOut': { th: 'ออกจากระบบ', en: 'Sign out' },
  // Shown when a module needs a session it does not have. The portal is the
  // only place anyone signs in; a module never asks for a password itself.
  'auth.signInAtPortal': { th: 'กรุณาเข้าสู่ระบบที่ VCB Connect', en: 'Please sign in at VCB Connect' },
  'auth.portalHandlesSignIn': {
    th: 'เข้าสู่ระบบครั้งเดียวที่หน้าหลัก แล้วใช้งานได้ทุกแอปโดยไม่ต้องเข้าสู่ระบบซ้ำ',
    en: 'Sign in once at the portal and every app opens without asking again.',
  },
  'auth.goToPortal': { th: 'ไปที่ VCB Connect', en: 'Go to VCB Connect' },
  'auth.signInWithGoogle': { th: 'เข้าสู่ระบบด้วย Google', en: 'Sign in with Google' },
  'auth.email': { th: 'อีเมล', en: 'Email' },
  'auth.password': { th: 'รหัสผ่าน', en: 'Password' },
  'auth.name': { th: 'ชื่อ', en: 'Name' },
  'auth.role': { th: 'บทบาท', en: 'Role' },

  // settings
  'settings.language': { th: 'ภาษา', en: 'Language' },
  'settings.theme': { th: 'ธีม', en: 'Theme' },
  'theme.light': { th: 'สว่าง', en: 'Light' },
  'theme.dark': { th: 'มืด', en: 'Dark' },
  'theme.auto': { th: 'ตามระบบ', en: 'Auto' },

  // dates
  'date.today': { th: 'วันนี้', en: 'Today' },
  'date.yesterday': { th: 'เมื่อวาน', en: 'Yesterday' },
  'date.tomorrow': { th: 'พรุ่งนี้', en: 'Tomorrow' },
  'date.date': { th: 'วันที่', en: 'Date' },
  'date.time': { th: 'เวลา', en: 'Time' },
  'date.day': { th: 'วัน', en: 'Day' },
  'date.week': { th: 'สัปดาห์', en: 'Week' },
  'date.month': { th: 'เดือน', en: 'Month' },
  'date.year': { th: 'ปี', en: 'Year' },
  'date.from': { th: 'ตั้งแต่', en: 'From' },
  'date.to': { th: 'ถึง', en: 'To' },
  'date.startDate': { th: 'วันที่เริ่ม', en: 'Start date' },
  'date.endDate': { th: 'วันที่สิ้นสุด', en: 'End date' },
  'date.weekend': { th: 'วันหยุดสุดสัปดาห์', en: 'Weekend' },
  'date.holiday': { th: 'วันหยุด', en: 'Holiday' },
});

/* ------------------------------ month / day names ------------------------- */

export const MONTHS = {
  th: ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'],
  en: ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'],
};

export const MONTHS_SHORT = {
  th: ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
    'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
};

export const WEEKDAYS = {
  th: ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'],
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
};

/* --------------------------------- lookup --------------------------------- */

const PLACEHOLDER = /\{(\w+)\}/g;

function interpolate(text, vars) {
  if (!vars) return text;
  return text.replace(PLACEHOLDER, (whole, name) =>
    // Leave an unknown placeholder visible rather than blanking it — a stray
    // {name} in the UI is a bug report; empty text is a mystery.
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : whole
  );
}

/**
 * Look up a key. Missing translation renders the key itself, never a blank —
 * a screen that silently loses its labels is far worse than one showing
 * `entry.title`, which points straight at the missing entry.
 */
export function translate(dict, lang, key, vars) {
  if (key == null) return '';
  const entry = dict?.[key];
  if (!entry) return interpolate(String(key), vars);
  // A plain string means "same in both languages" — allowed, and common for
  // proper nouns and codes.
  const text =
    typeof entry === 'string' ? entry : entry[lang] ?? entry[DEFAULT_LANG] ?? key;
  return interpolate(String(text), vars);
}

/* -------------------------------- provider -------------------------------- */

const I18nContext = createContext(null);

/**
 * <I18nProvider dictionary={moduleDict}>
 *
 * `dictionary` is merged over commonDictionary, so t('common.save') works in
 * every module without each one repeating it.
 */
export function I18nProvider({ children, dictionary, defaultLang }) {
  const [lang, setLangState] = useState(
    () => readStoredLang() || defaultLang || detectLang()
  );

  const dict = useMemo(
    () => mergeDictionaries(commonDictionary, dictionary),
    [dictionary]
  );

  // lang on <html> so CSS can adjust line-height and font for Thai, which sits
  // taller than Latin because of its stacked vowel and tone marks.
  useEffect(() => {
    try {
      document.documentElement.lang = lang;
    } catch {
      /* no document */
    }
  }, [lang]);

  const setLang = useCallback((next) => {
    if (!LANGS.includes(next)) return;
    writeStoredLang(next);
    setLangState(next);
  }, []);

  const t = useCallback((key, vars) => translate(dict, lang, key, vars), [dict, lang]);

  const value = useMemo(
    () => ({
      lang,
      setLang,
      toggleLang: () => setLang(lang === 'th' ? 'en' : 'th'),
      t,
      isThai: lang === 'th',
      dict,

      monthName: (m, short = false) =>
        (short ? MONTHS_SHORT : MONTHS)[lang]?.[m] ?? '',
      weekdayName: (d) => WEEKDAYS[lang]?.[d] ?? '',

      /**
       * Thai calendars use the Buddhist Era (+543). Existing HR screens show BE
       * by default in Thai and CE in English; keep that.
       */
      displayYear: (year) => (lang === 'th' ? year + 543 : year),

      /** Locale-correct date without pulling in a date library. */
      formatDate: (value, opts) => {
        const d = value instanceof Date ? value : new Date(value);
        if (Number.isNaN(d.getTime())) return '';
        try {
          return d.toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-GB', opts);
        } catch {
          return d.toISOString().slice(0, 10);
        }
      },

      formatNumber: (n, opts) => {
        if (n == null || Number.isNaN(Number(n))) return '';
        try {
          // Thai digits are not used in these apps — force Latin numerals so
          // th-TH does not render ๑๒๓ in tables people read alongside Excel.
          return Number(n).toLocaleString(
            lang === 'th' ? 'th-TH-u-nu-latn' : 'en-GB',
            opts
          );
        } catch {
          return String(n);
        }
      },
    }),
    [lang, setLang, t, dict]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>');
  return ctx;
}

/** Shorthand for components that only need t(). */
export function useT() {
  return useI18n().t;
}
