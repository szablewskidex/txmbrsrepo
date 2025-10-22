'use server';

import type {
  AnalyzeYouTubeInput,
  GenerateMelodyInput,
  SuggestChordProgressionsInput,
} from '@/lib/schemas';
import { generateMelodyFromPrompt as generateMelodyFromPromptFlow } from '@/ai/flows/generate-melody-from-prompt';
import { suggestChordProgressions as suggestChordProgressionsFlow } from '@/ai/flows/suggest-chord-progressions';
import { analyzeYouTubeAndGenerateMelody as analyzeYouTubeAndGenerateMelodyFlow } from '@/ai/flows/analyze-youtube-flow';

export async function generateMelodyAction(input: GenerateMelodyInput) {
  try {
    const result = await generateMelodyFromPromptFlow(input);
    return { data: result, error: null };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Nie udało się wygenerować melodii.';
    return { data: null, error: message };
  }
}

export async function suggestChordProgressionsAction(input: SuggestChordProgressionsInput) {
  try {
    const result = await suggestChordProgressionsFlow(input);
    return { data: result, error: null };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Nie udało się pobrać progresji akordów.';
    return { data: null, error: message };
  }
}

export async function analyzeAndGenerateAction(input: AnalyzeYouTubeInput) {
  try {
    const result = await analyzeYouTubeAndGenerateMelodyFlow(input);
    return { data: result, error: null };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Nie udało się przeanalizować nagrania.';
    return { data: null, error: message };
  }
}
