// Asset images — copy provided files into the right folder, renamed to the asset.
//
// Split into plan/commit so the whole run stays atomic: `planImageCopies` only
// validates the source files and records what *would* be copied (so the AST
// transforms can see it via `assetWillExist` and skip false "missing asset"
// warnings); the actual `fs.copyFileSync` happens in `commitImageCopies`,
// called only after every transform has succeeded. Otherwise a transform
// failing after images were already written to disk leaves stray files behind
// while the tool still reports "No files were written".

import * as path from 'path';
import * as fs from 'fs';
import { cfg } from './config';
import { P } from './project-root';
import { warnings, copied } from './report';

interface PlannedCopy {
  srcAbs: string;
  dest: string;
}

export function planImageCopies(): PlannedCopy[] {
  const jobs = [
    {
      src: cfg.cardImg,
      dest: `src/modules/vikki-go-card/assets/${cfg.cardAsset}.webp`,
      label: 'card',
    },
    {
      src: cfg.shadowImg,
      dest: `src/modules/vikki-go-card/assets/${cfg.shadowAsset}.webp`,
      label: 'shadow',
    },
    {
      src: cfg.layoutImg,
      dest: `assets/new-images/card/${cfg.layoutAsset}.webp`,
      label: 'layout',
    },
  ];
  const planned: PlannedCopy[] = [];
  for (const j of jobs) {
    if (!j.src) continue;
    const srcAbs = path.resolve(j.src);
    if (!fs.existsSync(srcAbs)) {
      warnings.push(`Image not found (${j.label}): ${j.src}`);
      continue;
    }
    if (!srcAbs.toLowerCase().endsWith('.webp')) {
      warnings.push(`Image (${j.label}) is not .webp: ${j.src} — copying as-is.`);
    }
    copied.push({ dest: j.dest, from: srcAbs });
    planned.push({ srcAbs, dest: j.dest });
  }
  return planned;
}

/** Actually writes the planned copies to disk. No-op in dry-run mode. */
export function commitImageCopies(planned: PlannedCopy[]): void {
  if (cfg.dryRun) return;
  for (const p of planned) {
    fs.copyFileSync(p.srcAbs, P(p.dest));
  }
}
