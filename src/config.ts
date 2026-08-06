// Resolved run configuration, set once in main() before any transform runs.
// Exported as a live binding so transforms.ts / assets.ts can read the current
// value without threading it through every function signature.

import type { Cfg } from './types';

export let cfg: Cfg;

export function setCfg(c: Cfg): void {
  cfg = c;
}
