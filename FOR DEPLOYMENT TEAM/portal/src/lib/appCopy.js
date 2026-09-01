// Which text a tile shows, and where it comes from.
//
// ---------------------------------------------------------------------------
// The database is meant to own this copy. The dictionary is the fallback.
// ---------------------------------------------------------------------------
// portal.apps now carries name/name_th and description/description_th, and the
// API returns them as name/nameTh and desc/descTh. The old client ignored all
// four and read its hardcoded I18N table instead, which is why a tile renamed
// in the database still showed the old name until someone redeployed the SPA.
//
// So: prefer the API value, fall back to the dictionary, fall back to the key.
// As Thai copy lands in the database the dictionary entries stop being reached
// and can eventually be deleted — that is the direction of travel, and taking
// the API value first is what makes it possible without a second migration.
//
// `preview` is the exception: it is the long hover paragraph and the schema has
// no column for it, so it is dictionary-only. See the report note.
// ---------------------------------------------------------------------------

/** First non-empty string, or ''. Blank columns in the database are not copy. */
function firstFilled(...values) {
  for (const v of values) {
    if (typeof v === 'string' && v.trim() !== '') return v;
  }
  return '';
}

/**
 * The tile's name in the current language.
 *
 * @param app  a row from GET /api/portal/apps
 * @param lang 'th' | 'en'
 * @param t    the shared translate function
 */
export function appName(app, lang, t) {
  const fromApi = lang === 'th' ? firstFilled(app.nameTh, app.name) : app.name;
  if (fromApi) return fromApi;

  // No API copy: the dictionary. translate() returns the key itself when it has
  // no entry, so compare against the key to detect that and fall through to
  // whatever the row does have rather than printing 'app.foo.name' at someone.
  const key = `app.${app.key}.name`;
  const fromDict = t(key);
  if (fromDict !== key) return fromDict;
  return app.name || app.key;
}

/** The tile's short description in the current language. Same precedence. */
export function appDesc(app, lang, t) {
  const fromApi = lang === 'th' ? firstFilled(app.descTh, app.desc) : app.desc;
  if (fromApi) return fromApi;

  const key = `app.${app.key}.desc`;
  const fromDict = t(key);
  if (fromDict !== key) return fromDict;
  return app.desc || '';
}

/**
 * The long paragraph shown in the hover tooltip.
 *
 * Dictionary-only — portal.apps has no column for it. Falls back to the short
 * description so a tile added through the admin UI, which the dictionary has
 * never heard of, still gets a tooltip rather than a blank one.
 */
export function appPreview(app, lang, t) {
  const key = `app.${app.key}.preview`;
  const fromDict = t(key);
  if (fromDict !== key) return fromDict;
  return appDesc(app, lang, t);
}

/** Everything a card or nav row needs, resolved once. */
export function appCopy(app, lang, t) {
  return {
    name: appName(app, lang, t),
    desc: appDesc(app, lang, t),
    preview: appPreview(app, lang, t),
  };
}
