#!/usr/bin/env node
/**
 * gen-card-scheme — standalone AST codemod that wires a NEW prepaid card scheme
 * variant into the existing vikki-host-app source, mirroring PR #3215
 * (commit 48b74d4 "feat: card vikki one connect prepaid victoria").
 *
 * Distributable as its own GitHub repo. Run on any machine with Node >= 16:
 *
 *   # from inside the vikki-host-app repo:
 *   npx github:<you>/vikki-card-codegen \
 *     --scheme VIKKI_ONE_CONNECT_PP_VICTORIA_PRESCHOOL \
 *     --base   VIKKI_ONE_CONNECT_PREPAID \
 *     --card   VikkiOneConnectPrepaidMarina \
 *     --shadow VikkiOneConnectPrepaidMarinaShadow \
 *     --layout VikkiGoProPrepaidMarinaCardLayout
 *
 * It locates the host-app root by walking up from the current directory (or use
 * --root <path>). It does NOT scaffold screens — it INJECTS small, well-anchored
 * snippets into 9 existing files via the TypeScript AST (ts-morph), so edits land
 * in the exact right node. Every step is idempotent. Binary .webp assets are NOT
 * generated (designer-provided); the tool registers them and warns if missing.
 *
 * This file is just the orchestrator — see:
 *   args.ts          CLI flag parsing, --help, usage text
 *   wizard.ts         interactive prompt (used when required flags are missing)
 *   project-root.ts   locates the host-app checkout, lists target files
 *   config.ts         resolved run config, shared by transforms/assets
 *   ast-utils.ts      ts-morph helpers shared by every transform
 *   transforms.ts      one function per target file
 *   assets.ts          copies designer-provided .webp files into place
 *   format.ts          runs the host-app's Prettier on changed files
 *   report.ts          change/skip/warning bookkeeping printed at the end
 */

// wizard.ts imports args.ts, which handles --help (and exits) before anything
// else runs — import it first so that check happens before project-root.ts
// tries to locate the host-app root.
import { resolveConfig } from './wizard';
import { setCfg, cfg } from './config';
import { ROOT } from './project-root';
import { TRANSFORMS } from './transforms';
import { project } from './ast-utils';
import { formatChangedFiles } from './format';
import { copyImages } from './assets';
import { changes, skips, warnings, copied } from './report';

async function main(): Promise<void> {
  setCfg(await resolveConfig());

  console.log(`\n[gen-card-scheme] root: ${ROOT}`);
  console.log(`  scheme       : ${cfg.schemeKey}`);
  console.log(`  base product : CardProductName.${cfg.baseProduct}`);
  console.log(`  card / shadow: ${cfg.cardAsset} / ${cfg.shadowAsset}`);
  console.log(`  layout       : ${cfg.layoutAsset}`);
  console.log(`  mode         : ${cfg.dryRun ? 'DRY RUN' : 'WRITE'}\n`);

  // Copy images first so the "missing asset" warnings reflect the final state.
  copyImages();

  for (const step of TRANSFORMS) step();

  if (!cfg.dryRun) {
    project.saveSync();
    formatChangedFiles();
  }

  console.log('Changes:');
  if (changes.length === 0) console.log('  (none — already wired)');
  for (const c of changes) console.log(`  + ${c.file}\n      ${c.action}`);

  if (copied.length) {
    console.log('\nImages copied:');
    for (const c of copied) console.log(`  ⇒ ${c.dest}\n      from ${c.from}`);
  }

  if (skips.length) {
    console.log('\nSkipped (idempotent):');
    for (const s of skips) console.log(`  = ${s.file} — ${s.reason}`);
  }

  if (warnings.length) {
    console.log('\n⚠ Warnings:');
    for (const w of warnings) console.log(`  ! ${w}`);
    console.log('\n  → Add the missing .webp files (designer assets), then re-run is safe (idempotent).');
  }

  console.log(
    `\n${cfg.dryRun ? 'DRY RUN complete — no files written.' : 'Done. Review with: git diff'}\n`,
  );
}

main().catch((err: Error) => {
  console.error(`\n[gen-card-scheme] FAILED: ${err.message}\n`);
  console.error('No files were written.');
  process.exit(1);
});
