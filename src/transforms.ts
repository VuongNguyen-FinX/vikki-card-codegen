// Per-file transforms — one function per target file, each injecting a small,
// well-anchored snippet via the TypeScript AST. Every transform is idempotent:
// it checks whether its edit is already present and logs a skip instead of
// duplicating it.

import { SyntaxKind } from 'ts-morph';
import { cfg } from './config';
import { FILES } from './project-root';
import { logChange, logSkip, warnings, assetWillExist } from './report';
import {
  load,
  ensureNamedImport,
  ensureRequireConst,
  ensureNamedExport,
  norm,
  findIf,
  getUseMemoBlock,
  getUseMemoDeps,
} from './ast-utils';

export function txConstants(): void {
  const sf = load(FILES.constants);
  const en = sf.getEnumOrThrow('CARD_PRODUCT_SCHEME');
  if (en.getMember(cfg.schemeKey)) {
    logSkip(FILES.constants, `enum member ${cfg.schemeKey} already present`);
    return;
  }
  en.addMember({ name: cfg.schemeKey, value: cfg.schemeValue });
  logChange(FILES.constants, `add CARD_PRODUCT_SCHEME.${cfg.schemeKey}`);
}

export function txGoAssets(): void {
  const sf = load(FILES.goAssets);
  for (const asset of [cfg.cardAsset, cfg.shadowAsset]) {
    const a = ensureRequireConst(sf, asset, `./${asset}.webp`);
    const b = ensureNamedExport(sf, asset);
    if (a || b) logChange(FILES.goAssets, `register asset ${asset}`);
    else logSkip(FILES.goAssets, `${asset} already registered`);
    const rel = `src/modules/vikki-go-card/assets/${asset}.webp`;
    if (!assetWillExist(rel)) warnings.push(`Missing asset file: ${rel}`);
  }
}

export function txCardImages(): void {
  const sf = load(FILES.cardImages);
  const a = ensureRequireConst(sf, cfg.layoutAsset, `./${cfg.layoutAsset}.webp`);
  const b = ensureNamedExport(sf, cfg.layoutAsset);
  if (a || b) logChange(FILES.cardImages, `register layout asset ${cfg.layoutAsset}`);
  else logSkip(FILES.cardImages, `${cfg.layoutAsset} already registered`);
  const rel = `assets/new-images/card/${cfg.layoutAsset}.webp`;
  if (!assetWillExist(rel)) warnings.push(`Missing asset file: ${rel}`);
}

export function txVikkiCard(): void {
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
    (block as any).insertStatements(
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

export function txCtaBanner(): void {
  const sf = load(FILES.ctaBanner);
  ensureNamedImport(sf, '@src/modules/card-onboard/constants', 'CARD_PRODUCT_SCHEME');
  ensureNamedImport(sf, '@src/modules/vikki-go-card/assets', cfg.cardAsset);

  const block = getUseMemoBlock(sf, 'imageSource');
  if (!block.getText().includes(cfg.schemeKey)) {
    (block as any).insertStatements(
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

export function txPrepaidLayout(): void {
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
    (thenBlock as any).insertStatements(
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

export function txTransitCvp(): void {
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
    (thenBlock as any).insertStatements(
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

export function txSaga(): void {
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
  const obj = call.getArguments()[1].asKindOrThrow(SyntaxKind.ObjectLiteralExpression);
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

export function txNavigation(): void {
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
    (cvpType as any).addProperty({
      name: 'productScheme',
      hasQuestionToken: true,
      type: 'CARD_PRODUCT_SCHEME',
    });
    logChange(FILES.navigation, 'CVP_SCREEN ParamList += productScheme');
  } else {
    logSkip(FILES.navigation, 'CVP_SCREEN ParamList already has productScheme');
  }
}

/** Order matters: constants/assets are registered before the files that reference them. */
export const TRANSFORMS: Array<() => void> = [
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
