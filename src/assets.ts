// Asset images — copy provided files into the right folder, renamed to the asset.

import * as path from 'path';
import * as fs from 'fs';
import { cfg } from './config';
import { P } from './project-root';
import { warnings, copied } from './report';

export function copyImages(): void {
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
    if (!cfg.dryRun) fs.copyFileSync(srcAbs, P(j.dest));
    copied.push({ dest: j.dest, from: srcAbs });
  }
}
