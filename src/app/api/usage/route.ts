import { getTotalEstimatedTokensUsed } from '@/ai/flows/generate-melody-from-prompt';

export async function GET() {
  const totalEstimatedTokensUsed = await getTotalEstimatedTokensUsed();
  console.log('API usage called, totalEstimatedTokensUsed:', totalEstimatedTokensUsed);
  return Response.json({
    totalEstimatedTokensUsed,
    timestamp: new Date().toISOString(),
  });
}
