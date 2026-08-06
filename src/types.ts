export interface Cfg {
  schemeKey: string;
  schemeValue: string;
  baseProduct: string;
  cardAsset: string;
  shadowAsset: string;
  layoutAsset: string;
  cardImg: string | null;
  shadowImg: string | null;
  layoutImg: string | null;
  dryRun: boolean;
}

export interface ChangeEntry {
  file: string;
  action: string;
}

export interface SkipEntry {
  file: string;
  reason: string;
}

export interface CopiedEntry {
  dest: string;
  from: string;
}
