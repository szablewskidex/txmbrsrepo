
'use server';
import { generateMelodyFromPrompt, GenerateMelodyInput, GenerateMelodyOutput } from '@/ai/flows/generate-melody-from-prompt';
import { z } from 'zod';

const GenerateMelodyActionInput = z.object({
  prompt: z.string().min(1, 'Prompt cannot be empty.'),
  exampleMelody: z.array(z.any()).optional(),
});

export async function generateMelodyAction(input: GenerateMelodyInput): Promise<{ data: GenerateMelodyOutput | null; error: string | null; }> {
  const validation = GenerateMelodyActionInput.safeParse(input);
  if (!validation.success) {
    return { data: null, error: validation.error.flatten().formErrors.join(', ') };
  }
  
  try {
    const melody = await generateMelodyFromPrompt(input);
    return { data: melody, error: null };
  } catch (error) {
    console.error('Error generating melody:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return { data: null, error: `Failed to generate melody. ${errorMessage}` };
  }
}
