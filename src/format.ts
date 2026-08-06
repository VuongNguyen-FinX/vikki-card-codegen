// Formatting — prefer the host-app's own Prettier (matches its config/version).

import * as path from 'path';
import * as fs from 'fs';
import { P, ROOT } from './project-root';
import { changes, warnings } from './report';

function resolvePrettierBin(): string | undefined {
  const candidates = [
    P('node_modules/.bin/prettier'), // host-app's prettier (preferred)
    path.join(__dirname, '..', 'node_modules', '.bin', 'prettier'), // bundled fallback
  ];
  return candidates.find((c) => fs.existsSync(c));
}

export function formatChangedFiles(): void {
  const files = [...new Set(changes.map((c) => c.file))];
  if (!files.length) return;
  const bin = resolvePrettierBin();
  if (!bin) {
    warnings.push('Prettier not found — run your formatter manually on the changed files.');
    return;
  }
  const { spawnSync } = require('child_process');
  const res = spawnSync(bin, ['--write', '--log-level', 'warn', ...files], {
    cwd: ROOT,
    encoding: 'utf-8',
  });
  if (res.status !== 0) {
    warnings.push(
      `Prettier exited non-zero; format the changed files manually.\n    ${(res.stderr || '').trim()}`,
    );
  }
}
