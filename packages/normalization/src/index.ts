export {
  failRawAssetNormalization,
  getRawAssetNormalizationContext,
  normalizeRawAsset,
  NormalizationValidationError,
  RawAssetNotFoundError,
  type ItemNormalizationRecord,
  type NormalizeRawAssetFailureResult,
  type NormalizeRawAssetInput,
  type NormalizeRawAssetSuccessResult,
  type RawAssetNormalizationContext,
} from "./normalize-raw-asset";

export const normalizationPackage = {
  name: "@signal-inbox/normalization",
  responsibility: "RawAsset extraction and Item normalization.",
} as const;
