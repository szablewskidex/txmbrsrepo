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
  prompt: `You are a melody composer specializing in minor key, dark, and trap melodies. Generate a melody that fits this style based on the following prompt. Return a JSON array of melody note objects.

Prompt: {{{prompt}}}

{{#if exampleMelodyJSON}}
Use the following melody as a strong inspiration for the style, rhythm, and note choices. The generated melody should feel like a continuation or variation of this example.

Example Melody:
{{{exampleMelodyJSON}}}
{{/if}}

Each note object should have the following properties:
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
    const promptInput: z.infer<typeof InternalPromptInputSchema> = {
      prompt,
      exampleMelodyJSON: exampleMelody ? JSON.stringify(exampleMelody, null, 2) : undefined,
    };

    const {output} = await generateMelodyPrompt(promptInput);
    
    // Validate duration
    const validatedOutput = output?.filter(note => note.duration <= 16) ?? [];
    return validatedOutput;
  }
);
