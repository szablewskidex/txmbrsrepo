
'use server';
import { generateMelodyFromPrompt } from '@/ai/flows/generate-melody-from-prompt';
import { suggestChordProgressions } from '@/ai/flows/suggest-chord-progressions';
import { analyzeYouTubeAndGenerateMelody } from '@/ai/flows/analyze-youtube-flow';
import { 
  GenerateMelodyInputSchema,
  SuggestChordProgressionsInputSchema,
  AnalyzeYouTubeInputSchema,
  type GenerateMelodyInput,
  type GenerateMelodyOutput,
  type SuggestChordProgressionsInput,
  type SuggestChordProgressionsOutput,
  type AnalyzeYouTubeInput
} from '@/lib/schemas';


// Server Actions

export async function generateMelodyAction(input: GenerateMelodyInput): Promise<{ data: GenerateMelodyOutput | null; error: string | null; }> {
  const validation = GenerateMelodyInputSchema.safeParse(input);
  if (!validation.success) {
    return { data: null, error: validation.error.flatten().formErrors.join(', ') };
  }
  
  try {
    const melody = await generateMelodyFromPrompt(validation.data);
    return { data: melody, error: null };
  } catch (error) {
    console.error('Error generating melody:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return { data: null, error: `Failed to generate melody. ${errorMessage}` };
  }
}


export async function suggestChordProgressionsAction(input: SuggestChordProgressionsInput): Promise<{ data: SuggestChordProgressionsOutput | null; error: string | null; }> {
    const validation = SuggestChordProgressionsInputSchema.safeParse(input);
    if (!validation.success) {
      return { data: null, error: validation.error.flatten().formErrors.join(', ') };
    }
    
    try {
      const chords = await suggestChordProgressions(validation.data);
      return { data: chords, error: null };
    } catch (error) {
      console.error('Error suggesting chord progressions:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
      return { data: null, error: `Failed to suggest chords. ${errorMessage}` };
    }
}


export async function analyzeAndGenerateAction(input: AnalyzeYouTubeInput): Promise<{ data: GenerateMelodyOutput | null; error: string | null; }> {
    const validation = AnalyzeYouTubeInputSchema.safeParse(input);
    if (!validation.success) {
      return { data: null, error: validation.error.flatten().formErrors.join(', ') };
    }
    
    try {
      const melody = await analyzeYouTubeAndGenerateMelody(validation.data);
      return { data: melody, error: null };
    } catch (error) {
      console.error('Error analyzing YouTube video and generating melody:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
      return { data: null, error: `Failed to process YouTube link. ${errorMessage}` };
    }
}
