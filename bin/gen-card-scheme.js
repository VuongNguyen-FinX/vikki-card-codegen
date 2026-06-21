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
 */

const path = require('path');
const fs = require('fs');

let tsMorph;
try {
  tsMorph = require('ts-morph');
} catch (e) {
  console.error(
    '\n[gen-card-scheme] Missing dependency "ts-morph".\n' +
      'If you cloned this repo, run `npm install` first.\n' +
      'If running via npx, the install should be automatic — retry.\n',
  );
  process.exit(1);
}

const {
  Project,
  QuoteKind,
  IndentationText,
  VariableDeclarationKind,
  SyntaxKind,
} = tsMorph;

// ---------------------------------------------------------------------------
// CLI parsing
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') out.dryRun = true;
    else if (a === '--help' || a === '-h') out.help = true;
    else if (a.startsWith('--')) out[a.slice(2)] = argv[++i];
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));

const USAGE = `
gen-card-scheme — wire a new prepaid card scheme variant into vikki-host-app.

Required:
  --scheme <KEY>     enum member added to CARD_PRODUCT_SCHEME
  --base   <NAME>    CardProductName this scheme branches under (e.g. VIKKI_ONE_CONNECT_PREPAID)
  --card   <Asset>   card image asset name in vikki-go-card/assets
  --shadow <Asset>   shadow image asset name in vikki-go-card/assets
  --layout <Asset>   layout image asset name in assets/new-images/card

Optional:
  --value  <str>     enum string value (defaults to --scheme)
  --root   <path>    path to vikki-host-app root (default: auto-detect from cwd)
  --dry-run          print planned changes, write nothing
  --help, -h         show this help
`;

if (args.help) {
  console.log(USAGE);
  process.exit(0);
}

const REQUIRED = ['scheme', 'base', 'card', 'shadow', 'layout'];
const missing = REQUIRED.filter((k) => !args[k]);
if (missing.length) {
  console.error(
    `[gen-card-scheme] Missing required flags: ${missing
      .map((m) => '--' + m)
      .join(', ')}\n${USAGE}`,
  );
  process.exit(1);
}

const cfg = {
  schemeKey: args.scheme,
  schemeValue: args.value || args.scheme,
  baseProduct: args.base,
  cardAsset: args.card,
  shadowAsset: args.shadow,
  layoutAsset: args.layout,
  dryRun: !!args.dryRun,
};

// ---------------------------------------------------------------------------
// Locate the vikki-host-app root
// ---------------------------------------------------------------------------

// Marker that uniquely identifies the host-app working copy.
const ROOT_MARKER = path.join('src', 'modules', 'card-onboard', 'constants', 'index.ts');

function findRoot() {
  if (args.root) {
    const abs = path.resolve(args.root);
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

const ROOT = findRoot();
const P = (rel) => path.join(ROOT, rel);

const FILES = {
  constants: 'src/modules/card-onboard/constants/index.ts',
  goAssets: 'src/modules/vikki-go-card/assets/index.ts',
  cardImages: 'assets/new-images/card/index.ts',
  vikkiCard: 'src/components/vikki-card/VikkiCard.tsx',
  ctaBanner: 'src/modules/cards/components/card-banners/CardCTABanner.tsx',
  prepaidLayout: 'src/modules/cards/components/layout/PrepaidCardLayoutV3.tsx',
  transitCvp: 'src/modules/vikki-go-card/screens/TransitCardCvpScreen.tsx',
  saga: 'src/modules/vikki-go-card/store/saga/vikki-go.saga.ts',
  navigation: 'src/modules/vikki-go-card/vikki-go-card.navigation.tsx',
};

const changes = [];
const skips = [];
const warnings = [];
const logChange = (file, action) => changes.push({ file, action });
const logSkip = (file, reason) => skips.push({ file, reason });

// ---------------------------------------------------------------------------
// ts-morph helpers
// ---------------------------------------------------------------------------

const project = new Project({
  skipAddingFilesFromTsConfig: true,
  compilerOptions: { allowJs: true },
  manipulationSettings: {
    quoteKind: QuoteKind.Single,
    indentationText: IndentationText.TwoSpaces,
    useTrailingCommas: true,
  },
});

function load(relPath) {
  const abs = P(relPath);
  if (!fs.existsSync(abs)) throw new Error(`Target file not found: ${relPath}`);
  return project.addSourceFileAtPath(abs);
}

function ensureNamedImport(sf, moduleSpecifier, name) {
  const imp = sf
    .getImportDeclarations()
    .find((d) => d.getModuleSpecifierValue() === moduleSpecifier);
  if (!imp) {
    sf.addImportDeclaration({ moduleSpecifier, namedImports: [name] });
    return true;
  }
  if (!imp.getNamedImports().some((n) => n.getName() === name)) {
    imp.addNamedImport(name);
    return true;
  }
  return false;
}

function ensureRequireConst(sf, name, requirePath) {
  if (sf.getVariableDeclaration(name)) return false;
  const stmts = sf.getStatements();
  let exportIdx = stmts.findIndex(
    (s) =>
      s.getKind() === SyntaxKind.ExportDeclaration && !s.getModuleSpecifier?.(),
  );
  if (exportIdx === -1) exportIdx = stmts.length;
  sf.insertVariableStatement(exportIdx, {
    declarationKind: VariableDeclarationKind.Const,
    declarations: [{ name, initializer: `require('${requirePath}')` }],
  });
  return true;
}

function ensureNamedExport(sf, name) {
  const exp = sf.getExportDeclarations().find((d) => !d.getModuleSpecifier());
  if (!exp) throw new Error('No bare `export { ... }` found');
  if (exp.getNamedExports().some((n) => n.getName() === name)) return false;
  exp.addNamedExport(name);
  return true;
}

const norm = (s) => s.replace(/\s+/g, '');

function findIf(sf, conditionText) {
  const want = norm(conditionText);
  return sf
    .getDescendantsOfKind(SyntaxKind.IfStatement)
    .find((i) => norm(i.getExpression().getText()) === want);
}

function findVarDecl(sf, name) {
  const decl = sf
    .getDescendantsOfKind(SyntaxKind.VariableDeclaration)
    .find((d) => d.getName() === name);
  if (!decl) throw new Error(`variable declaration '${name}' not found`);
  return decl;
}

function getUseMemoBlock(sf, varName) {
  const decl = findVarDecl(sf, varName);
  const call = decl.getInitializerIfKindOrThrow(SyntaxKind.CallExpression);
  return call.getArguments()[0].getBody();
}

function getUseMemoDeps(sf, varName) {
  const decl = findVarDecl(sf, varName);
  const call = decl.getInitializerIfKindOrThrow(SyntaxKind.CallExpression);
  return call.getArguments()[1];
}

// ---------------------------------------------------------------------------
// Per-file transforms
// ---------------------------------------------------------------------------

function txConstants() {
  const sf = load(FILES.constants);
  const en = sf.getEnumOrThrow('CARD_PRODUCT_SCHEME');
  if (en.getMember(cfg.schemeKey)) {
    logSkip(FILES.constants, `enum member ${cfg.schemeKey} already present`);
    return;
  }
  en.addMember({ name: cfg.schemeKey, value: cfg.schemeValue });
  logChange(FILES.constants, `add CARD_PRODUCT_SCHEME.${cfg.schemeKey}`);
}

function txGoAssets() {
  const sf = load(FILES.goAssets);
  for (const asset of [cfg.cardAsset, cfg.shadowAsset]) {
    const a = ensureRequireConst(sf, asset, `./${asset}.webp`);
    const b = ensureNamedExport(sf, asset);
    if (a || b) logChange(FILES.goAssets, `register asset ${asset}`);
    else logSkip(FILES.goAssets, `${asset} already registered`);
    if (!fs.existsSync(P(`src/modules/vikki-go-card/assets/${asset}.webp`)))
      warnings.push(`Missing asset file: vikki-go-card/assets/${asset}.webp`);
  }
}

function txCardImages() {
  const sf = load(FILES.cardImages);
  const a = ensureRequireConst(sf, cfg.layoutAsset, `./${cfg.layoutAsset}.webp`);
  const b = ensureNamedExport(sf, cfg.layoutAsset);
  if (a || b) logChange(FILES.cardImages, `register layout asset ${cfg.layoutAsset}`);
  else logSkip(FILES.cardImages, `${cfg.layoutAsset} already registered`);
  if (!fs.existsSync(P(`assets/new-images/card/${cfg.layoutAsset}.webp`)))
    warnings.push(`Missing asset file: assets/new-images/card/${cfg.layoutAsset}.webp`);
}

function txVikkiCard() {
  const sf = load(FILES.vikkiCard);
  ensureNamedImport(sf, '@src/modules/card-onboard/constants', 'CARD_PRODUCT_SCHEME');
  ensureNamedImport(sf, '@src/modules/vikki-go-card/assets', cfg.cardAsset);

  const imageSource = sf
    .getVariableDeclarationOrThrow('IMAGE_SOURCE')
    .getInitializerIfKindOrThrow(SyntaxKind.ObjectLiteralExpression);
  const propName = `[CARD_PRODUCT_SCHEME.${cfg.schemeKey}]`;
  const hasProp = imageSource
    .getProperties()
    .some((p) => norm(p.getText()).startsWith(norm(propName)));
  if (!hasProp) {
    imageSource.addPropertyAssignment({
      name: propName,
      initializer: `{\n  front: ${cfg.cardAsset},\n  back: ${cfg.cardAsset},\n}`,
    });
    logChange(FILES.vikkiCard, `IMAGE_SOURCE[${cfg.schemeKey}]`);
  } else {
    logSkip(FILES.vikkiCard, `IMAGE_SOURCE entry for ${cfg.schemeKey} exists`);
  }

  const block = getUseMemoBlock(sf, 'imgSrc');
  if (!block.getText().includes(cfg.schemeKey)) {
    block.insertStatements(
      0,
      `if (productScheme === CARD_PRODUCT_SCHEME.${cfg.schemeKey}) {\n` +
        `  return IMAGE_SOURCE[productScheme][cardSide];\n` +
        `}\n`,
    );
    logChange(FILES.vikkiCard, 'imgSrc useMemo guard');
  } else {
    logSkip(FILES.vikkiCard, 'imgSrc guard exists');
  }
}

function txCtaBanner() {
  const sf = load(FILES.ctaBanner);
  ensureNamedImport(sf, '@src/modules/card-onboard/constants', 'CARD_PRODUCT_SCHEME');
  ensureNamedImport(sf, '@src/modules/vikki-go-card/assets', cfg.cardAsset);

  const block = getUseMemoBlock(sf, 'imageSource');
  if (!block.getText().includes(cfg.schemeKey)) {
    block.insertStatements(
      1,
      `if (productScheme === CARD_PRODUCT_SCHEME.${cfg.schemeKey}) {\n` +
        `  return ${cfg.cardAsset};\n` +
        `}\n`,
    );
    logChange(FILES.ctaBanner, 'imageSource scheme branch');
  } else {
    logSkip(FILES.ctaBanner, 'imageSource branch exists');
  }
}

function txPrepaidLayout() {
  const sf = load(FILES.prepaidLayout);
  ensureNamedImport(sf, '@src/modules/card-onboard/constants', 'CARD_PRODUCT_SCHEME');
  ensureNamedImport(sf, '@src/components/vikki-card', 'IMAGE_SOURCE');

  const ifStmt = findIf(sf, `productName === CardProductName.${cfg.baseProduct}`);
  if (!ifStmt)
    throw new Error(
      `PrepaidCardLayoutV3: 'if (productName === CardProductName.${cfg.baseProduct})' not found`,
    );
  const thenBlock = ifStmt.getThenStatement();
  if (!thenBlock.getText().includes(cfg.schemeKey)) {
    thenBlock.insertStatements(
      0,
      `if (productScheme === CARD_PRODUCT_SCHEME.${cfg.schemeKey}) {\n` +
        `  return IMAGE_SOURCE[productScheme].front;\n` +
        `}\n`,
    );
    logChange(FILES.prepaidLayout, 'cardBanner nested scheme branch');
  } else {
    logSkip(FILES.prepaidLayout, 'cardBanner branch exists');
  }

  const deps = getUseMemoDeps(sf, 'cardBanner');
  if (!deps.getElements().some((e) => e.getText() === 'productScheme')) {
    deps.addElement('productScheme');
    logChange(FILES.prepaidLayout, 'cardBanner deps += productScheme');
  } else {
    logSkip(FILES.prepaidLayout, 'cardBanner deps already include productScheme');
  }
}

function txTransitCvp() {
  const sf = load(FILES.transitCvp);
  ensureNamedImport(sf, '@src/modules/card-onboard/constants', 'CARD_PRODUCT_SCHEME');
  ensureNamedImport(sf, '../assets', cfg.shadowAsset);

  const ifStmt = findIf(
    sf,
    `params.productName === CardProductName.${cfg.baseProduct}`,
  );
  if (!ifStmt)
    throw new Error(
      `TransitCardCvpScreen: base-product if for ${cfg.baseProduct} not found`,
    );
  const thenBlock = ifStmt.getThenStatement();
  if (!thenBlock.getText().includes(cfg.schemeKey)) {
    thenBlock.insertStatements(
      0,
      `if (\n` +
        `  params?.productScheme ===\n` +
        `  CARD_PRODUCT_SCHEME.${cfg.schemeKey}\n` +
        `) {\n` +
        `  return {\n` +
        `    cardImg: ${cfg.shadowAsset},\n` +
        `    desciption: t('vikkigo.exploreYourNewCard'),\n` +
        `  };\n` +
        `}\n`,
    );
    logChange(FILES.transitCvp, 'contentCard nested scheme branch');
  } else {
    logSkip(FILES.transitCvp, 'contentCard branch exists');
  }
}

function txSaga() {
  const sf = load(FILES.saga);
  const call = sf
    .getDescendantsOfKind(SyntaxKind.CallExpression)
    .find(
      (c) =>
        c.getExpression().getText() === 'navigate' &&
        c.getArguments()[0] &&
        c.getArguments()[0].getText().includes('VIKKI_GO.CVP_SCREEN'),
    );
  if (!call)
    throw new Error('saga: navigate(ROUTES.VIKKI_GO.CVP_SCREEN, {...}) not found');
  const obj = call.getArguments()[1];
  if (!obj.getProperty('productScheme')) {
    obj.addPropertyAssignment({
      name: 'productScheme',
      initializer: 'response.payload.productScheme',
    });
    logChange(FILES.saga, 'navigate payload += productScheme');
  } else {
    logSkip(FILES.saga, 'navigate payload already has productScheme');
  }
}

function txNavigation() {
  const sf = load(FILES.navigation);
  ensureNamedImport(sf, '../card-onboard/constants', 'CARD_PRODUCT_SCHEME');

  const alias = sf.getTypeAliasOrThrow('VikkiGoParamList');
  const litType = alias.getTypeNodeOrThrow();
  const cvpProp = litType
    .getDescendantsOfKind(SyntaxKind.PropertySignature)
    .find((p) => p.getName().includes('CVP_SCREEN'));
  if (!cvpProp) throw new Error('navigation: CVP_SCREEN ParamList entry not found');
  const cvpType = cvpProp.getTypeNodeOrThrow();
  const has = cvpType
    .getDescendantsOfKind(SyntaxKind.PropertySignature)
    .some((p) => p.getName() === 'productScheme');
  if (!has) {
    cvpType.addProperty({
      name: 'productScheme',
      hasQuestionToken: true,
      type: 'CARD_PRODUCT_SCHEME',
    });
    logChange(FILES.navigation, 'CVP_SCREEN ParamList += productScheme');
  } else {
    logSkip(FILES.navigation, 'CVP_SCREEN ParamList already has productScheme');
  }
}

// ---------------------------------------------------------------------------
// Formatting — prefer the host-app's own Prettier (matches its config/version)
// ---------------------------------------------------------------------------

function resolvePrettierBin() {
  const candidates = [
    P('node_modules/.bin/prettier'), // host-app's prettier (preferred)
    path.join(__dirname, '..', 'node_modules', '.bin', 'prettier'), // bundled fallback
  ];
  return candidates.find((c) => fs.existsSync(c));
}

function formatChangedFiles() {
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

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

function main() {
  console.log(`\n[gen-card-scheme] root: ${ROOT}`);
  console.log(`  scheme       : ${cfg.schemeKey}`);
  console.log(`  base product : CardProductName.${cfg.baseProduct}`);
  console.log(`  card / shadow: ${cfg.cardAsset} / ${cfg.shadowAsset}`);
  console.log(`  layout       : ${cfg.layoutAsset}`);
  console.log(`  mode         : ${cfg.dryRun ? 'DRY RUN' : 'WRITE'}\n`);

  const steps = [
    txConstants,
    txGoAssets,
    txCardImages,
    txVikkiCard,
    txCtaBanner,
    txPrepaidLayout,
    txTransitCvp,
    txSaga,
    txNavigation,
  ];
  for (const step of steps) step();

  if (!cfg.dryRun) {
    project.saveSync();
    formatChangedFiles();
  }

  console.log('Changes:');
  if (changes.length === 0) console.log('  (none — already wired)');
  for (const c of changes) console.log(`  + ${c.file}\n      ${c.action}`);

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

try {
  main();
} catch (err) {
  console.error(`\n[gen-card-scheme] FAILED: ${err.message}\n`);
  console.error('No files were written.');
  process.exit(1);
}
