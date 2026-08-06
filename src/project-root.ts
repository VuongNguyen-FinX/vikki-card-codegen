// Locate the vikki-host-app root and the fixed set of files this tool edits.

import * as path from 'path';
import * as fs from 'fs';
import { args } from './args';

// Marker that uniquely identifies the host-app working copy.
const ROOT_MARKER = path.join('src', 'modules', 'card-onboard', 'constants', 'index.ts');

function findRoot(): string {
  if (args.root) {
    const abs = path.resolve(args.root as string);
    if (!fs.existsSync(path.join(abs, ROOT_MARKER))) {
      throw new Error(
        `--root "${abs}" does not look like vikki-host-app (missing ${ROOT_MARKER}).`,
      );
    }
    return abs;
  }
  let dir = process.cwd();
  while (true) {
    if (fs.existsSync(path.join(dir, ROOT_MARKER))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(
    'Could not locate vikki-host-app root from the current directory.\n' +
      'Run this from inside the repo, or pass --root <path-to-vikki-host-app>.',
  );
}

export const ROOT = findRoot();

/** Resolve a path relative to the host-app root. */
export const P = (rel: string): string => path.join(ROOT, rel);

export const FILES = {
  constants: 'src/modules/card-onboard/constants/index.ts',
  goAssets: 'src/modules/vikki-go-card/assets/index.ts',
  cardImages: 'assets/new-images/card/index.ts',
  vikkiCard: 'src/components/vikki-card/VikkiCard.tsx',
  ctaBanner: 'src/modules/cards/components/card-banners/CardCTABanner.tsx',
  prepaidLayout: 'src/modules/cards/components/layout/PrepaidCardLayoutV3.tsx',
  transitCvp: 'src/modules/vikki-go-card/screens/TransitCardCvpScreen.tsx',
  saga: 'src/modules/vikki-go-card/store/saga/vikki-go.saga.ts',
  navigation: 'src/modules/vikki-go-card/vikki-go-card.navigation.tsx',
} as const;

export type FileKey = keyof typeof FILES;
