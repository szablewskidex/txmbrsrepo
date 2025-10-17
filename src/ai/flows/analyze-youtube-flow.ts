
'use server';
/**
 * @fileOverview Flow for analyzing a YouTube video and generating a new melody.
 *
 * - analyzeYouTubeAndGenerateMelody - Analyzes a YouTube video's audio to extract a melody and generates a new one based on it.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { generateMelodyFromPrompt } from './generate-melody-from-prompt';
import { AnalyzeYouTubeInputSchema, GenerateMelodyOutputSchema, type AnalyzeYouTubeInput, type GenerateMelodyOutput } from '@/lib/schemas';


const AnalyzedMelodySchema = z.object({
    tempo: z.number().describe('The detected tempo (BPM) of the source audio.'),
    notes: z.array(z.object({
        note: z.string().describe('The note name (e.g., C4).'),
        start: z.number().describe('The start time in beats.'),
        duration: z.number().describe('The duration in beats.'),
    })).describe('The sequence of notes extracted from the audio.'),
});

// This is a placeholder tool. In a real-world scenario, this would
// involve downloading the audio, running pitch detection (like librosa/pyin),
// and quantizing the results. For now, it returns a mock analysis.
const analyzeYouTubeAudio = ai.defineTool(
  {
    name: 'analyzeYouTubeAudio',
    description: 'Analyzes the audio from a YouTube URL to extract its main melody and tempo. Returns a simplified representation of the melody.',
    inputSchema: z.object({
      youtubeUrl: z.string().url(),
    }),
    outputSchema: AnalyzedMelodySchema,
  },
  async ({ youtubeUrl }) => {
    console.log(`Simulating analysis of: ${youtubeUrl}`);
    // This is a mock implementation.
    // A real implementation would download the audio and process it.
    // Returning a well-known melody for demonstration purposes.
    return {
        tempo: 120,
        notes: [
            { note: 'E4', start: 0, duration: 0.5 },
            { note: 'E4', start: 0.5, duration: 0.5 },
            { note: 'F4', start: 1, duration: 0.5 },
            { note: 'G4', start: 1.5, duration: 0.5 },
            { note: 'G4', start: 2, duration: 0.5 },
            { note: 'F4', start: 2.5, duration: 0.5 },
            { note: 'E4', start: 3, duration: 0.5 },
            { note: 'D4', start: 3.5, duration: 0.5 },
            { note: 'C4', start: 4, duration: 0.5 },
            { note: 'C4', start: 4.5, duration: 0.5 },
            { note: 'D4', start: 5, duration: 0.5 },
            { note: 'E4', start: 5.5, duration: 0.5 },
            { note: 'E4', start: 6, duration: 0.75 },
            { note: 'D4', start: 6.75, duration: 0.25 },
            { note: 'D4', start: 7, duration: 1 },
        ]
    };
  }
);


const youtubeAnalysisFlow = ai.defineFlow(
  {
    name: 'analyzeYouTubeAndGenerateMelodyFlow',
    inputSchema: AnalyzeYouTubeInputSchema,
    outputSchema: GenerateMelodyOutputSchema,
  },
  async ({ youtubeUrl, targetPrompt }) => {
    // 1. "Analyze" the youtube video to get a melody
    const analysis = await analyzeYouTubeAudio({ youtubeUrl });
    
    // 2. Create the prompt for the next step
    const exampleMelodyForPrompt = analysis.notes.map(n => ({
        note: n.note,
        start: n.start,
        duration: n.duration,
        velocity: 100, // default velocity
        slide: false,   // default slide
    }));
    
    const finalPrompt = targetPrompt || `A new melody inspired by the analysis, in a dark, minor key. Original tempo was ${analysis.tempo} BPM.`;

    // 3. Call the existing melody generation flow, providing the analyzed melody as an example.
    const generatedMelody = await generateMelodyFromPrompt({
      prompt: finalPrompt,
      exampleMelody: exampleMelodyForPrompt,
    });
    
    return generatedMelody;
  }
);


export async function analyzeYouTubeAndGenerateMelody(input: AnalyzeYouTubeInput): Promise<GenerateMelodyOutput> {
    return youtubeAnalysisFlow(input);
}
