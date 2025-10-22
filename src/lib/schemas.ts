
import { z } from 'zod';

const LayerEnum = z.enum(['melody', 'chords', 'bassline']);
export type Layer = z.infer<typeof LayerEnum>;

export const MelodyNoteSchema = z.object({
  note: z.string().describe('The note name (e.g., C4).'),
  start: z.number().describe('The start time of the note in beats.'),
  duration: z.number().describe('The duration of the note in beats.'),
  velocity: z.number().describe('The velocity of the note (0-127).'),
  slide: z.boolean().describe('Whether the note has a slide/portamento effect.'),
});
export type MelodyNote = z.infer<typeof MelodyNoteSchema>;

export const GenerateMelodyInputSchema = z.object({
  prompt: z.string().min(3).max(500).describe('A prompt describing the desired melody, including key, tempo, and style (e.g., "dark trap in A-minor at 140 bpm").'),
  exampleMelody: z.array(MelodyNoteSchema).nullable().optional().describe('An optional example melody to guide the generation.'),
  chordProgression: z.string().optional().describe('A specific chord progression to base the melody on (e.g., "Am-G-C-F").'),
  measures: z.number().int().positive().max(128).default(8).describe('Desired length of the generated composition in measures.'),
  tempo: z.number().int().min(1).max(400).optional().describe('Desired tempo of the composition in BPM.'),
  intensifyDarkness: z.boolean().optional().describe('Hint to favor darker harmonic and melodic choices.'),
  layers: z.array(LayerEnum).min(1).max(3).optional().describe('Optional explicit selection of layers to generate (melody, chords, bassline).'),
  gridResolution: z.number().min(0.0625).max(0.5).default(0.25).optional()
    .describe('Grid quantization resolution (0.25 = 16th notes, 0.125 = 32nd notes).'),
  fastMode: z.boolean().optional().describe('Enable fast generation mode with reduced quality checks for faster results.'),
});
export type GenerateMelodyInput = z.infer<typeof GenerateMelodyInputSchema>;

export const GenerateFullCompositionOutputSchema = z.object({
    melody: z.array(MelodyNoteSchema).describe('The main melodic line of the composition.'),
    chords: z.array(MelodyNoteSchema).describe('The chord progression, typically with longer-duration notes providing the harmony.'),
    bassline: z.array(MelodyNoteSchema).describe('The bass line, typically single notes in a lower octave that follow the root of the chords.'),
    tempo: z.number().int().min(1).max(400).optional().describe('Tempo of the composition in BPM.'),
});
export type GenerateFullCompositionOutput = z.infer<typeof GenerateFullCompositionOutputSchema>;


export const SuggestChordProgressionsInputSchema = z.object({
  key: z.string().describe('The key to suggest chord progressions for (e.g., C major, A minor).'),
  prompt: z.string().optional().describe('Optional textual prompt to provide style or mood context for chord suggestions.'),
});
export type SuggestChordProgressionsInput = z.infer<typeof SuggestChordProgressionsInputSchema>;

export const SuggestChordProgressionsOutputSchema = z.object({
  chordProgressions: z.array(z.string()).describe('An array of suggested chord progressions for the given key.'),
});
export type SuggestChordProgressionsOutput = z.infer<typeof SuggestChordProgressionsOutputSchema>;

export const AnalyzeYouTubeInputSchema = z.object({
  youtubeUrl: z.string().url().describe('The URL of the YouTube video to analyze.'),
  targetPrompt: z.string().optional().describe('A prompt to guide the style of the newly generated melody.'),
  measures: z.number().int().positive().max(128).default(8).describe('Desired length of the generated composition in measures.'),
});
export type AnalyzeYouTubeInput = z.infer<typeof AnalyzeYouTubeInputSchema>;
