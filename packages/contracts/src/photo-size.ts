// Native image limits of the model tier claude-sonnet-5 belongs to
// (Anthropic vision docs: "Claude 4.7 and later models", high-resolution
// tier). Beyond them the API downscales the photo itself: extra upload
// size and latency for no gain. To be confirmed by the first
// `pnpm fixtures:record` (docs/modules/ingestion.md). Changing
// ANTHROPIC_MODEL to another tier makes these values wrong without
// breaking anything visibly: the API would simply downscale.
export const PHOTO_MAX_EDGE_PX = 2576;
export const PHOTO_MAX_VISUAL_TOKENS = 4784;

// One visual token per 28x28 patch (same docs).
const PATCH_PX = 28;

export interface PhotoLimits {
  maxEdge: number;
  maxVisualTokens: number;
}

export interface PhotoSize {
  width: number;
  height: number;
}

const NATIVE_LIMITS: PhotoLimits = { maxEdge: PHOTO_MAX_EDGE_PX, maxVisualTokens: PHOTO_MAX_VISUAL_TOKENS };

// Matches Python's round(): the API resolves exact .5 ties toward the even
// neighbour, so Math.round would disagree on some sizes.
function roundTiesToEven(value: number): number {
  const floor = Math.floor(value);
  if (value - floor !== 0.5) return Math.round(value);
  return floor % 2 === 0 ? floor : floor + 1;
}

function fits(w: number, h: number, limits: PhotoLimits): boolean {
  const patchesW = Math.ceil(w / PATCH_PX);
  const patchesH = Math.ceil(h / PATCH_PX);
  return patchesW * PATCH_PX <= limits.maxEdge && patchesH * PATCH_PX <= limits.maxEdge && patchesW * patchesH <= limits.maxVisualTokens;
}

// Port of Anthropic's reference resize implementation: the largest
// aspect-preserving size the model sees without downscaling. The browser
// re-encodes every photo to this size before upload. For photos, the
// visual-token budget binds long before the edge limit does.
export function nativePhotoSize(width: number, height: number, limits: PhotoLimits = NATIVE_LIMITS): PhotoSize {
  if (fits(width, height, limits)) return { width, height };
  if (height > width) {
    const swapped = nativePhotoSize(height, width, limits);
    return { width: swapped.height, height: swapped.width };
  }

  const aspectRatio = width / height;
  const shortEdge = (longEdge: number) => Math.max(roundTiesToEven(longEdge / aspectRatio), 1);
  let lo = 1; // always fits
  let hi = width; // never fits
  while (lo + 1 < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (fits(mid, shortEdge(mid), limits)) lo = mid;
    else hi = mid;
  }
  return { width: lo, height: shortEdge(lo) };
}
