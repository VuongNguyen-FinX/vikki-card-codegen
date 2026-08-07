export interface Cfg {
  schemeKey: string; // CARD_PRODUCT_SCHEME member, e.g. VIKKI_ONE_CONNECT_DAMTC_EMPLOYEE
  schemeValue: string;

  templateKey: string; // CARD_TEMPLATE member, e.g. DAMTC_EMPLOYEE
  templateValue: string; // card-number prefix, e.g. VK0302391568E

  headerAsset: string; // org-card header logo
  bgAsset: string; // org-card background
  frontAsset: string; // physical-card front image
  layoutAsset: string; // dual-card layout image
  bannerEnAsset: string; // home banner (EN)
  bannerViAsset: string; // home banner (VI)

  homeTodoKey: string; // HomeTodoType member, e.g. DAMTC_VIKKI_ONE_CONNECT_ONBOARD
  textColor: string; // color expression used in VikkiOrgName styles, e.g. Colors.Labels.StrongWhite

  headerImg: string | null;
  bgImg: string | null;
  frontImg: string | null;
  layoutImg: string | null;
  bannerEnImg: string | null;
  bannerViImg: string | null;

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
