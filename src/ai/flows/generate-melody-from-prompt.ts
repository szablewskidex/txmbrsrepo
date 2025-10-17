
// src/ai/flows/generate-melody-from-prompt.ts
'use server';
/**
 * @fileOverview AI melody generation flow.
 *
 * - generateMelodyFromPrompt - A function that generates a melody based on a text prompt.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';
import { suggestChordProgressions } from './suggest-chord-progressions';
import { 
  GenerateMelodyInputSchema,
  GenerateFullCompositionOutputSchema,
  type GenerateMelodyInput, 
  type GenerateFullCompositionOutput,
  type MelodyNote
} from '@/lib/schemas';
import { validateAndCorrectMelody, analyzeMelody } from '@/lib/melody-validator';

const InternalPromptInputSchema = z.object({
  prompt: z.string(),
  chordProgression: z.string(),
  exampleMelodyJSON: z.string().optional(),
  feedback: z.string().optional(),
});


const generateMelodyPrompt = ai.definePrompt({
  name: 'generateFullCompositionPrompt',
  input: {schema: InternalPromptInputSchema},
  output: {schema: GenerateFullCompositionOutputSchema},
  prompt: `You are an expert music composer and theorist. Your task is to generate a complete, musically coherent, and compelling polyphonic composition with three distinct layers: a bassline, chords, and a top melody.

The composition MUST adhere to the principles of music theory. The notes you choose must complement the underlying harmony of the chord progression.

**Length and Structure:**
- The composition MUST be exactly 8 bars long (beats 0 to 32). All layers (bass, chords, melody) must span this full duration.
- The melody should evolve over time. Create a sense of progression by introducing variations and repeating motifs. Avoid making it a simple 2 or 4-bar loop. Think in terms of a short A and B section if possible.

**Layers:**
1.  **Bassline**: Create a simple, rhythmic bassline using the root notes of the provided chord progression. The notes should be in a low octave (e.g., C2-C3) and have a longer duration, providing a solid foundation across the full length of the composition.
2.  **Chords**: Create a chordal accompaniment based on the progression. The chords should be played as block chords or simple arpeggios. The velocity should be lower than the melody to create depth. This layer must also span the full 8 bars.
3.  **Melody**: Create an engaging top melody that sits in a higher register (e.g., C4-C6). The melody should be creative, using passing tones, arpeggios, and scale runs to create a fluid and interesting line that works with the harmony. It should have more rhythmic variation than the other layers and span the full 8 bars.

**Harmonic and Stylistic Instructions:**
-   **Chord Progression**: {{{chordProgression}}}
    This is the harmonic foundation. All layers must align with this progression.
-   **Prompt**: {{{prompt}}}
    Use this for the overall mood, rhythm, and style (e.g., "dark trap", "emotional piano", "upbeat pop").

{{#if exampleMelodyJSON}}
**Inspiration (Optional):**
-   Use the following melody ONLY as a high-level inspiration for the style, mood, and rhythmic density of the **top melody**.
-   Do NOT copy the example's specific notes, intervals, or rhythmic patterns. Create a completely new and unique composition.
-   Example Melody: {{{exampleMelodyJSON}}}
{{/if}}

{{#if feedback}}
**Feedback on Previous Attempt:**
-   Your last attempt was analyzed and needs improvement in the following areas: {{{feedback}}}
-   Please generate a new, improved version that addresses this feedback.
{{/if}}

Return a JSON object with three keys: "bassline", "chords", and "melody". Each key should contain an array of note objects. Each note object must have:
- note: The note name (e.g., C4).
- start: The start time in beats.
- duration: The duration in beats.
- velocity: The velocity (0-127).
- slide: A boolean for portamento.`,
});

const MAX_RETRIES = 3;
const QUALITY_THRESHOLD = 70; // Minimum score to accept a melody

const generateMelodyFromPromptFlow = ai.defineFlow(
  {
    name: 'generateMelodyFromPromptFlow',
    inputSchema: GenerateMelodyInputSchema,
    outputSchema: GenerateFullCompositionOutputSchema,
  },
  async ({ prompt, exampleMelody, chordProgression: providedChordProgression }) => {
    let chordProgression = providedChordProgression;
    const keyMatch = prompt.match(/([A-G][b#]?\s+(major|minor))/i);
    const key = keyMatch ? keyMatch[0] : 'A minor';

    // If no chord progression is provided, get one.
    if (!chordProgression) {
      const chordSuggestions = await suggestChordProgressions({ key });
      if (chordSuggestions.chordProgressions.length > 0) {
        // Choose the first (best) progression instead of random
        chordProgression = chordSuggestions.chordProgressions[0];
      } else {
        // This fallback should ideally not be hit if suggestChordProgressions is reliable.
        chordProgression = 'Am-G-C-F'; 
      }
    }
    
    let lastOutput: GenerateFullCompositionOutput | null = null;
    let feedback: string | undefined = undefined;

    for (let i = 0; i < MAX_RETRIES; i++) {
        const promptInput: z.infer<typeof InternalPromptInputSchema> = {
            prompt,
            chordProgression,
            exampleMelodyJSON: exampleMelody ? JSON.stringify(exampleMelody, null, 2) : undefined,
            feedback,
        };

        const { output } = await generateMelodyPrompt(promptInput);
        if (!output) {
            continue; // Try again if AI returns nothing
        }
        
        lastOutput = output;

        const melodyAnalysis = analyzeMelody(output.melody);
        
        if (melodyAnalysis.score >= QUALITY_THRESHOLD) {
            console.log(`Generated melody passed quality check on attempt ${i + 1} with score: ${melodyAnalysis.score}`);
            break; // Melody is good enough
        }

        console.log(`Attempt ${i + 1} failed quality check with score: ${melodyAnalysis.score}. Retrying...`);
        
        // Construct feedback for the next attempt
        let feedbackParts: string[] = [];
        if (melodyAnalysis.avgInterval < 2) feedbackParts.push("The melody is too monotonic, use larger intervals.");
        if (melodyAnalysis.avgInterval > 5) feedbackParts.push("The melody is too jumpy, use smaller intervals.");
        if (melodyAnalysis.range < 12) feedbackParts.push("The melodic range is too narrow, use more of the octave range.");
        if (melodyAnalysis.maxInterval > 12) feedbackParts.push("The melody has too large of a leap between notes, make it more stepwise.");
        
        feedback = feedbackParts.join(' ');
        
        if (i === MAX_RETRIES - 1) {
            console.warn("Max retries reached. Returning the last generated melody despite low quality.");
        }
    }

    if (!lastOutput) {
        throw new Error("AI failed to generate a composition after multiple retries.");
    }
    
    // Final validation and correction on the best-effort output
    const validatedOutput: GenerateFullCompositionOutput = {
      melody: validateAndCorrectMelody(lastOutput.melody, key, { quantizeGrid: 1/32, correctToScale: true, maxInterval: 12 }),
      chords: validateAndCorrectMelody(lastOutput.chords, key, { quantizeGrid: 1/16, correctToScale: true }),
      bassline: validateAndCorrectMelody(lastOutput.bassline, key, { quantizeGrid: 1/8, correctToScale: true }),
    };
    
    return validatedOutput;
  }
);

export async function generateMelodyFromPrompt(input: GenerateMelodyInput): Promise<GenerateFullCompositionOutput> {
  return generateMelodyFromPromptFlow(input);
}
