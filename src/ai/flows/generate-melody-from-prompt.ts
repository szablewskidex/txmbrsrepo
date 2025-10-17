
// src/ai/flows/generate-melody-from-prompt.ts
'use server';
/**
 * @fileOverview AI melody generation flow.
 *
 * - generateMelodyFromPrompt - A function that generates a melody based on a text prompt.
 * - GenerateMelodyInput - The input type for the generateMelodyFromPrompt function.
 * - GenerateMelodyOutput - The return type for the generateMelodyFromPrompt function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { suggestChordProgressions } from './suggest-chord-progressions';

const MelodyNoteSchema = z.object({
  note: z.string().describe('The note name (e.g., C4).'),
  start: z.number().describe('The start time of the note in beats.'),
  duration: z.number().describe('The duration of the note in beats. Maximum value is 16.'),
  velocity: z.number().describe('The velocity of the note (0-127).'),
  slide: z.boolean().describe('Whether the note has a slide/portamento effect.'),
});

const GenerateMelodyInputSchema = z.object({
  prompt: z.string().describe('A prompt describing the desired melody, including key, tempo, and length (e.g., \'A-minor, tempo 120, 8 bars\').'),
  exampleMelody: z.array(MelodyNoteSchema).optional().describe('An optional example melody to guide the generation.'),
});
export type GenerateMelodyInput = z.infer<typeof GenerateMelodyInputSchema>;

const InternalPromptInputSchema = z.object({
  prompt: z.string(),
  chordProgression: z.string(),
  exampleMelodyJSON: z.string().optional(),
});


const GenerateMelodyOutputSchema = z.array(MelodyNoteSchema);
export type GenerateMelodyOutput = z.infer<typeof GenerateMelodyOutputSchema>;

export async function generateMelodyFromPrompt(input: GenerateMelodyInput): Promise<GenerateMelodyOutput> {
  return generateMelodyFromPromptFlow(input);
}

const generateMelodyPrompt = ai.definePrompt({
  name: 'generateMelodyPrompt',
  input: {schema: InternalPromptInputSchema},
  output: {schema: GenerateMelodyOutputSchema},
  prompt: `You are an expert music composer and theorist specializing in minor key, dark, and trap melodies. Your task is to generate a musically coherent melody based on a prompt and a given chord progression.

The melody must adhere to the principles of music theory. The notes you choose should complement the underlying harmony of the chord progression.

Chord Progression: {{{chordProgression}}}
Prompt: {{{prompt}}}

{{#if exampleMelodyJSON}}
Use the following melody as inspiration for the general style, mood, and rhythmic patterns. Do not copy the example melody. Instead, create a completely new and unique melody that captures a similar feeling but is harmonically grounded in the provided chord progression.
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
  async ({ prompt, exampleMelody }) => {
    // 1. Extract key from prompt to suggest chords.
    // A simple regex to find a key like 'A minor', 'C# major', etc.
    const keyMatch = prompt.match(/([A-G][b#]?\s+(major|minor))/i);
    const key = keyMatch ? keyMatch[0] : 'A minor'; // Default to A minor if not found

    // 2. Get chord progression suggestions.
    const chordSuggestions = await suggestChordProgressions({ key });
    // Pick the first suggestion for simplicity.
    const chordProgression = chordSuggestions.chordProgressions[0] || 'Am-G-C-F';

    // 3. Prepare the input for the main melody generation prompt.
    const promptInput: z.infer<typeof InternalPromptInputSchema> = {
      prompt,
      chordProgression,
      exampleMelodyJSON: exampleMelody ? JSON.stringify(exampleMelody, null, 2) : undefined,
    };

    // 4. Generate the melody.
    const {output} = await generateMelodyPrompt(promptInput);
    
    // 5. Validate the output.
    const validatedOutput = output?.filter(note => note.duration <= 16) ?? [];
    return validatedOutput;
  }
);
