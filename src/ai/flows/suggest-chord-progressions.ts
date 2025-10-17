
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


const prompt = ai.definePrompt({
  name: 'suggestChordProgressionsPrompt',
  input: {schema: SuggestChordProgressionsInputSchema},
  output: {schema: SuggestChordProgressionsOutputSchema},
  prompt: `You are a music theory expert. Suggest 3 common, compelling chord progressions for the key of {{{key}}}. The progressions should be suitable for dark, trap, or pop music. Return the result as a JSON object with a "chordProgressions" key containing an array of strings.

For example, for the key of 'A minor', you might suggest:

["Am-G-C-F", "Am-F-C-G", "Am-E-F-C"]`,
});

const suggestChordProgressionsFlow = ai.defineFlow(
  {
    name: 'suggestChordProgressionsFlow',
    inputSchema: SuggestChordProgressionsInputSchema,
    outputSchema: SuggestChordProgressionsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);

export async function suggestChordProgressions(input: SuggestChordProgressionsInput): Promise<SuggestChordProgressionsOutput> {
  return suggestChordProgressionsFlow(input);
}
