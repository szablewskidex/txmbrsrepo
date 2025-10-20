import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';

export const ai = genkit({
  plugins: [googleAI({ apiKey: 'AIzaSyAuyebJBmwDuO7-kNIbVWwiFaffRUs_MSc' })],
  model: 'googleai/gemini-2.5-flash',
});
