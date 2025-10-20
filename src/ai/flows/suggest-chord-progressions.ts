
'use server';
/**
 * @fileOverview Chord progression suggestion flow.
 *
 * - suggestChordProgressions - A function that suggests chord progressions for a given key.
 */

import { createHash } from 'crypto';

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


const suggestChordProgressionsPrompt = ai.definePrompt({
  name: 'suggestChordProgressionsPrompt',
  input: {schema: SuggestChordProgressionsInputSchema},
  output: {schema: SuggestChordProgressionsOutputSchema},
  prompt: `You are a music theory expert specializing in modern music production across all genres.

**Task:** Suggest 10 diverse chord progressions for the key of {{{key}}}.

{{#if prompt}}
**Style Context:** {{{prompt}}}

Based on this prompt, tailor your suggestions:
- For "trap", "hip-hop", "bass" → prefer simple 2-4 chord loops (e.g., "Am-F", "C#m-G#m")
- For "dark", "ominous", "sinister" → include diminished, augmented, and 7th chords (e.g., "Am-F-E7-Am", "Dm-Bbdim-Gm-A7")
- For "minimal", "sparse" → suggest repetitive patterns (e.g., "Cm-Cm-Cm-Cm", "Em-G-Em-G")
- For "complex", "jazz", "fusion" → use extended harmonies and longer progressions (e.g., "Dm7-G7-Cmaj7-Am7-D7-Gm7-C7-Fmaj7")
- For "cinematic", "epic" → include dramatic progressions with modal interchange
- For "upbeat", "happy" → stick to major triads and suspended chords
{{else}}
**No specific style given** - provide a balanced mix of:
- 3 simple/common progressions (good for beginners)
- 4 intermediate progressions (interesting but not too complex)
- 3 advanced/creative progressions (for experienced producers)
{{/if}}

**Requirements:**
1. All progressions MUST be in {{{key}}} (use the correct scale degrees)
2. Vary the length: include both short (2-3 chords) and long (4-6 chords) progressions
3. Each progression should be unique and musically interesting
4. Format: "Chord1-Chord2-Chord3-..." (e.g., "Am-G-F-E")
5. First 3 progressions should be the strongest/most usable

**Examples for 'A minor':**
- Trap/Simple: "Am-G", "Am-F-C-G"
- Dark: "Am-F-E7-Am", "Am-Dm-Bb-E"
- Complex: "Am-Dm7-G7-Cmaj7-Fmaj7-Bm7b5-E7"
- Minimal: "Am-Am-Am-Am", "Am-Em-Am-Em"

Return exactly 10 progressions as a JSON object with "chordProgressions" array.`,
});

const suggestChordProgressionsFlow = ai.defineFlow(
  {
    name: 'suggestChordProgressionsFlow',
    inputSchema: SuggestChordProgressionsInputSchema,
    outputSchema: SuggestChordProgressionsOutputSchema,
  },
  async input => {
    const {output} = await suggestChordProgressionsPrompt(input);
    if (!output) {
      // Return a valid empty output instead of undefined
      return { chordProgressions: [] };
    }
    return output;
  }
);

async function getCachedChordProgressions(key: string, prompt?: string): Promise<string[]> {
  const normalizedKey = key.trim();
  const normalizedPrompt = prompt?.trim() ?? '';
  const promptForCacheKey = normalizedPrompt.toLowerCase();
  const cacheKey = `${normalizedKey}|${promptForCacheKey}`;
  const cached = chordProgressionCache.get(cacheKey);
  const now = Date.now();

  if (cached && (now - cached.timestamp) < CACHE_TTL) {
    console.log(`Cache hit for key: ${normalizedKey} (prompt hash: ${promptForCacheKey ? createHash('sha1').update(promptForCacheKey).digest('hex').slice(0, 8) : 'none'}).`);
    return cached.data;
  }

  const hasPrompt = promptForCacheKey.length > 0;

  console.log(`[SUGGEST_CHORDS] Fetching AI suggestions for key: ${normalizedKey}${normalizedPrompt ? ` (prompt: ${normalizedPrompt.slice(0, 40)}${normalizedPrompt.length > 40 ? '…' : ''})` : ''}`);
  try {
    const suggestions = await suggestChordProgressionsFlow({ key: normalizedKey, prompt: hasPrompt ? normalizedPrompt : undefined });

    // Robust check to prevent crash
    if (suggestions && suggestions.chordProgressions && suggestions.chordProgressions.length > 0) {
      chordProgressionCache.set(cacheKey, {
        data: suggestions.chordProgressions, 
        timestamp: now 
      });
      return suggestions.chordProgressions;
    }

    console.warn(`[SUGGEST_CHORDS] AI returned no valid suggestions for key "${normalizedKey}". Trying local fallback.`);
    const localFallback = findLocalChordProgressions(normalizedKey);
    if (localFallback && localFallback.length > 0) {
      chordProgressionCache.set(cacheKey, { data: localFallback, timestamp: now });
      return localFallback;
    }
    return [];

  } catch (error) {
      console.error(`[SUGGEST_CHORDS] Error fetching suggestions for key "${normalizedKey}":`, error);
      const localFallback = findLocalChordProgressions(normalizedKey);
      if (localFallback && localFallback.length > 0) {
        console.log(`[SUGGEST_CHORDS] Using local progressions as error fallback for key "${normalizedKey}".`);
        chordProgressionCache.set(cacheKey, { data: localFallback, timestamp: now });
        return localFallback;
      }
      return [];
  }
}


export async function suggestChordProgressions(input: SuggestChordProgressionsInput): Promise<SuggestChordProgressionsOutput> {
  const progressions = await getCachedChordProgressions(input.key, input.prompt);
  return { chordProgressions: progressions };
}
