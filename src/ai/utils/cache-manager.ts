import { createHash } from 'crypto';
import type { GenerateMelodyInput, GenerateFullCompositionOutput } from '@/lib/schemas';
import type { Layer } from './prompt-detection';

const MELODY_CACHE_TTL = 1000 * 60 * 30; // 30 minutes

export const melodyCache = new Map<string, { data: GenerateFullCompositionOutput; timestamp: number }>();
export const pendingMelodyRequests = new Map<string, Promise<GenerateFullCompositionOutput>>();

function hashPayload(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export function buildCacheKey(input: GenerateMelodyInput & { totalBeats?: number; layers?: Layer[] }): string {
  const normalizedPrompt = input.prompt.trim().replace(/\s+/g, ' ');
  const normalizedChordProgression = input.chordProgression?.trim() ?? null;
  const normalizedExample = input.exampleMelody
    ? input.exampleMelody.map(note => ({
        note: note.note,
        start: Number(note.start.toFixed(3)),
        duration: Number(note.duration.toFixed(3)),
        velocity: note.velocity,
        slide: !!note.slide,
      }))
    : null;

  const normalizedLayers =
    Array.isArray(input.layers) && input.layers.length > 0
      ? [...input.layers].sort()
      : ['melody', 'chords', 'bassline'];

  const normalizedTempo =
    typeof input.tempo === 'number' ? Math.max(20, Math.min(400, Math.round(input.tempo))) : null;

  return hashPayload({
    prompt: normalizedPrompt,
    chordProgression: normalizedChordProgression,
    example: normalizedExample,
    measures: input.measures ?? 8,
    layers: normalizedLayers,
    gridResolution: input.gridResolution ?? 0.25,
    tempo: normalizedTempo,
  });
}

export function getCachedMelody(
  cacheKey: string,
  totalBeats: number
): GenerateFullCompositionOutput | null {
  const cached = melodyCache.get(cacheKey);
  const now = Date.now();

  if (!cached || now - cached.timestamp >= MELODY_CACHE_TTL) {
    console.log(`[CACHE] Cache miss for key: ${cacheKey.substring(0, 16)}...`);
    return null;
  }

  // Validate composition fits within beats
  if (!compositionFitsWithinBeats(cached.data, totalBeats)) {
    console.log('[CACHE] Cache hit rejected due to measure mismatch');
    melodyCache.delete(cacheKey);
    return null;
  }

  console.log(`[CACHE] ✓ Cache HIT! Returning cached composition (age: ${Math.round((now - cached.timestamp) / 1000)}s)`);
  console.log(`[CACHE] Cached melody notes: ${cached.data.melody.length}, chords: ${cached.data.chords.length}, bassline: ${cached.data.bassline.length}`);
  return cached.data;
}

export function setCachedMelody(cacheKey: string, data: GenerateFullCompositionOutput): void {
  melodyCache.set(cacheKey, { data, timestamp: Date.now() });
  console.log('[MELODY_GEN] Result cached successfully');
}

export function compositionFitsWithinBeats(output: GenerateFullCompositionOutput, totalBeats: number): boolean {
  const limit = totalBeats + 0.01; // Mała tolerancja dla błędów zaokrągleń
  const tracks = [output.melody, output.chords, output.bassline];
  
  // Sprawdź każdą nutę
  for (const track of tracks) {
    for (const note of track) {
      const noteEnd = note.start + note.duration;
      if (noteEnd > limit) {
        console.warn(`[CACHE] Note exceeds beat limit: start=${note.start}, duration=${note.duration}, end=${noteEnd}, limit=${limit}`);
        return false;
      }
    }
  }
  
  return true;
}

// Nowa funkcja: Przytnij nuty które przekraczają limit
export function trimCompositionToBeats(output: GenerateFullCompositionOutput, totalBeats: number): GenerateFullCompositionOutput {
  const limit = totalBeats;
  
  const trimTrack = (track: typeof output.melody) => {
    return track
      .filter(note => note.start < limit) // Usuń nuty zaczynające się poza limitem
      .map(note => {
        const noteEnd = note.start + note.duration;
        if (noteEnd > limit) {
          // Przytnij nutę do limitu
          return {
            ...note,
            duration: Math.max(0.25, limit - note.start), // Minimum 0.25 beat
          };
        }
        return note;
      })
      .filter(note => note.duration > 0);
  };
  
  return {
    melody: trimTrack(output.melody),
    chords: trimTrack(output.chords),
    bassline: trimTrack(output.bassline),
    tempo: output.tempo,
  };
}
