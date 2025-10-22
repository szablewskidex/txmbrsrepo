import type { MelodyNote } from '@/lib/schemas';
import { analyzeMelody } from '@/lib/melody-validator';
import type { Mood } from './prompt-detection';

export interface EnhancedMelodyAnalysis {
  score: number;
  issues: string[];
  avgInterval: number;
  range: number;
  maxInterval: number;
  noteCount: number;
  rhythmicVariety: number;
  coverageRatio: number;
}

export function enhancedAnalyzeMelody(
  melody: MelodyNote[],
  totalBeats: number,
  mood: Mood,
  intensify: boolean
): EnhancedMelodyAnalysis {
  if (!melody || melody.length === 0) {
    return {
      score: 0,
      issues: ['No notes in melody'],
      avgInterval: 0,
      range: 0,
      maxInterval: 0,
      noteCount: 0,
      rhythmicVariety: 0,
      coverageRatio: 0,
    };
  }

  const baseAnalysis = analyzeMelody(melody);

  let coveredBeats = 0;
  melody.forEach(note => {
    coveredBeats += note.duration;
  });
  const coverageRatio = totalBeats > 0 ? coveredBeats / totalBeats : 0;

  const durations = melody.map(n => n.duration);
  const uniqueDurations = new Set(durations).size;
  const rhythmicVariety = durations.length > 0 ? uniqueDurations / durations.length : 0;

  const issues: string[] = [];
  const allowExtreme = mood === 'dark' || intensify;

  if (baseAnalysis.avgInterval < 2 && baseAnalysis.avgInterval > 0) {
    issues.push('Melody is too monotonic - use intervals of 2-5 semitones more often');
  }
  if (baseAnalysis.avgInterval > 5 && !allowExtreme) {
    issues.push('Melody jumps too much - use more stepwise motion (1-2 semitones)');
  }
  if (baseAnalysis.range < 12 && baseAnalysis.range > 0) {
    issues.push('Melodic range is too narrow - expand to at least one octave (12 semitones)');
  } else if (baseAnalysis.range > 28 && !allowExtreme) {
    issues.push('Melodic range is too wide - keep within roughly two octaves');
  }
  if (baseAnalysis.maxInterval > (allowExtreme ? 19 : 12)) {
    issues.push('Contains intervals larger than allowed - keep dramatic leaps under control');
  }
  if (melody.length < 8) {
    issues.push('Too few notes - add more to create a fuller melody');
  }
  if (coverageRatio < 0.6) {
    issues.push(`Melody has too many gaps - fill in more of the ${totalBeats} beats`);
  }
  if (rhythmicVariety < (allowExtreme ? 0.2 : 0.3)) {
    issues.push('Rhythm is too repetitive - vary note durations more');
  }

  let score = baseAnalysis.score;
  const penalty = allowExtreme ? 3 : 5;
  score -= issues.length * penalty;
  if (allowExtreme) {
    score += 5;
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    issues,
    avgInterval: baseAnalysis.avgInterval,
    range: baseAnalysis.range,
    maxInterval: baseAnalysis.maxInterval,
    noteCount: melody.length,
    rhythmicVariety,
    coverageRatio,
  };
}
