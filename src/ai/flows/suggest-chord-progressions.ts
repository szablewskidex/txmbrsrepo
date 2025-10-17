
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
      throw new Error("Failed to get chord suggestions from AI.");
    }
    return output;
  }
);

export async function suggestChordProgressions(input: SuggestChordProgressionsInput): Promise<SuggestChordProgressionsOutput> {
  return suggestChordProgressionsFlow(input);
}
