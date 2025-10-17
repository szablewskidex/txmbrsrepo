'use server';
/**
 * @fileOverview Chord progression suggestion flow.
 *
 * - suggestChordProgressions - A function that suggests chord progressions for a given key.
 * - SuggestChordProgressionsInput - The input type for the suggestChordProgressions function.
 * - SuggestChordProgressionsOutput - The return type for the suggestChordProgressions function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestChordProgressionsInputSchema = z.object({
  key: z.string().describe('The key to suggest chord progressions for (e.g., C major, A minor).'),
});
export type SuggestChordProgressionsInput = z.infer<typeof SuggestChordProgressionsInputSchema>;

const SuggestChordProgressionsOutputSchema = z.object({
  chordProgressions: z.array(z.string()).describe('An array of suggested chord progressions for the given key.'),
});
export type SuggestChordProgressionsOutput = z.infer<typeof SuggestChordProgressionsOutputSchema>;

export async function suggestChordProgressions(input: SuggestChordProgressionsInput): Promise<SuggestChordProgressionsOutput> {
  return suggestChordProgressionsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestChordProgressionsPrompt',
  input: {schema: SuggestChordProgressionsInputSchema},
  output: {schema: SuggestChordProgressionsOutputSchema},
  prompt: `You are a music theory expert. Suggest 3 common, compelling chord progressions for the key of {{{key}}}. The progressions should be suitable for dark, trap, or pop music. Return the result as a JSON object with a "chordProgressions" key containing an array of strings.

For example, for A minor, you might suggest:

["Am-G-C-F", "Dm-Am-E-Am", "Am-F-C-G"]`,
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
