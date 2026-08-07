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

// Mirrors PR #3378 ("add org card DAMTC") — the org-card / physical-card flow,
// not the older VIKKI_GO CVP onboarding flow (PR #3215).
export const FILES = {
  schemeConstants: 'src/modules/card-onboard/constants/index.ts',
  cardConstants: 'src/modules/cards/card.constants.ts',
  layoutAssets: 'assets/new-images/card/index.ts',
  bannerAssets: 'src/modules/cards/assets/banner-card-list/index.ts',
  orgCardAssets: 'src/modules/cards/assets/org-card/index.ts',
  orgCard: 'src/modules/cards/components/card-details/VikkiOrgCard.tsx',
  orgName: 'src/modules/cards/components/card-details/VikkiOrgName.tsx',
  dualCardLayout: 'src/modules/cards/components/layout/DualCardLayout.tsx',
  cardBannerItem: 'src/modules/cards/components/card-banners/CardBannerItem.tsx',
  cardActivation: 'src/modules/cards/screens/CardActivationScreen.tsx',
  physicalCardIntro: 'src/modules/physical-card/screens/PhysicalCardIntroScreen.tsx',
  todoItem: 'src/modules/dashboard/component/home-todo/TodoItem.tsx',
  useHomeTodo: 'src/modules/dashboard/hook/useHomeTodo.ts',
} as const;

export type FileKey = keyof typeof FILES;
