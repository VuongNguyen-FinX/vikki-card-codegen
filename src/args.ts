// ---------------------------------------------------------------------------
// CLI flag parsing — `--flag value` / `--flag` boolean pairs, plus --help.
// Evaluated at import time so `--help` can short-circuit before anything else
// (e.g. root detection, which requires being inside a vikki-host-app checkout).
// ---------------------------------------------------------------------------

import type { Cfg } from './types';

export type RawArgs = Record<string, string | boolean | undefined>;

function parseArgs(argv: string[]): RawArgs {
  const out: RawArgs = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') out.dryRun = true;
    else if (a === '--help' || a === '-h') out.help = true;
    else if (a === '--interactive' || a === '-i') out.interactive = true;
    else if (a.startsWith('--')) out[a.slice(2)] = argv[++i];
  }
  return out;
}

export const args = parseArgs(process.argv.slice(2));

export const USAGE = `
gen-card-scheme — wire a new VIKKI_ONE_CONNECT org-card scheme variant into
vikki-host-app (mirrors PR #3378 "add org card DAMTC" — org-card /
physical-card flow: VikkiOrgCard, VikkiOrgName, DualCardLayout,
CardBannerItem, CardActivationScreen, PhysicalCardIntroScreen, home todos).

Required:
  --scheme         <KEY>    enum member added to CARD_PRODUCT_SCHEME
  --template-value  <str>   card-number prefix for CARD_TEMPLATE, e.g. VK0302391568E

Optional (all asset/name flags default from --scheme when omitted):
  --value          <str>    CARD_PRODUCT_SCHEME string value (default: --scheme)
  --template-key   <KEY>    CARD_TEMPLATE enum member (default: --scheme minus the
                             VIKKI_ONE_CONNECT_ prefix, e.g. DAMTC_EMPLOYEE)
  --brand          <Name>   PascalCase brand code seeding the asset defaults below
                             (default: PascalCase of --template-key)
  --header         <Asset>  org-card header/logo asset (default: <brand>Header)
  --bg             <Asset>  org-card background asset (default: <brand>BG)
  --front          <Asset>  physical-card front asset (default: <brand>Front)
  --layout         <Asset>  dual-card layout asset (default: <brand>VikkiOneConnectLayout)
  --banner-en      <Asset>  home banner, EN (default: <brand>VikkiOneConnectBannerEN)
  --banner-vi      <Asset>  home banner, VI (default: <brand>VikkiOneConnectBannerVI)
  --home-todo      <KEY>    HomeTodoType member (default: first segment of
                             --template-key + _VIKKI_ONE_CONNECT_ONBOARD)
  --color          <expr>   color expression for VikkiOrgName styles
                             (default: Colors.Labels.StrongWhite)

Image files (optional — copied into the asset folders, renamed to the asset name):
  --header-img     <path>   source .webp for the header asset
  --bg-img         <path>   source .webp for the background asset
  --front-img      <path>   source .webp for the front asset
  --layout-img     <path>   source .webp for the layout asset
  --banner-en-img  <path>   source .webp for the EN banner asset
  --banner-vi-img  <path>   source .webp for the VI banner asset

  --root   <path>    path to vikki-host-app root (default: auto-detect from cwd)
  --interactive, -i  force the interactive wizard
  --dry-run          print planned changes, write nothing
  --help, -h         show this help

Run with no flags (in a TTY) to launch the interactive wizard.
`;

if (args.help) {
  console.log(USAGE);
  process.exit(0);
}

export const REQUIRED = ['scheme', 'template-value'] as const;

/** SCREAMING_SNAKE / kebab segment → PascalCase word (`STUDENT_CERGY` → `StudentCergy`). */
function toPascalCase(raw: string): string {
  return raw
    .split(/[_-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join('');
}

const SCHEME_PREFIX = 'VIKKI_ONE_CONNECT_';

/** `VIKKI_ONE_CONNECT_DAMTC_EMPLOYEE` → `DAMTC_EMPLOYEE` (falls back to the raw key). */
export function deriveTemplateKey(schemeKey: string): string {
  return schemeKey.toUpperCase().startsWith(SCHEME_PREFIX)
    ? schemeKey.slice(SCHEME_PREFIX.length)
    : schemeKey;
}

/** PascalCase brand seed for asset-name defaults, e.g. `DAMTC_EMPLOYEE` → `DamtcEmployee`. */
export function deriveBrand(templateKey: string): string {
  return toPascalCase(templateKey);
}

/** First underscore-segment of the template key, e.g. `DAMTC_EMPLOYEE` → `DAMTC`. */
export function deriveHomeTodoKey(templateKey: string): string {
  return `${templateKey.split('_')[0]}_VIKKI_ONE_CONNECT_ONBOARD`;
}

/** Build cfg from a plain object of answers (CLI flags or wizard responses). */
export function buildCfg(a: RawArgs): Cfg {
  const schemeKey = a.scheme as string;
  const schemeValue = (a.value as string) || schemeKey;
  const templateKey = (a['template-key'] as string) || deriveTemplateKey(schemeKey);
  const brand = (a.brand as string) || deriveBrand(templateKey);

  return {
    schemeKey,
    schemeValue,
    templateKey,
    templateValue: a['template-value'] as string,

    headerAsset: (a.header as string) || `${brand}Header`,
    bgAsset: (a.bg as string) || `${brand}BG`,
    frontAsset: (a.front as string) || `${brand}Front`,
    layoutAsset: (a.layout as string) || `${brand}VikkiOneConnectLayout`,
    bannerEnAsset: (a['banner-en'] as string) || `${brand}VikkiOneConnectBannerEN`,
    bannerViAsset: (a['banner-vi'] as string) || `${brand}VikkiOneConnectBannerVI`,

    homeTodoKey: (a['home-todo'] as string) || deriveHomeTodoKey(templateKey),
    textColor: (a.color as string) || 'Colors.Labels.StrongWhite',

    headerImg: (a['header-img'] as string) || null,
    bgImg: (a['bg-img'] as string) || null,
    frontImg: (a['front-img'] as string) || null,
    layoutImg: (a['layout-img'] as string) || null,
    bannerEnImg: (a['banner-en-img'] as string) || null,
    bannerViImg: (a['banner-vi-img'] as string) || null,

    dryRun: !!a.dryRun,
  };
}
