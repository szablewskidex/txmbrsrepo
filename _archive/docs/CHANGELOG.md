# Changelog

## 2025-10-20
- Added few-shot handling that reuses chord progressions from matching training examples in `src/ai/flows/generate-melody-from-prompt.ts`.
- Extended few-shot selection to include keyword filtering and unlimited example support.
- Introduced `resetFewShotCache()` async export for cache invalidation when dataset changes.
- Optimized post-generation validation via `safeValidateLayer()` to skip empty layers.
- Updated `src/components/piano-roll/PianoRoll.tsx` to stop playback before triggering a new generation.
- Ensured melody generation cancels only when the page is closed or reloaded in `src/app/page.tsx`.
