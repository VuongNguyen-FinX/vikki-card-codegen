// Shared run-report state: what changed, what was skipped (idempotent re-run),
// and warnings — printed by the entry point once all transforms have run.

import * as fs from 'fs';
import { P } from './project-root';
import type { ChangeEntry, SkipEntry, CopiedEntry } from './types';

export const changes: ChangeEntry[] = [];
export const skips: SkipEntry[] = [];
export const warnings: string[] = [];
export const copied: CopiedEntry[] = []; // asset images copied in — reported separately

export const logChange = (file: string, action: string): void => {
  changes.push({ file, action });
};
export const logSkip = (file: string, reason: string): void => {
  skips.push({ file, reason });
};

/** True if the asset already exists on disk or will be copied this run. */
export function assetWillExist(rel: string): boolean {
  return fs.existsSync(P(rel)) || copied.some((c) => c.dest === rel);
}
