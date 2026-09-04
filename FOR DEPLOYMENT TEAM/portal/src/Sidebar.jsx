import { useAuth, useI18n, useTheme } from '@vcb/shared';
import {
  AiTavernIcon,
  AppIcon,
  ErpIcon,
  GlobeIcon,
  HelpIcon,
  NavArrowIcon,
  OnboardingIcon,
  ZoomIcon,
} from './icons';
import { SHORTCUT_LINKS, appLink } from './data';
import { appCopy } from './lib/appCopy';

const NAV_ITEM =
  'group flex w-full items-center gap-3 rounded-control px-3 py-2 text-left text-sm ' +
  'text-sidebar-text transition-colors hover:bg-sidebar-active hover:text-white ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-dark/50 ' +
  'disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-transparent';

const SECTION_LABEL =
  'px-3 pb-1.5 pt-5 text-[10px] font-semibold uppercase tracking-[0.16em] text-sidebar-dim';

export default function Sidebar({
  open,
  onClose,
  apps,
  greeting,
  initials,
  userTitle,
  onHelp,
  bindTooltip,
}) {
  const { t, lang } = useI18n();
  const { theme } = useTheme();
  const { token } = useAuth();

  // Pulled out of the applications list and rendered under "More" instead. It
  // is a ported module like the others - its URL comes from portal.apps, not a
  // hard-coded Apps Script link - but it is for new starters in their first
  // days rather than part of anyone's daily work.
  const onboardingApp = apps.find((a) => a.key === 'onboarding') || null;

  return (
    <>
      {/* Off-canvas below lg, a sticky column above it. */}
      <aside
        className={
          'fixed inset-y-0 left-0 z-40 flex h-full w-[274px] flex-col overflow-y-auto ' +
          'bg-portal-sidebar text-sidebar-text transition-transform duration-200 ' +
          'dark:bg-portal-sidebar-dark lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ' +
          (open ? 'translate-x-0' : '-translate-x-full')
        }
      >
        {/* brand */}
        <div className="flex items-center gap-3 px-5 pb-4 pt-6">
          <div className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-[10px] bg-portal-logo shadow-[inset_0_0_0_1px_rgba(255,255,255,.08)] dark:bg-portal-logo-dark">
            <GlobeIcon className="h-[21px] w-[21px] text-white" />
          </div>
          <div>
            <div className="font-wordmark text-[15px] font-bold leading-tight tracking-[0.08em] text-white">
              VCB CONNECT
            </div>
            <div className="mt-0.5 text-[10px] uppercase tracking-[0.16em] text-sidebar-dim">
              {t('portal.brandSub')}
            </div>
          </div>
        </div>

        {/* who is looking */}
        <div className="mx-4 mb-3 flex items-center gap-2.5 rounded-xl bg-white/5 px-3 py-2.5">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/10 text-xs font-semibold text-white">
            {initials}
          </span>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-white" title={userTitle}>
              {greeting}
            </div>
            <div className="text-[11px] text-sidebar-dim">{t('portal.staff')}</div>
          </div>
        </div>

        <nav className="flex-1 px-3 pb-4">
          <div className={SECTION_LABEL}>{t('nav.applications')}</div>
          {/* Onboarding is a module like the rest, but it belongs under "More"
              with the new-starter material rather than in the daily-work list -
              so it is pulled out here and rendered below, not twice. */}
          {apps.filter((a) => a.key !== 'onboarding').map((a) => {
            const copy = appCopy(a, lang, t);
            return (
              <a
                key={a.key}
                className={NAV_ITEM}
                href={appLink(a.url, { theme, lang, token })}
                target="_blank"
                rel="noopener noreferrer"
                onClick={onClose}
                {...bindTooltip({
                  key: `nav-${a.key}`,
                  name: copy.name,
                  desc: copy.preview,
                  kind: 'nav',
                })}
              >
                <AppIcon icon={a.icon} className="h-[18px] w-[18px] shrink-0" />
                <span className="min-w-0 flex-1 truncate">{copy.name}</span>
                <NavArrowIcon className="h-3.5 w-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-70" />
              </a>
            );
          })}

          <div className={SECTION_LABEL}>{t('nav.shortcuts')}</div>
          <a
            className={NAV_ITEM}
            href={SHORTCUT_LINKS.erp}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onClose}
            {...bindTooltip({
              key: 'nav-erp',
              name: t('nav.erp'),
              desc: t('tt.erpDesc'),
              kind: 'nav',
            })}
          >
            <ErpIcon className="h-[18px] w-[18px] shrink-0" />
            <span>{t('nav.erp')}</span>
          </a>
          <a
            className={NAV_ITEM}
            href={SHORTCUT_LINKS.zoom}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onClose}
            {...bindTooltip({
              key: 'nav-zoom',
              name: t('nav.zoom'),
              desc: t('tt.zoomDesc'),
              kind: 'nav',
            })}
          >
            <ZoomIcon className="h-[18px] w-[18px] shrink-0" />
            <span>{t('nav.zoom')}</span>
          </a>

          <div className={SECTION_LABEL}>{t('nav.more')}</div>
          {/* Onboarding is a module, so its URL comes from portal.apps rather
              than a constant - it moves with the environment like every other
              app instead of being pinned to whatever was hard-coded. It renders
              here rather than as a tile because it is for new starters on their
              first days, not part of everyone's daily work. */}
          {onboardingApp ? (
            <a
              className={NAV_ITEM}
              href={appLink(onboardingApp.url, { theme, lang, token })}
              onClick={onClose}
              {...bindTooltip({
                key: 'nav-onboarding',
                name: t('nav.onboarding'),
                desc: t('tt.onboardingDesc'),
                kind: 'nav',
              })}
            >
              <OnboardingIcon className="h-[18px] w-[18px] shrink-0" />
              <span>{t('nav.onboarding')}</span>
            </a>
          ) : null}
          <button className={NAV_ITEM} type="button" title={t('nav.comingSoon')} disabled>
            <AiTavernIcon className="h-[18px] w-[18px] shrink-0" />
            <span>{t('nav.aiTavern')}</span>
          </button>
          <button
            className={NAV_ITEM}
            type="button"
            onClick={() => {
              onClose();
              onHelp();
            }}
          >
            <HelpIcon className="h-[18px] w-[18px] shrink-0" />
            <span>{t('nav.help')}</span>
          </button>
        </nav>

        <div className="border-t border-white/5 px-5 py-4 text-[11px] text-sidebar-dim">
          {t('portal.footerLeft')}
        </div>
      </aside>

      {/* Scrim, mobile only — the sidebar is always visible from lg up. */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/45 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
    </>
  );
}
