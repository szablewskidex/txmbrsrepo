/**
 * MIDI Training Script - COMPLETE VERSION
 *
 * WSZYSTKIE POPRAWKI:
 * 1. ✅ Lepsze wykrywanie tonacji (z progami pewności)
 * 2. ✅ Detekcja tempo z promptu
 * 3. ✅ Wykrywanie instrumentu z nazwy ścieżki
 * 4. ✅ Filtrowanie duplikatów (NOWE!)
 * 5. ✅ Walidacja zgodności z generator schema (NOWE!)
 * 6. ✅ Inteligentne progresje akordów (NOWE!)
 * 7. ✅ Eksport tylko najlepszych wzorców (NOWE!)
 */

import { Midi } from '@tonejs/midi';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const MIN_NOTES_PER_PATTERN = 8;
const MAX_BEATS_PER_PATTERN = 64;
const MAX_MEASURES = 16;
const MIN_KEY_CONFIDENCE = 0.5;
const MAX_EXPORTED_PATTERNS = 100;
const SIMILARITY_THRESHOLD = 0.85;

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
  instrument?: string;
  trackName?: string;
  hash?: string;
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

function generatePatternHash(pattern: MelodyPattern): string {
  const simplified = pattern.notes.map(n => ({
    pitch: n.pitch,
    start: Math.round(n.start * 4) / 4,
    duration: Math.round(n.duration * 4) / 4,
  }));

  const data = JSON.stringify({
    notes: simplified,
    key: pattern.key,
    measures: pattern.measures,
  });

  return crypto.createHash('md5').update(data).digest('hex');
}

function calculatePatternSimilarity(p1: MelodyPattern, p2: MelodyPattern): number {
  if (p1.key !== p2.key || Math.abs(p1.measures - p2.measures) > 1) {
    return 0;
  }

  const intervals1 = p1.notes.slice(1).map((n, i) => n.pitch - p1.notes[i].pitch);
  const intervals2 = p2.notes.slice(1).map((n, i) => n.pitch - p2.notes[i].pitch);

  const minLen = Math.min(intervals1.length, intervals2.length);
  if (minLen === 0) return 0;

  let matches = 0;
  for (let i = 0; i < minLen; i++) {
    if (Math.abs(intervals1[i] - intervals2[i]) <= 1) {
      matches++;
    }
  }

  return matches / minLen;
}

function deduplicatePatterns(patterns: MelodyPattern[]): MelodyPattern[] {
  const uniquePatterns: MelodyPattern[] = [];
  const seenHashes = new Set<string>();

  for (const pattern of patterns) {
    const hash = generatePatternHash(pattern);

    if (seenHashes.has(hash)) {
      console.log(`   ⊘ Duplikat (identyczny hash): ${pattern.trackName}`);
      continue;
    }

    let isSimilar = false;
    for (const existing of uniquePatterns) {
      const similarity = calculatePatternSimilarity(pattern, existing);
      if (similarity > SIMILARITY_THRESHOLD) {
        console.log(`   ⊘ Duplikat (podobieństwo ${(similarity * 100).toFixed(0)}%): ${pattern.trackName}`);
        isSimilar = true;
        break;
      }
    }

    if (!isSimilar) {
      seenHashes.add(hash);
      uniquePatterns.push({ ...pattern, hash });
    }
  }

  return uniquePatterns;
}

function generateChordProgression(key: string, measures: number, style: string): string {
  const isMinor = key.includes('minor');
  const tonic = key.split(' ')[0];

  const progressions = {
    major: {
      melodic: [`${tonic}-Am-F-G`, `${tonic}-F-G-Am`, `${tonic}-G-Am-F`],
      harmonic: [`${tonic}-Em-Am-F`, `${tonic}-Dm-G-C`],
      rhythmic: [`${tonic}-F-${tonic}-G`, `${tonic}-Am-${tonic}-F`],
    },
    minor: {
      melodic: [`${tonic}m-F-G-Am`, `${tonic}m-G-F-Am`],
      harmonic: [`${tonic}m-Dm-Em-Am`, `${tonic}m-F-G-C`],
      rhythmic: [`${tonic}m-G-${tonic}m-F`, `${tonic}m-Am-${tonic}m-G`],
    },
  } as const;

  const modeProgressions = isMinor ? progressions.minor : progressions.major;
  const styleProgressions = modeProgressions[style as keyof typeof modeProgressions] || modeProgressions.melodic;

  if (measures <= 4) {
    return styleProgressions[0];
  }
  if (measures <= 8) {
    return styleProgressions[Math.min(1, styleProgressions.length - 1)];
  }

  const first = styleProgressions[0];
  const second = styleProgressions[1] || styleProgressions[0];
  return `${first}-${second}`;
}

function validateAgainstSchema(example: TrainingExample): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!example.input.prompt || example.input.prompt.length < 5) {
    errors.push('Prompt zbyt krótki');
  }

  if (!example.input.key.match(/^[A-G](#|b)? (major|minor)$/)) {
    errors.push(`Nieprawidłowy format tonacji: ${example.input.key}`);
  }

  if (example.input.tempo < 40 || example.input.tempo > 240) {
    errors.push(`Tempo poza zakresem: ${example.input.tempo}`);
  }

  if (example.input.measures < 1 || example.input.measures > MAX_MEASURES) {
    errors.push(`Liczba taktów poza zakresem: ${example.input.measures}`);
  }

  if (!example.input.chordProgression || example.input.chordProgression.length === 0) {
    errors.push('Brak progresji akordów');
  }

  if (!Array.isArray(example.output.melody) || example.output.melody.length === 0) {
    errors.push('Brak nut w melodii');
  }

  example.output.melody.forEach((note, idx) => {
    if (!note.note || !note.note.match(/^[A-G](#|b)?-?\d+$/)) {
      errors.push(`Nieprawidłowa nuta ${idx}: ${note.note}`);
    }
    if (typeof note.start !== 'number' || note.start < 0) {
      errors.push(`Nieprawidłowy start ${idx}: ${note.start}`);
    }
    if (typeof note.duration !== 'number' || note.duration <= 0) {
      errors.push(`Nieprawidłowy duration ${idx}: ${note.duration}`);
    }
    if (typeof note.velocity !== 'number' || note.velocity < 0 || note.velocity > 127) {
      errors.push(`Nieprawidłowy velocity ${idx}: ${note.velocity}`);
    }
    if (typeof note.slide !== 'boolean') {
      errors.push(`Nieprawidłowy slide ${idx}: ${note.slide}`);
    }
  });

  if (!example.metadata.source) {
    errors.push('Brak źródła w metadata');
  }

  if (!['melodic', 'harmonic', 'rhythmic'].includes(example.metadata.style)) {
    errors.push(`Nieprawidłowy styl: ${example.metadata.style}`);
  }

  return { valid: errors.length === 0, errors };
}

function detectKey(notes: TrainingNote[]): { key: string; confidence: number } {
  if (notes.length === 0) {
    return { key: 'C major', confidence: 0 };
  }

  const pitchCounts = new Map<number, number>();
  let totalNotes = 0;

  notes.forEach(note => {
    const pitchClass = note.pitch % 12;
    const weight = note.duration;
    pitchCounts.set(pitchClass, (pitchCounts.get(pitchClass) || 0) + weight);
    totalNotes += weight;
  });

  const pitchProbs = new Map<number, number>();
  pitchCounts.forEach((count, pitch) => {
    pitchProbs.set(pitch, count / totalNotes);
  });

  let maxScore = 0;
  let bestTonic = 0;
  let bestMode: 'major' | 'minor' = 'major';

  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const majorScale = [0, 2, 4, 5, 7, 9, 11];
  const minorScale = [0, 2, 3, 5, 7, 8, 10];

  for (let tonic = 0; tonic < 12; tonic++) {
    let majorScore = 0;
    majorScale.forEach(interval => {
      const pitch = (tonic + interval) % 12;
      majorScore += pitchProbs.get(pitch) || 0;
    });

    if (majorScore > maxScore) {
      maxScore = majorScore;
      bestTonic = tonic;
      bestMode = 'major';
    }

    let minorScore = 0;
    minorScale.forEach(interval => {
      const pitch = (tonic + interval) % 12;
      minorScore += pitchProbs.get(pitch) || 0;
    });

    if (minorScore > maxScore) {
      maxScore = minorScore;
      bestTonic = tonic;
      bestMode = 'minor';
    }
  }

  const key = `${noteNames[bestTonic]} ${bestMode}`;
  const confidence = maxScore;

  return { key, confidence };
}

function detectInstrument(trackName: string): string | undefined {
  const lower = trackName.toLowerCase();

  if (/piano|keys|keyboard/i.test(lower)) return 'piano';
  if (/guitar|gtr/i.test(lower)) return 'guitar';
  if (/bass/i.test(lower)) return 'bass';
  if (/string|violin|cello/i.test(lower)) return 'strings';
  if (/synth|pad|lead/i.test(lower)) return 'synth';
  if (/drum|percussion|beat/i.test(lower)) return undefined;

  return undefined;
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

    const trackName = track.name || 'Unknown';

    if (/drum|percussion|beat|kick|snare|hat/i.test(trackName)) {
      console.log(`   ⊘ Pomijam perkusję: ${trackName}`);
      return;
    }

    const instrument = detectInstrument(trackName);

    const notes: TrainingNote[] = track.notes.map(note => ({
      note: midiNumberToNoteName(note.midi),
      start: note.ticks / ppq,
      duration: note.durationTicks / ppq,
      velocity: Math.round(note.velocity * 127),
      pitch: note.midi,
    }));

    const filteredNotes = notes.filter(n => n.start < MAX_BEATS_PER_PATTERN);

    if (filteredNotes.length < MIN_NOTES_PER_PATTERN) {
      console.log(`   ⊘ Za mało nut w ścieżce ${trackName}: ${filteredNotes.length}`);
      return;
    }

    const totalBeats = Math.max(...filteredNotes.map(n => n.start + n.duration));
    const measures = Math.ceil(totalBeats / 4);
    const clampedTotalBeats = Math.min(totalBeats, MAX_BEATS_PER_PATTERN);
    const clampedMeasures = Math.min(measures, MAX_MEASURES);

    const metrics = calculateMetrics(filteredNotes, clampedTotalBeats);
    let style: 'melodic' | 'harmonic' | 'rhythmic' = 'melodic';
    const avgPitch = filteredNotes.reduce((sum, n) => sum + n.pitch, 0) / filteredNotes.length;

    if (avgPitch < 48) {
      style = 'rhythmic';
    } else if (metrics.notesDensity > 15) {
      style = 'melodic';
    } else if (metrics.rhythmicVariety < 0.3) {
      style = 'harmonic';
    }

    const keyDetection = detectKey(filteredNotes);

    if (keyDetection.confidence < MIN_KEY_CONFIDENCE) {
      console.log(`   ⊘ Niska pewność tonacji dla ${trackName}: ${keyDetection.confidence.toFixed(2)}`);
      return;
    }

    patterns.push({
      notes: filteredNotes,
      key: keyDetection.key,
      tempo,
      measures: clampedMeasures,
      totalBeats: clampedTotalBeats,
      style,
      instrument,
      trackName,
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
    .filter(({ metrics, pattern }) => {
      if (metrics.avgInterval < 2 || metrics.avgInterval > 7) return false;
      if (metrics.melodicRange < 12 || metrics.melodicRange > 36) return false;
      if (metrics.rhythmicVariety < 0.25) return false;
      if (metrics.notesDensity < 3 || metrics.notesDensity > 25) return false;
      if (pattern.notes.length < MIN_NOTES_PER_PATTERN || pattern.notes.length > 200) return false;
      return true;
    })
    .sort((a, b) => {
      const scoreA =
        a.metrics.melodicRange * 0.3 +
        a.metrics.rhythmicVariety * 50 +
        a.metrics.syncopation * 20 +
        Math.min(a.metrics.notesDensity / 10, 5) * 10;

      const scoreB =
        b.metrics.melodicRange * 0.3 +
        b.metrics.rhythmicVariety * 50 +
        b.metrics.syncopation * 20 +
        Math.min(b.metrics.notesDensity / 10, 5) * 10;

      return scoreB - scoreA;
    })
    .slice(0, MAX_EXPORTED_PATTERNS)
    .map(({ pattern }) => pattern);
}

interface TrainingExample {
  input: {
    prompt: string;
    key: string;
    tempo: number;
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
    instrument?: string;
    tempo: number;
    style: string;
    metrics: TrainingMetrics;
  };
}

function generateTrainingExamples(patterns: MelodyPattern[], sourceFile: string): TrainingExample[] {
  return patterns.map(pattern => {
    const metrics = analyzePattern(pattern);

    const promptParts: string[] = [];

    if (pattern.key.includes('minor')) {
      promptParts.push('dark');
    } else {
      promptParts.push('bright');
    }

    if (pattern.instrument) {
      promptParts.push(pattern.instrument);
    }

    if (pattern.tempo < 90) {
      promptParts.push('slow');
    } else if (pattern.tempo > 140) {
      promptParts.push('fast');
    }

    if (metrics.syncopation > 0.3) {
      promptParts.push('syncopated');
    }
    if (metrics.avgInterval > 5) {
      promptParts.push('wide intervals');
    }
    if (metrics.rhythmicVariety > 0.5) {
      promptParts.push('complex rhythm');
    }
    if (metrics.velocityRange > 40) {
      promptParts.push('dynamic');
    }

    promptParts.push('melody');

    const prompt = `${promptParts.join(' ')} in ${pattern.key}`;
    const chordProgression = generateChordProgression(pattern.key, pattern.measures, pattern.style);

    return {
      input: {
        prompt,
        key: pattern.key,
        tempo: Math.round(pattern.tempo),
        measures: pattern.measures,
        chordProgression,
      },
      output: {
        melody: pattern.notes.map(note => ({
          note: note.note,
          start: Number(note.start.toFixed(4)),
          duration: Number(note.duration.toFixed(4)),
          velocity: note.velocity,
          slide: false,
        })),
      },
      metadata: {
        source: sourceFile,
        instrument: pattern.instrument,
        tempo: Math.round(pattern.tempo),
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

  let collectedPatterns: MelodyPattern[] = [];

  for (const file of midiFiles) {
    const filePath = path.join(trainingDir, file);
    console.log(`🔍 Przetwarzanie: ${file}`);

    try {
      const patterns = await parseMidiFile(filePath);
      console.log(`   ✓ Znaleziono ${patterns.length} wzorców`);
      collectedPatterns.push(...patterns);
    } catch (error) {
      console.error(`   ✗ Błąd przetwarzania ${file}:`, error);
    }
  }

  console.log(`\n📊 Podsumowanie przed filtrowaniem:`);
  console.log(`   • Wszystkich wzorców: ${collectedPatterns.length}`);

  console.log(`\n🔍 Deduplikacja wzorców...`);
  const uniquePatterns = deduplicatePatterns(collectedPatterns);
  console.log(`   ✓ Po deduplikacji: ${uniquePatterns.length} (usunięto ${collectedPatterns.length - uniquePatterns.length})`);

  console.log(`\n⭐ Wybieranie najlepszych wzorców...`);
  const bestPatterns = extractBestPatterns(uniquePatterns);
  console.log(`   ✓ Wysokiej jakości: ${bestPatterns.length}`);

  const trainingExamples = bestPatterns.flatMap(pattern => generateTrainingExamples([pattern], pattern.trackName || 'unknown'));

  console.log(`\n✅ Walidacja zgodności ze schema...`);
  const validExamples: TrainingExample[] = [];
  let invalidCount = 0;

  for (const example of trainingExamples) {
    const validation = validateAgainstSchema(example);
    if (validation.valid) {
      validExamples.push(example);
    } else {
      invalidCount++;
      console.log(`   ✗ Nieprawidłowy przykład: ${validation.errors.join(', ')}`);
    }
  }

  console.log(`   ✓ Poprawnych: ${validExamples.length}`);
  if (invalidCount > 0) {
    console.log(`   ✗ Niepoprawnych: ${invalidCount}`);
  }

  const outputDir = path.join(process.cwd(), 'training-data');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputFile = path.join(outputDir, 'melody-training-dataset.json');
  fs.writeFileSync(outputFile, JSON.stringify(validExamples, null, 2));

  console.log(`\n✅ Dataset zapisany: ${outputFile}`);
  console.log(`   • Przykładów treningowych: ${validExamples.length}`);

  const styleStats = validExamples.reduce((acc, ex) => {
    acc[ex.metadata.style] = (acc[ex.metadata.style] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log(`\n📈 Statystyki stylów:`);
  Object.entries(styleStats).forEach(([style, count]) => {
    console.log(`   • ${style}: ${count}`);
  });

  const avgMetrics = validExamples.reduce((acc, ex) => ({
    avgInterval: acc.avgInterval + ex.metadata.metrics.avgInterval,
    melodicRange: acc.melodicRange + ex.metadata.metrics.melodicRange,
    rhythmicVariety: acc.rhythmicVariety + ex.metadata.metrics.rhythmicVariety,
    notesDensity: acc.notesDensity + ex.metadata.metrics.notesDensity,
  }), { avgInterval: 0, melodicRange: 0, rhythmicVariety: 0, notesDensity: 0 });

  const count = validExamples.length;
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
