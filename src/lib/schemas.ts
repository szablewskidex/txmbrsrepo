
import { z } from 'zod';

export const MelodyNoteSchema = z.object({
  note: z.string().describe('The note name (e.g., C4).'),
  start: z.number().describe('The start time of the note in beats.'),
  duration: z.number().describe('The duration of the note in beats.'),
  velocity: z.number().describe('The velocity of the note (0-127).'),
  slide: z.boolean().describe('Whether the note has a slide/portamento effect.'),
});
export type MelodyNote = z.infer<typeof MelodyNoteSchema>;

export const GenerateMelodyInputSchema = z.object({
  prompt: z.string().min(3).max(500).describe('A prompt describing the desired melody, including key, tempo, and length (e.g., \'A-minor, tempo 120, 8 bars\').'),
  exampleMelody: z.array(MelodyNoteSchema).optional().describe('An optional example melody to guide the generation.'),
  chordProgression: z.string().optional().describe('A specific chord progression to base the melody on (e.g., "Am-G-C-F").'),
});
export type GenerateMelodyInput = z.infer<typeof GenerateMelodyInputSchema>;

export const GenerateFullCompositionOutputSchema = z.object({
    melody: z.array(MelodyNoteSchema).describe('The main melodic line of the composition.'),
    chords: z.array(MelodyNoteSchema).describe('The chord progression, typically with longer-duration notes providing the harmony.'),
    bassline: z.array(MelodyNoteSchema).describe('The bass line, typically single notes in a lower octave that follow the root of the chords.')
});
export type GenerateFullCompositionOutput = z.infer<typeof GenerateFullCompositionOutputSchema>;


export const SuggestChordProgressionsInputSchema = z.object({
  key: z.string().describe('The key to suggest chord progressions for (e.g., C major, A minor).'),
});
export type SuggestChordProgressionsInput = z.infer<typeof SuggestChordProgressionsInputSchema>;

export const SuggestChordProgressionsOutputSchema = z.object({
  chordProgressions: z.array(z.string()).describe('An array of suggested chord progressions for the given key.'),
});
export type SuggestChordProgressionsOutput = z.infer<typeof SuggestChordProgressionsOutputSchema>;

export const AnalyzeYouTubeInputSchema = z.object({
  youtubeUrl: z.string().url().describe('The URL of the YouTube video to analyze.'),
  targetPrompt: z.string().optional().describe('A prompt to guide the style of the newly generated melody.'),
});
export type AnalyzeYouTubeInput = z.infer<typeof AnalyzeYouTubeInputSchema>;
