
'use server';
/**
 * @fileOverview Chord progression suggestion flow.
 *
 * - suggestChordProgressions - A function that suggests chord progressions for a given key.
 */

import {ai} from '@/ai/genkit';
import {
  SuggestChordProgressionsInputSchema,
  SuggestChordProgressionsOutputSchema,
  type SuggestChordProgressionsInput,
  type SuggestChordProgressionsOutput,
} from '@/lib/schemas';
import { findLocalChordProgressions } from '@/data/chord-progressions';

const CACHE_TTL = 1000 * 60 * 60; // 1 hour
const chordProgressionCache = new Map<string, {
  data: string[],
  timestamp: number,
}>();

const DARK_BANNED_CHORD_PATTERNS = [/maj7/i, /maj9/i, /maj13/i, /maj11/i, /maj6/i];
const DARKNESS_THRESHOLD = 0.6;


const suggestChordProgressionsPrompt = ai.definePrompt({
  name: 'suggestChordProgressionsPrompt',
  input: {schema: SuggestChordProgressionsInputSchema},
  output: {schema: SuggestChordProgressionsOutputSchema},
  prompt: `Music theory expert. Suggest 10 chord progressions for {{{key}}}.

{{#if prompt}}Style: {{{prompt}}}
- trap/hip-hop → 2-4 simple chords
- dark/minor → use m, dim, 7th chords
- minimal → repetitive (e.g., "Cm-Cm-Cm-Cm")
- complex/jazz → extended harmonies
{{else}}
Mix: 3 simple, 4 intermediate, 3 advanced
{{/if}}

Rules:
1. ALL in {{{key}}} - correct scale degrees
2. Minor keys → minor root chords ONLY
3. Vary length: 2-6 chords
4. Format: "Chord1-Chord2-Chord3-..."
5. First 3 = strongest/most usable

Examples (A minor):
"Am-F-E7-Am", "Am-Dm-E-Am", "Am-G-F-E", "Am-F-Dm-E7"

Return JSON: {"chordProgressions": ["...", "..."]}`,
});

const suggestChordProgressionsFlow = ai.defineFlow(
  {
    name: 'suggestChordProgressionsFlow',
    inputSchema: SuggestChordProgressionsInputSchema,
    outputSchema: SuggestChordProgressionsOutputSchema,
  },
  async input => {
    try {
      const {output} = await suggestChordProgressionsPrompt(input);
      if (!output) {
        // Return a valid empty output instead of undefined
        return { chordProgressions: [] };
      }
      return output;
    } catch (error) {
      // If the API fails (503, rate limit, etc.), return empty array
      // The caller will handle fallback to local progressions
      console.warn('[SUGGEST_CHORDS] Flow error, returning empty result:', error instanceof Error ? error.message : String(error));
      return { chordProgressions: [] };
    }
  }
);

function isMinorKey(key: string): boolean {
  return key.toLowerCase().includes('minor');
}

function normalizeMinorRoot(key: string): string {
  const parts = key.trim().split(/\s+/);
  if (!parts.length) {
    return '';
  }
  const root = parts[0].toLowerCase();
  if (root.endsWith('m')) {
    return root;
  }
  return `${root}m`;
}

function isDarkChord(chord: string, minorRoot?: string): boolean {
  const lower = chord.toLowerCase().trim();
  if (!lower) {
    return false;
  }

  if (DARK_BANNED_CHORD_PATTERNS.some(pattern => pattern.test(lower))) {
    return false;
  }

  if (/(^|[^a-z])m(?!aj)/.test(lower)) {
    return true;
  }

  if (lower.includes('dim') || lower.includes('ø') || lower.includes('m7b5')) {
    return true;
  }

  if (lower.endsWith('7') && !lower.includes('maj')) {
    return true;
  }

  if (lower.includes('#') || lower.includes('b')) {
    return true;
  }

  if (minorRoot && lower.startsWith(minorRoot)) {
    return true;
  }

  return false;
}

function computeDarknessRatio(progression: string, key: string): number {
  const chords = progression
    .split('-')
    .map(chord => chord.trim())
    .filter(Boolean);

  if (!chords.length) {
    return 0;
  }

  const minorRoot = normalizeMinorRoot(key);
  const darkCount = chords.filter(chord => isDarkChord(chord, minorRoot)).length;

  return darkCount / chords.length;
}

function filterProgressionsByKey(progressions: string[], key: string): string[] {
  if (!isMinorKey(key)) {
    return progressions;
  }

  const filtered = progressions.filter(prog => {
    const lower = prog.toLowerCase();
    if (DARK_BANNED_CHORD_PATTERNS.some(pattern => pattern.test(lower))) {
      return false;
    }

    const chords = prog
      .split('-')
      .map(chord => chord.trim())
      .filter(Boolean);

    if (!chords.length) {
      return false;
    }

    if (chords.length > 5) {
      return false;
    }

    const ratio = computeDarknessRatio(prog, key);
    return ratio >= DARKNESS_THRESHOLD;
  });

  if (filtered.length > 0) {
    return filtered;
  }

  const withoutMajExtensions = progressions.filter(prog => !DARK_BANNED_CHORD_PATTERNS.some(pattern => pattern.test(prog.toLowerCase())));
  return withoutMajExtensions.length > 0 ? withoutMajExtensions : progressions;
}

async function getCachedChordProgressions(key: string, prompt?: string): Promise<string[]> {
  const normalizedKey = key.trim();
  const normalizedPrompt = prompt?.trim() ?? '';
  const promptForCacheKey = normalizedPrompt.toLowerCase();
  const cacheKey = `v2|${normalizedKey}|${promptForCacheKey}`;
  const cached = chordProgressionCache.get(cacheKey);
  const now = Date.now();

  if (cached && (now - cached.timestamp) < CACHE_TTL) {
    console.log(`[SUGGEST_CHORDS] Cache hit for key: ${normalizedKey}`);
    return cached.data;
  }

  // NOWE: Jeśli nie ma promptu, użyj lokalnych progresji od razu (szybciej!)
  const hasPrompt = promptForCacheKey.length > 0;
  if (!hasPrompt) {
    const localFallback = findLocalChordProgressions(normalizedKey);
    if (localFallback && localFallback.length > 0) {
      const filtered = filterProgressionsByKey(localFallback, normalizedKey);
      console.log(`[SUGGEST_CHORDS] Using ${filtered.length} local progressions (no prompt, skipping AI)`);
      chordProgressionCache.set(cacheKey, { data: filtered, timestamp: now });
      return filtered;
    }
  }

  const isMinor = isMinorKey(normalizedKey);
  console.log(`[SUGGEST_CHORDS] Fetching AI suggestions for key: ${normalizedKey}${normalizedPrompt ? ` (prompt: ${normalizedPrompt.slice(0, 40)}...)` : ''} [isMinor: ${isMinor}]`);
  
  try {
    // NOWE: Timeout po 10 sekundach
    const timeoutPromise = new Promise<SuggestChordProgressionsOutput>((_, reject) => 
      setTimeout(() => reject(new Error('AI request timeout after 10s')), 10000)
    );
    
    const aiPromise = suggestChordProgressionsFlow({ key: normalizedKey, prompt: hasPrompt ? normalizedPrompt : undefined });
    
    const suggestions = await Promise.race([aiPromise, timeoutPromise]);

    // Robust check to prevent crash
    if (suggestions && suggestions.chordProgressions && suggestions.chordProgressions.length > 0) {
      const filtered = filterProgressionsByKey(suggestions.chordProgressions, normalizedKey);

      console.log(`[SUGGEST_CHORDS] AI returned ${suggestions.chordProgressions.length} progressions, ${filtered.length} after filtering for ${normalizedKey}`);

      if (filtered.length > 0) {
        chordProgressionCache.set(cacheKey, {
          data: filtered,
          timestamp: now,
        });
        return filtered;
      }

      console.warn(`[SUGGEST_CHORDS] All progressions filtered out, using original list`);
      chordProgressionCache.set(cacheKey, {
        data: suggestions.chordProgressions,
        timestamp: now,
      });
      return suggestions.chordProgressions;
    }

    console.warn(`[SUGGEST_CHORDS] AI returned no valid suggestions for key "${normalizedKey}". Trying local fallback.`);
    const localFallback = findLocalChordProgressions(normalizedKey);
    if (localFallback && localFallback.length > 0) {
      const filtered = filterProgressionsByKey(localFallback, normalizedKey);
      console.log(`[SUGGEST_CHORDS] Using ${filtered.length} local progressions for ${normalizedKey}`);
      chordProgressionCache.set(cacheKey, { data: filtered, timestamp: now });
      return filtered;
    }
    return [];

  } catch (error) {
      console.error(`[SUGGEST_CHORDS] Error fetching suggestions for key "${normalizedKey}":`, error);
      const localFallback = findLocalChordProgressions(normalizedKey);
      if (localFallback && localFallback.length > 0) {
        const filtered = filterProgressionsByKey(localFallback, normalizedKey);
        console.log(`[SUGGEST_CHORDS] Using ${filtered.length} local progressions as error fallback`);
        chordProgressionCache.set(cacheKey, { data: filtered, timestamp: now });
        return filtered;
      }
      return [];
  }
}


export async function suggestChordProgressions(input: SuggestChordProgressionsInput): Promise<SuggestChordProgressionsOutput> {
  const progressions = await getCachedChordProgressions(input.key, input.prompt);
  return { chordProgressions: progressions };
}
