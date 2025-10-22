import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';

const apiKey = process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.error('[GENKIT] ERROR: No API key found in environment variables!');
} else {
  console.log('[GENKIT] API key loaded:', apiKey.substring(0, 10) + '...');
}

export const ai = genkit({
  plugins: [googleAI({ apiKey })],
  model: 'googleai/gemini-2.5-flash',
});
