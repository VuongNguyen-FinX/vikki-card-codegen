#!/usr/bin/env node
/**
 * gen-card-scheme — standalone AST codemod that wires a NEW VIKKI_ONE_CONNECT
 * org-card scheme variant into the existing vikki-host-app source, mirroring
 * PR #3378 ("add org card DAMTC" — org-card / physical-card flow).
 *
 * Distributable as its own GitHub repo. Run on any machine with Node >= 16:
 *
 *   # from inside the vikki-host-app repo:
 *   npx github:<you>/vikki-card-codegen \
 *     --scheme VIKKI_ONE_CONNECT_DAMTC_EMPLOYEE \
 *     --template-value VK0302391568E \
 *     --brand DAMTC
 *
 * It locates the host-app root by walking up from the current directory (or use
 * --root <path>). It does NOT scaffold screens — it INJECTS small, well-anchored
 * snippets into 13 existing files via the TypeScript AST (ts-morph), so edits land
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
import { planImageCopies, commitImageCopies } from './assets';
import { changes, skips, warnings, copied } from './report';

async function main(): Promise<void> {
  setCfg(await resolveConfig());

  console.log(`\n[gen-card-scheme] root: ${ROOT}`);
  console.log(`  scheme       : CARD_PRODUCT_SCHEME.${cfg.schemeKey} = '${cfg.schemeValue}'`);
  console.log(`  template     : CARD_TEMPLATE.${cfg.templateKey} = '${cfg.templateValue}'`);
  console.log(`  header / bg  : ${cfg.headerAsset} / ${cfg.bgAsset}`);
  console.log(`  front        : ${cfg.frontAsset}`);
  console.log(`  layout       : ${cfg.layoutAsset}`);
  console.log(`  banner en/vi : ${cfg.bannerEnAsset} / ${cfg.bannerViAsset}`);
  console.log(`  home todo    : ${cfg.homeTodoKey}`);
  console.log(`  text color   : ${cfg.textColor}`);
  console.log(`  mode         : ${cfg.dryRun ? 'DRY RUN' : 'WRITE'}\n`);

  // Plan image copies first so the "missing asset" warnings reflect the final
  // state — but don't touch disk yet, so a transform failure below leaves no
  // stray files behind (see assets.ts for why plan/commit is split).
  const plannedImages = planImageCopies();

  for (const step of TRANSFORMS) step();

  if (!cfg.dryRun) {
    commitImageCopies(plannedImages);
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
