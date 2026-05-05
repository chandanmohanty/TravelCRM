/**
 * Matches the backend `BrandSource` enum exactly — tells the UI which tier of
 * the fallback chain supplied the brand currently in effect.
 */
export enum BrandSource {
  Hardcoded = 0,
  Platform  = 1,
  Tenant    = 2,
}

/**
 * Matches `BrandResolvedDto` on the server. All URL fields may be `null`,
 * meaning "fall back to the bundled SVG / favicon.ico".
 */
export interface BrandResolved {
  displayName:     string;
  logoLightUrl:    string | null;
  logoDarkUrl:     string | null;
  faviconUrl:      string | null;
  primaryColorHex: string;
  supportEmail:    string | null;
  supportUrl:      string | null;
  source:          BrandSource;
}

/** Matches `BrandSettingsDto` on the server — raw record for the settings form. */
export interface BrandSettings {
  id:              string;
  tenantId:        string | null;
  displayName:     string | null;
  logoLightUrl:    string | null;
  logoDarkUrl:     string | null;
  faviconUrl:      string | null;
  primaryColorHex: string | null;
  supportEmail:    string | null;
  supportUrl:      string | null;
  createdAt:       string;
  updatedAt:       string | null;
}

/** Matches `UpdateBrandSettingsRequest` on the server. */
export interface UpdateBrandSettingsRequest {
  displayName:     string | null;
  primaryColorHex: string | null;
  supportEmail:    string | null;
  supportUrl:      string | null;
}

/** Matches `BrandAssetKind` enum on the server. */
export type BrandAssetKind = 'LogoLight' | 'LogoDark' | 'Favicon';

/** Matches `BrandAssetUploadResponse`. */
export interface BrandAssetUploadResponse {
  assetKind: number;
  url:       string;
}

/** Hardcoded built-in fallbacks used when the API is unreachable at bootstrap. */
export const BRAND_BUILTIN_FALLBACK: BrandResolved = {
  displayName:     'TravelCRM',
  logoLightUrl:    null,
  logoDarkUrl:     null,
  faviconUrl:      null,
  primaryColorHex: '#5D87FF',
  supportEmail:    null,
  supportUrl:      null,
  source:          BrandSource.Hardcoded,
};
