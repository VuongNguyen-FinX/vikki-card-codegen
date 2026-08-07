// Per-file transforms — one function per target file, each injecting a small,
// well-anchored snippet via the TypeScript AST. Every transform is idempotent:
// it checks whether its edit is already present and logs a skip instead of
// duplicating it.
//
// Mirrors PR #3378 ("add org card DAMTC") — the org-card / physical-card flow.

import { cfg } from './config';
import { FILES } from './project-root';
import { logChange, logSkip, warnings, assetWillExist } from './report';
import {
  load,
  ensureNamedImport,
  ensureRequireConst,
  ensureNamedExport,
  ensureEnumMember,
  ensureObjectProperty,
  insertStatementAfter,
  getObjectLiteral,
} from './ast-utils';

export function txSchemeConstants(): void {
  const sf = load(FILES.schemeConstants);
  const added = ensureEnumMember(
    sf,
    'CARD_PRODUCT_SCHEME',
    cfg.schemeKey,
    cfg.schemeValue,
  );
  if (added) logChange(FILES.schemeConstants, `add CARD_PRODUCT_SCHEME.${cfg.schemeKey}`);
  else logSkip(FILES.schemeConstants, `enum member ${cfg.schemeKey} already present`);
}

export function txCardConstants(): void {
  const sf = load(FILES.cardConstants);
  const added = ensureEnumMember(
    sf,
    'CARD_TEMPLATE',
    cfg.templateKey,
    cfg.templateValue,
  );
  if (added) logChange(FILES.cardConstants, `add CARD_TEMPLATE.${cfg.templateKey}`);
  else logSkip(FILES.cardConstants, `enum member ${cfg.templateKey} already present`);
}

export function txLayoutAsset(): void {
  const sf = load(FILES.layoutAssets);
  const a = ensureRequireConst(sf, cfg.layoutAsset, `./${cfg.layoutAsset}.webp`);
  const b = ensureNamedExport(sf, cfg.layoutAsset);
  if (a || b) logChange(FILES.layoutAssets, `register asset ${cfg.layoutAsset}`);
  else logSkip(FILES.layoutAssets, `${cfg.layoutAsset} already registered`);
  const rel = `assets/new-images/card/${cfg.layoutAsset}.webp`;
  if (!assetWillExist(rel)) warnings.push(`Missing asset file: ${rel}`);
}

export function txBannerAssets(): void {
  const sf = load(FILES.bannerAssets);
  for (const asset of [cfg.bannerEnAsset, cfg.bannerViAsset]) {
    const a = ensureRequireConst(sf, asset, `./${asset}.webp`);
    const b = ensureNamedExport(sf, asset);
    if (a || b) logChange(FILES.bannerAssets, `register asset ${asset}`);
    else logSkip(FILES.bannerAssets, `${asset} already registered`);
    const rel = `src/modules/cards/assets/banner-card-list/${asset}.webp`;
    if (!assetWillExist(rel)) warnings.push(`Missing asset file: ${rel}`);
  }
}

export function txOrgCardAssets(): void {
  const sf = load(FILES.orgCardAssets);
  for (const asset of [cfg.headerAsset, cfg.bgAsset, cfg.frontAsset]) {
    const a = ensureRequireConst(sf, asset, `./${asset}.webp`);
    const b = ensureNamedExport(sf, asset);
    if (a || b) logChange(FILES.orgCardAssets, `register asset ${asset}`);
    else logSkip(FILES.orgCardAssets, `${asset} already registered`);
    const rel = `src/modules/cards/assets/org-card/${asset}.webp`;
    if (!assetWillExist(rel)) warnings.push(`Missing asset file: ${rel}`);
  }
}

export function txOrgCard(): void {
  const sf = load(FILES.orgCard);
  ensureNamedImport(sf, '@src/modules/card-onboard/constants', 'CARD_PRODUCT_SCHEME');
  ensureNamedImport(sf, '../../assets/org-card', cfg.headerAsset);
  ensureNamedImport(sf, '../../assets/org-card', cfg.bgAsset);

  const propName = `[CARD_PRODUCT_SCHEME.${cfg.schemeKey}]`;

  const bgSource = getObjectLiteral(sf, 'BG_SOURCE');
  if (ensureObjectProperty(bgSource, propName, cfg.bgAsset)) {
    logChange(FILES.orgCard, `BG_SOURCE[${cfg.schemeKey}]`);
  } else {
    logSkip(FILES.orgCard, `BG_SOURCE entry for ${cfg.schemeKey} exists`);
  }

  const headerSource = getObjectLiteral(sf, 'LOGO_HEADER_SOURCE');
  if (ensureObjectProperty(headerSource, propName, cfg.headerAsset)) {
    logChange(FILES.orgCard, `LOGO_HEADER_SOURCE[${cfg.schemeKey}]`);
  } else {
    logSkip(FILES.orgCard, `LOGO_HEADER_SOURCE entry for ${cfg.schemeKey} exists`);
  }
}

export function txOrgName(): void {
  const sf = load(FILES.orgName);
  ensureNamedImport(sf, '@src/modules/card-onboard/constants', 'CARD_PRODUCT_SCHEME');

  const propName = `[CARD_PRODUCT_SCHEME.${cfg.schemeKey}]`;
  const initializer = `{\n  color: ${cfg.textColor},\n}`;

  for (const styleVar of ['nameStyles', 'idStyles', 'jobTitleStyles']) {
    const obj = getObjectLiteral(sf, styleVar);
    if (ensureObjectProperty(obj, propName, initializer)) {
      logChange(FILES.orgName, `${styleVar}[${cfg.schemeKey}]`);
    } else {
      logSkip(FILES.orgName, `${styleVar} entry for ${cfg.schemeKey} exists`);
    }
  }
}

export function txDualCardLayout(): void {
  const sf = load(FILES.dualCardLayout);
  ensureNamedImport(sf, '@assets/new-images', cfg.layoutAsset);
  ensureNamedImport(sf, '@src/modules/card-onboard/constants', 'CARD_PRODUCT_SCHEME');

  const propName = `[CARD_PRODUCT_SCHEME.${cfg.schemeKey}]`;
  const source = getObjectLiteral(sf, 'CARD_LAYOUT_SOURCE');
  if (ensureObjectProperty(source, propName, cfg.layoutAsset)) {
    logChange(FILES.dualCardLayout, `CARD_LAYOUT_SOURCE[${cfg.schemeKey}]`);
  } else {
    logSkip(FILES.dualCardLayout, `CARD_LAYOUT_SOURCE entry for ${cfg.schemeKey} exists`);
  }
}

export function txCardBannerItem(): void {
  const sf = load(FILES.cardBannerItem);
  ensureNamedImport(sf, '@src/modules/card-onboard/constants', 'CARD_PRODUCT_SCHEME');
  ensureNamedImport(sf, '../../assets/banner-card-list', cfg.bannerEnAsset);
  ensureNamedImport(sf, '../../assets/banner-card-list', cfg.bannerViAsset);

  const propName = `[CARD_PRODUCT_SCHEME.${cfg.schemeKey}]`;
  const initializer = `{\n  en: ${cfg.bannerEnAsset},\n  vi: ${cfg.bannerViAsset},\n}`;
  const source = getObjectLiteral(sf, 'BANNER_SRC');
  if (ensureObjectProperty(source, propName, initializer)) {
    logChange(FILES.cardBannerItem, `BANNER_SRC[${cfg.schemeKey}]`);
  } else {
    logSkip(FILES.cardBannerItem, `BANNER_SRC entry for ${cfg.schemeKey} exists`);
  }
}

export function txCardActivation(): void {
  const sf = load(FILES.cardActivation);
  ensureNamedImport(sf, '../card.constants', 'CARD_TEMPLATE');
  ensureNamedImport(sf, '../assets/org-card', cfg.frontAsset);

  const propName = `[CARD_TEMPLATE.${cfg.templateKey}]`;
  const initializer = `{\n  front: ${cfg.frontAsset},\n  back: DualCardBack,\n}`;
  const source = getObjectLiteral(sf, 'IMAGE_SOURCE');
  if (ensureObjectProperty(source, propName, initializer)) {
    logChange(FILES.cardActivation, `IMAGE_SOURCE[${cfg.templateKey}]`);
  } else {
    logSkip(FILES.cardActivation, `IMAGE_SOURCE entry for ${cfg.templateKey} exists`);
  }
}

export function txPhysicalCardIntro(): void {
  const sf = load(FILES.physicalCardIntro);
  ensureNamedImport(sf, '@src/modules/cards/card.constants', 'CARD_TEMPLATE');
  ensureNamedImport(sf, '@src/modules/cards/assets/org-card', cfg.frontAsset);

  const propName = `[CARD_TEMPLATE.${cfg.templateKey}]`;
  const source = getObjectLiteral(sf, 'IMAGE_SOURCE');
  if (ensureObjectProperty(source, propName, cfg.frontAsset)) {
    logChange(FILES.physicalCardIntro, `IMAGE_SOURCE[${cfg.templateKey}]`);
  } else {
    logSkip(FILES.physicalCardIntro, `IMAGE_SOURCE entry for ${cfg.templateKey} exists`);
  }
}

export function txTodoItem(): void {
  const sf = load(FILES.todoItem);
  const source = getObjectLiteral(sf, 'HomeTodoType');
  if (ensureObjectProperty(source, cfg.homeTodoKey, `'${cfg.homeTodoKey}'`)) {
    logChange(FILES.todoItem, `HomeTodoType.${cfg.homeTodoKey}`);
  } else {
    logSkip(FILES.todoItem, `HomeTodoType.${cfg.homeTodoKey} already present`);
  }
}

export function txUseHomeTodo(): void {
  const sf = load(FILES.useHomeTodo);
  if (sf.getFullText().includes(`HomeTodoType.${cfg.homeTodoKey}]`)) {
    logSkip(FILES.useHomeTodo, `todos[HomeTodoType.${cfg.homeTodoKey}] assignment exists`);
    return;
  }
  const stmt =
    `todos[HomeTodoType.${cfg.homeTodoKey}] =\n` +
    `  findVikkiOneConnectBanner(\n` +
    `    todos[HomeTodoType.${cfg.homeTodoKey}],\n` +
    `    [CARD_PRODUCT_SCHEME.${cfg.schemeKey}],\n` +
    `  );\n`;
  const inserted = insertStatementAfter(
    sf,
    'todos[HomeTodoType.HDB_VIKKI_ONE_CONNECT_ONBOARD] =',
    stmt,
  );
  if (!inserted)
    throw new Error(
      'useHomeTodo: anchor statement "todos[HomeTodoType.HDB_VIKKI_ONE_CONNECT_ONBOARD] = ..." not found',
    );
  logChange(FILES.useHomeTodo, `todos[HomeTodoType.${cfg.homeTodoKey}] assignment`);
}

/** Order matters: constants/assets are registered before the files that reference them. */
export const TRANSFORMS: Array<() => void> = [
  txSchemeConstants,
  txCardConstants,
  txLayoutAsset,
  txBannerAssets,
  txOrgCardAssets,
  txOrgCard,
  txOrgName,
  txDualCardLayout,
  txCardBannerItem,
  txCardActivation,
  txPhysicalCardIntro,
  txTodoItem,
  txUseHomeTodo,
];
