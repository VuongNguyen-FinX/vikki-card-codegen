// Small ts-morph helpers shared by every per-file transform: loading source
// files, idempotently adding imports/exports/require-consts, and locating the
// specific if-statements / useMemo bodies the transforms patch.

import * as fs from 'fs';
import {
  Project,
  QuoteKind,
  IndentationText,
  VariableDeclarationKind,
  SyntaxKind,
  SourceFile,
  IfStatement,
  Node,
} from 'ts-morph';
import { P } from './project-root';

export const project = new Project({
  skipAddingFilesFromTsConfig: true,
  compilerOptions: { allowJs: true },
  manipulationSettings: {
    quoteKind: QuoteKind.Single,
    indentationText: IndentationText.TwoSpaces,
    useTrailingCommas: true,
  },
});

export function load(relPath: string): SourceFile {
  const abs = P(relPath);
  if (!fs.existsSync(abs)) throw new Error(`Target file not found: ${relPath}`);
  return project.addSourceFileAtPath(abs);
}

export function ensureNamedImport(sf: SourceFile, moduleSpecifier: string, name: string): boolean {
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

export function ensureRequireConst(sf: SourceFile, name: string, requirePath: string): boolean {
  if (sf.getVariableDeclaration(name)) return false;
  const stmts = sf.getStatements();
  let exportIdx = stmts.findIndex(
    (s) =>
      s.getKind() === SyntaxKind.ExportDeclaration &&
      !(s as any).getModuleSpecifier?.(),
  );
  if (exportIdx === -1) exportIdx = stmts.length;
  sf.insertVariableStatement(exportIdx, {
    declarationKind: VariableDeclarationKind.Const,
    declarations: [{ name, initializer: `require('${requirePath}')` }],
  });
  return true;
}

export function ensureNamedExport(sf: SourceFile, name: string): boolean {
  const exp = sf.getExportDeclarations().find((d) => !d.getModuleSpecifier());
  if (!exp) throw new Error('No bare `export { ... }` found');
  if (exp.getNamedExports().some((n) => n.getName() === name)) return false;
  exp.addNamedExport(name);
  return true;
}

export const norm = (s: string): string => s.replace(/\s+/g, '');

export function findIf(sf: SourceFile, conditionText: string): IfStatement | undefined {
  const want = norm(conditionText);
  return sf
    .getDescendantsOfKind(SyntaxKind.IfStatement)
    .find((i) => norm(i.getExpression().getText()) === want);
}

export function findVarDecl(sf: SourceFile, name: string) {
  const decl = sf
    .getDescendantsOfKind(SyntaxKind.VariableDeclaration)
    .find((d) => d.getName() === name);
  if (!decl) throw new Error(`variable declaration '${name}' not found`);
  return decl;
}

export function getUseMemoBlock(sf: SourceFile, varName: string): Node {
  const decl = findVarDecl(sf, varName);
  const call = decl.getInitializerIfKindOrThrow(SyntaxKind.CallExpression);
  return call.getArguments()[0].getFirstDescendantByKindOrThrow(SyntaxKind.Block);
}

export function getUseMemoDeps(sf: SourceFile, varName: string) {
  const decl = findVarDecl(sf, varName);
  const call = decl.getInitializerIfKindOrThrow(SyntaxKind.CallExpression);
  return call
    .getArguments()[1]
    .asKindOrThrow(SyntaxKind.ArrayLiteralExpression);
}
