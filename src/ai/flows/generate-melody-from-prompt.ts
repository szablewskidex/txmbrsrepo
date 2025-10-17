
// src/ai/flows/generate-melody-from-prompt.ts
'use server';
/**
 * @fileOverview AI melody generation flow.
 *
 * - generateMelodyFromPrompt - A function that generates a melody based on a text prompt.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { suggestChordProgressions } from './suggest-chord-progressions';
import { 
  GenerateMelodyInputSchema, 
  GenerateMelodyOutputSchema, 
  type GenerateMelodyInput, 
  type GenerateMelodyOutput 
} from '@/lib/schemas';

const InternalPromptInputSchema = z.object({
  prompt: z.string(),
  chordProgression: z.string(),
  exampleMelodyJSON: z.string().optional(),
});


const generateMelodyPrompt = ai.definePrompt({
  name: 'generateMelodyPrompt',
  input: {schema: InternalPromptInputSchema},
  output: {schema: GenerateMelodyOutputSchema},
  prompt: `You are an expert music composer and theorist specializing in minor key, dark, and trap melodies. Your task is to generate a musically coherent and compelling melody based on a prompt and a given chord progression.

The melody MUST adhere to the principles of music theory. The notes you choose must complement the underlying harmony of the chord progression. Use passing tones, arpeggios, and scale runs to create a fluid and interesting melodic line.

Chord Progression: {{{chordProgression}}}
This is the harmonic foundation. The melody notes at any given point should sound good when played over the current chord.

Prompt: {{{prompt}}}
Use this for the overall mood, rhythm, and style.

{{#if exampleMelodyJSON}}
Use the following melody ONLY as a high-level inspiration for the general style, mood, and rhythmic density. Do NOT copy the example's specific notes, intervals, or rhythmic patterns. Create a completely new and unique melody that is harmonically grounded in the provided chord progression, but captures a similar feeling to the example.
Example Melody:
{{{exampleMelodyJSON}}}
{{/if}}

Return a JSON array of melody note objects. Each note object should have the following properties:
- note: The note name (e.g., C4).
- start: The start time of the note in beats.
- duration: The duration of the note in beats. The maximum value for duration is 16.
- velocity: The velocity of the note (0-127).
- slide: Whether the note has a slide/portamento effect (boolean).`,
});

const generateMelodyFromPromptFlow = ai.defineFlow(
  {
    name: 'generateMelodyFromPromptFlow',
    inputSchema: GenerateMelodyInputSchema,
    outputSchema: GenerateMelodyOutputSchema,
  },
  async ({ prompt, exampleMelody, chordProgression: providedChordProgression }) => {
    let chordProgression = providedChordProgression;

    // If no chord progression is provided, get one.
    if (!chordProgression) {
      const keyMatch = prompt.match(/([A-G][b#]?\s+(major|minor))/i);
      const key = keyMatch ? keyMatch[0] : 'A minor';
      const chordSuggestions = await suggestChordProgressions({ key });
      chordProgression = chordSuggestions.chordProgressions[0] || 'Am-G-C-F';
    }
    
    const promptInput: z.infer<typeof InternalPromptInputSchema> = {
      prompt,
      chordProgression,
      exampleMelodyJSON: exampleMelody ? JSON.stringify(exampleMelody, null, 2) : undefined,
    };

    const {output} = await generateMelodyPrompt(promptInput);
    
    // Validate the output to ensure duration is not too long
    const validatedOutput = output?.filter(note => note.duration <= 16) ?? [];
    
    return validatedOutput;
  }
);

export async function generateMelodyFromPrompt(input: GenerateMelodyInput): Promise<GenerateMelodyOutput> {
  return generateMelodyFromPromptFlow(input);
}
