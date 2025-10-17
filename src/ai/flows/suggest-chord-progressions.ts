
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
    type SuggestChordProgressionsOutput 
} from '@/lib/schemas';

const CACHE_TTL = 1000 * 60 * 60; // 1 hour
const chordProgressionCache = new Map<string, { 
  data: string[], 
  timestamp: number 
}>();


const suggestChordProgressionsPrompt = ai.definePrompt({
  name: 'suggestChordProgressionsPrompt',
  input: {schema: SuggestChordProgressionsInputSchema},
  output: {schema: SuggestChordProgressionsOutputSchema},
  prompt: `You are a music theory expert specializing in modern trap and hip-hop. Suggest 3 compelling chord progressions for the key of {{{key}}}. 

The first progression should be the most common and effective. The next two can be more creative.

Here are some examples of the desired style for 'A minor':
- "Am-G-C-F" (a classic 1-b7-b3-b6)
- "Am-F-C-G" (a variation of the above)
- "Am-Dm-E-Am" (a more dramatic, classical feel)

Return the result as a JSON object with a "chordProgressions" key containing an array of strings. The most conventional and strong progression should be first in the array.`,
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

async function getCachedChordProgressions(key: string): Promise<string[]> {
  const cached = chordProgressionCache.get(key);
  const now = Date.now();

  if (cached && (now - cached.timestamp) < CACHE_TTL) {
    console.log(`Cache hit for key: ${key}.`);
    return cached.data;
  }
  
  console.log(`Cache miss for key: ${key}. Fetching from AI...`);
  try {
    const suggestions = await suggestChordProgressionsFlow({ key });
    
    // Robust check to prevent crash
    if (suggestions && suggestions.chordProgressions && suggestions.chordProgressions.length > 0) {
      chordProgressionCache.set(key, { 
        data: suggestions.chordProgressions, 
        timestamp: now 
      });
      return suggestions.chordProgressions;
    }
    
    // If AI returns no suggestions, or an invalid format, return empty and don't cache
    console.warn(`[SUGGEST_CHORDS] AI returned no valid suggestions for key "${key}".`);
    return [];

  } catch (error) {
      console.error(`[SUGGEST_CHORDS] Error fetching suggestions for key "${key}":`, error);
      // In case of any error, return an empty array to prevent crashing the main flow
      return [];
  }
}


export async function suggestChordProgressions(input: SuggestChordProgressionsInput): Promise<SuggestChordProgressionsOutput> {
  const progressions = await getCachedChordProgressions(input.key);
  return { chordProgressions: progressions };
}
