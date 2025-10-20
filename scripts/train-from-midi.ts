/**
 * MIDI Training Script
 *
 * Analizuje pliki MIDI i tworzy dataset do trenowania AI.
 * Uczy model lepszych wzorców melodycznych, rytmicznych i harmonicznych.
 *
 * USAGE:
 *   npx tsx scripts/train-from-midi.ts
 *
 * Wymaga folderu: /public/midi/training/ z plikami .mid
 */

import { Midi } from '@tonejs/midi';
import fs from 'fs';
import path from 'path';

interface TrainingNote {
  note: string;
  start: number;
  duration: number;
  velocity: number;
  pitch: number;
}

interface MelodyPattern {
  notes: TrainingNote[];
  key: string;
  tempo: number;
  measures: number;
  totalBeats: number;
  style: 'melodic' | 'harmonic' | 'rhythmic';
}

interface TrainingMetrics {
  avgInterval: number;
  melodicRange: number;
  rhythmicVariety: number;
  notesDensity: number;
  velocityRange: number;
  syncopation: number;
}

function midiNumberToNoteName(midi: number): string {
  const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const octave = Math.floor(midi / 12) - 1;
  const note = notes[midi % 12];
  return `${note}${octave}`;
}

function detectKey(notes: TrainingNote[]): string {
  const pitchCounts = new Map<number, number>();

  notes.forEach(note => {
    const pitchClass = note.pitch % 12;
    pitchCounts.set(pitchClass, (pitchCounts.get(pitchClass) || 0) + 1);
  });

  let maxCount = 0;
  let tonic = 0;
  pitchCounts.forEach((count, pitch) => {
    if (count > maxCount) {
      maxCount = count;
      tonic = pitch;
    }
  });

  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const thirdPitch = (tonic + 3) % 12;
  const majorThirdPitch = (tonic + 4) % 12;

  const hasMinorThird = pitchCounts.get(thirdPitch) || 0;
  const hasMajorThird = pitchCounts.get(majorThirdPitch) || 0;

  const mode = hasMinorThird > hasMajorThird ? 'minor' : 'major';

  return `${noteNames[tonic]} ${mode}`;
}

function calculateMetrics(notes: TrainingNote[], totalBeats: number): TrainingMetrics {
  if (notes.length < 2) {
    return {
      avgInterval: 0,
      melodicRange: 0,
      rhythmicVariety: 0,
      notesDensity: 0,
      velocityRange: 0,
      syncopation: 0,
    };
  }

  const sorted = [...notes].sort((a, b) => a.start - b.start);

  let totalInterval = 0;
  for (let i = 1; i < sorted.length; i++) {
    const interval = Math.abs(sorted[i].pitch - sorted[i - 1].pitch);
    totalInterval += interval;
  }
  const avgInterval = totalInterval / (sorted.length - 1);

  const pitches = sorted.map(n => n.pitch);
  const melodicRange = Math.max(...pitches) - Math.min(...pitches);

  const durations = sorted.map(n => n.duration);
  const uniqueDurations = new Set(durations).size;
  const rhythmicVariety = uniqueDurations / durations.length;

  const measures = totalBeats / 4;
  const notesDensity = measures > 0 ? sorted.length / measures : 0;

  const velocities = sorted.map(n => n.velocity);
  const velocityRange = Math.max(...velocities) - Math.min(...velocities);

  const offBeatNotes = sorted.filter(n => {
    const beatPosition = n.start % 1;
    return beatPosition !== 0 && beatPosition !== 0.5;
  });
  const syncopation = sorted.length > 0 ? offBeatNotes.length / sorted.length : 0;

  return {
    avgInterval,
    melodicRange,
    rhythmicVariety,
    notesDensity,
    velocityRange,
    syncopation,
  };
}

async function parseMidiFile(filePath: string): Promise<MelodyPattern[]> {
  const buffer = fs.readFileSync(filePath);
  const midi = new Midi(buffer);

  const patterns: MelodyPattern[] = [];
  const tempo = midi.header.tempos[0]?.bpm || 120;
  const ppq = midi.header.ppq;

  midi.tracks.forEach(track => {
    if (track.notes.length === 0) return;

    const notes: TrainingNote[] = track.notes.map(note => ({
      note: midiNumberToNoteName(note.midi),
      start: note.ticks / ppq,
      duration: note.durationTicks / ppq,
      velocity: Math.round(note.velocity * 127),
      pitch: note.midi,
    }));

    const maxBeats = 64;
    const filteredNotes = notes.filter(n => n.start < maxBeats);

    if (filteredNotes.length < 8) return;

    const totalBeats = Math.max(...filteredNotes.map(n => n.start + n.duration));
    const measures = Math.ceil(totalBeats / 4);

    let style: 'melodic' | 'harmonic' | 'rhythmic' = 'melodic';
    const avgPitch = filteredNotes.reduce((sum, n) => sum + n.pitch, 0) / filteredNotes.length;

    if (avgPitch < 48) style = 'rhythmic';
    else if (filteredNotes.length / measures > 15) style = 'melodic';
    else style = 'harmonic';

    const key = detectKey(filteredNotes);

    patterns.push({
      notes: filteredNotes,
      key,
      tempo,
      measures: Math.min(measures, 16),
      totalBeats: Math.min(totalBeats, maxBeats),
      style,
    });
  });

  return patterns;
}

function analyzePattern(pattern: MelodyPattern): TrainingMetrics {
  return calculateMetrics(pattern.notes, pattern.totalBeats);
}

function extractBestPatterns(patterns: MelodyPattern[]): MelodyPattern[] {
  return patterns
    .map(pattern => ({
      pattern,
      metrics: analyzePattern(pattern),
    }))
    .filter(({ metrics }) =>
      metrics.avgInterval >= 2 &&
      metrics.avgInterval <= 5 &&
      metrics.melodicRange >= 12 &&
      metrics.melodicRange <= 24 &&
      metrics.rhythmicVariety >= 0.3 &&
      metrics.notesDensity >= 4 &&
      metrics.notesDensity <= 20,
    )
    .sort((a, b) => {
      const scoreA = a.metrics.melodicRange + a.metrics.rhythmicVariety * 50 + a.metrics.syncopation * 30;
      const scoreB = b.metrics.melodicRange + b.metrics.rhythmicVariety * 50 + b.metrics.syncopation * 30;
      return scoreB - scoreA;
    })
    .slice(0, 50)
    .map(({ pattern }) => pattern);
}

interface TrainingExample {
  input: {
    prompt: string;
    key: string;
    measures: number;
    chordProgression: string;
  };
  output: {
    melody: Array<{
      note: string;
      start: number;
      duration: number;
      velocity: number;
      slide: boolean;
    }>;
  };
  metadata: {
    source: string;
    style: string;
    metrics: TrainingMetrics;
  };
}

function generateTrainingExamples(patterns: MelodyPattern[], sourceFile: string): TrainingExample[] {
  return patterns.map(pattern => {
    const metrics = analyzePattern(pattern);

    const promptParts: string[] = [];
    if (pattern.key.includes('minor')) promptParts.push('dark');
    if (metrics.syncopation > 0.3) promptParts.push('trap');
    if (metrics.avgInterval > 4) promptParts.push('aggressive');
    if (metrics.rhythmicVariety > 0.5) promptParts.push('complex');
    if (metrics.velocityRange > 40) promptParts.push('dynamic');

    const prompt = promptParts.length > 0
      ? `${promptParts.join(' ')} melody in ${pattern.key}`
      : `melody in ${pattern.key}`;

    const chordProgression = pattern.key.includes('minor')
      ? 'Am-G-C-F'
      : 'C-G-Am-F';

    return {
      input: {
        prompt,
        key: pattern.key,
        measures: pattern.measures,
        chordProgression,
      },
      output: {
        melody: pattern.notes.map(note => ({
          note: note.note,
          start: note.start,
          duration: note.duration,
          velocity: note.velocity,
          slide: false,
        })),
      },
      metadata: {
        source: sourceFile,
        style: pattern.style,
        metrics,
      },
    };
  });
}

async function trainFromMidiFiles() {
  console.log('🎵 Starting MIDI Training Pipeline...\n');

  const trainingDir = path.join(process.cwd(), 'public', 'midi', 'training');

  if (!fs.existsSync(trainingDir)) {
    console.error(`❌ Folder ${trainingDir} nie istnieje!`);
    console.log('Stwórz folder: public/midi/training/ i dodaj pliki .mid');
    process.exit(1);
  }

  const midiFiles = fs.readdirSync(trainingDir).filter(f => f.endsWith('.mid') || f.endsWith('.midi'));

  if (midiFiles.length === 0) {
    console.error('❌ Brak plików MIDI w folderze training/');
    process.exit(1);
  }

  console.log(`📁 Znaleziono ${midiFiles.length} plików MIDI\n`);

  let allPatterns: MelodyPattern[] = [];
  let allExamples: TrainingExample[] = [];

  for (const file of midiFiles) {
    const filePath = path.join(trainingDir, file);
    console.log(`🔍 Przetwarzanie: ${file}`);

    try {
      const patterns = await parseMidiFile(filePath);
      console.log(`   ✓ Znaleziono ${patterns.length} wzorców`);

      allPatterns.push(...patterns);

      const examples = generateTrainingExamples(patterns, file);
      allExamples.push(...examples);
    } catch (error) {
      console.error(`   ✗ Błąd przetwarzania ${file}:`, error);
    }
  }

  console.log(`\n📊 Podsumowanie:`);
  console.log(`   • Wszystkich wzorców: ${allPatterns.length}`);

  const bestPatterns = extractBestPatterns(allPatterns);
  console.log(`   • Wysokiej jakości: ${bestPatterns.length}`);

  const outputDir = path.join(process.cwd(), 'training-data');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputFile = path.join(outputDir, 'melody-training-dataset.json');
  fs.writeFileSync(outputFile, JSON.stringify(allExamples, null, 2));

  console.log(`\n✅ Dataset zapisany: ${outputFile}`);
  console.log(`   • Przykładów treningowych: ${allExamples.length}`);

  const styleStats = allExamples.reduce((acc, ex) => {
    acc[ex.metadata.style] = (acc[ex.metadata.style] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log(`\n📈 Statystyki stylów:`);
  Object.entries(styleStats).forEach(([style, count]) => {
    console.log(`   • ${style}: ${count}`);
  });

  const avgMetrics = allExamples.reduce((acc, ex) => ({
    avgInterval: acc.avgInterval + ex.metadata.metrics.avgInterval,
    melodicRange: acc.melodicRange + ex.metadata.metrics.melodicRange,
    rhythmicVariety: acc.rhythmicVariety + ex.metadata.metrics.rhythmicVariety,
    notesDensity: acc.notesDensity + ex.metadata.metrics.notesDensity,
  }), { avgInterval: 0, melodicRange: 0, rhythmicVariety: 0, notesDensity: 0 });

  const count = allExamples.length;
  if (count > 0) {
    console.log(`\n📊 Średnie metryki:`);
    console.log(`   • Średni interwał: ${(avgMetrics.avgInterval / count).toFixed(2)} semitones`);
    console.log(`   • Zakres melodyczny: ${(avgMetrics.melodicRange / count).toFixed(2)} semitones`);
    console.log(`   • Różnorodność rytmiczna: ${(avgMetrics.rhythmicVariety / count * 100).toFixed(0)}%`);
    console.log(`   • Gęstość nut: ${(avgMetrics.notesDensity / count).toFixed(1)} notes/bar`);
  }

  console.log(`\n🎉 Trening zakończony!`);
  console.log(`\n💡 Następny krok: Użyj tego datasetu do fine-tuningu modelu AI`);
}

trainFromMidiFiles().catch(console.error);
