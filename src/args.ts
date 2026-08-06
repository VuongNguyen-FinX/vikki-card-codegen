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
gen-card-scheme — wire a new prepaid card scheme variant into vikki-host-app.

Required:
  --scheme <KEY>     enum member added to CARD_PRODUCT_SCHEME
  --base   <NAME>    CardProductName this scheme branches under (e.g. VIKKI_ONE_CONNECT_PREPAID)
  --card   <Asset>   card image asset name in vikki-go-card/assets
  --shadow <Asset>   shadow image asset name in vikki-go-card/assets
  --layout <Asset>   layout image asset name in assets/new-images/card

Image files (optional — copied into the asset folders, renamed to the asset name):
  --card-img   <path>  source .webp for the card image
  --shadow-img <path>  source .webp for the shadow image
  --layout-img <path>  source .webp for the layout image

Optional:
  --value  <str>     enum string value (defaults to --scheme)
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

export const REQUIRED = ['scheme', 'base', 'card', 'shadow', 'layout'] as const;

/** Build cfg from a plain object of answers (CLI flags or wizard responses). */
export function buildCfg(a: RawArgs): Cfg {
  return {
    schemeKey: a.scheme as string,
    schemeValue: (a.value as string) || (a.scheme as string),
    baseProduct: a.base as string,
    cardAsset: a.card as string,
    shadowAsset: a.shadow as string,
    layoutAsset: a.layout as string,
    cardImg: (a['card-img'] as string) || null,
    shadowImg: (a['shadow-img'] as string) || null,
    layoutImg: (a['layout-img'] as string) || null,
    dryRun: !!a.dryRun,
  };
}
