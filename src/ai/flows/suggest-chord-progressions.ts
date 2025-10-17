
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
  prompt: `You are a music theory expert specializing in modern trap and hip-hop. For the key of {{{key}}}, suggest 3 compelling chord progressions with a dark, cool vibe.

1.  A progression based on the 1-4 scale degrees.
2.  A progression based on the 1-6-4-6 scale degrees.
3.  A progression based on the 1-sus2-4-sus2 scale degrees.

Return the result as a JSON object with a "chordProgressions" key containing an array of strings.

For example, for the key of 'A minor', you should suggest:

["Am-Dm-Am-Dm", "Am-F-Dm-F", "Asus2-Dsus2-Asus2-Dsus2"]`,
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
