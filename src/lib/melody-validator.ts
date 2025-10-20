
import type { MelodyNote } from '@/lib/schemas';

// Skale muzyczne (w półtonach od prymy)
const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
  melodicMinor: [0, 2, 3, 5, 7, 9, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
};

const NOTE_MAP: Record<string, number> = {
  'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
  'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8,
  'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11
};

/**
 * Konwertuje nazwę nuty (np. "C4") na numer MIDI
 */
function noteToMidi(note: string): number {
  const match = note.match(/^([A-G][b#]?)(\d+)$/);
  if (!match) return 60; // Domyślnie C4
  const [, noteName, octave] = match;
  return (parseInt(octave) + 1) * 12 + NOTE_MAP[noteName];
}

/**
 * Konwertuje numer MIDI na nazwę nuty
 */
function midiToNote(midi: number): string {
  const octave = Math.floor(midi / 12) - 1;
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const noteName = noteNames[midi % 12];
  return `${noteName}${octave}`;
}


/**
 * Koryguje nutę do najbliższej w skali
 */
function snapToScale(noteName: string, key: string, scaleType: keyof typeof SCALES = 'minor'): string {
    const originalMidi = noteToMidi(noteName);
    const rootNoteName = key.split(' ')[0];
    const rootMidiBase = NOTE_MAP[rootNoteName];

    const noteInOctave = originalMidi % 12;
    const scale = SCALES[scaleType];

    let closestNoteInScale = -1;
    let minDistance = Infinity;

    // Find the closest scale degree in the chromatic circle
    for (const interval of scale) {
        const scaleNoteBase = (rootMidiBase + interval) % 12;
        const distance = Math.min(
            Math.abs(noteInOctave - scaleNoteBase),
            12 - Math.abs(noteInOctave - scaleNoteBase)
        );
        if (distance < minDistance) {
            minDistance = distance;
            closestNoteInScale = scaleNoteBase;
        }
    }

    let pitchCorrection = closestNoteInScale - noteInOctave;
    // Adjust for circular distance
    if (pitchCorrection > 6) {
        pitchCorrection -= 12;
    } else if (pitchCorrection < -6) {
        pitchCorrection += 12;
    }
    
    const correctedMidi = originalMidi + pitchCorrection;

    return midiToNote(correctedMidi);
}


/**
 * Quantize - wyrównuje timing do najbliższej wartości siatki
 */
function quantize(value: number, gridSize: number = 0.25): number {
  if (gridSize <= 0) return value;

  const multiplier = 1 / gridSize;
  const steps = Math.round(value * multiplier);
  const quantized = steps / multiplier;

  return Number(quantized.toFixed(6));
}

/**
 * Humanizacja - dodaje subtelne losowe odchylenia
 */
function humanize(note: MelodyNote, timingAmount: number = 0.02, velocityAmount: number = 5): MelodyNote {
  return {
    ...note,
    start: note.start + (Math.random() - 0.5) * timingAmount,
    velocity: Math.max(1, Math.min(127, note.velocity + Math.floor((Math.random() - 0.5) * velocityAmount * 2))),
  };
}

/**
 * Główna funkcja walidacji i korekty melodii
 */
export function validateAndCorrectMelody(
  notes: MelodyNote[],
  key: string = 'A minor',
  options: {
    maxDuration?: number;
    correctToScale?: boolean;
    quantizeGrid?: number;
    humanize?: boolean;
    maxInterval?: number; // maksymalny skok melodyczny w półtonach
    removeDuplicates?: boolean;
    ensureMinNotes?: number; // NOWA OPCJA
    allowChromatic?: boolean;
  } = {}
): MelodyNote[] {
  const {
    maxDuration = 32,
    correctToScale = true,
    quantizeGrid = 0.25,
    humanize: shouldHumanize = false,
    maxInterval = 12, // maksymalnie oktawa
    removeDuplicates = true,
    ensureMinNotes = 0,
    allowChromatic = false,
  } = options;

  if (!notes || notes.length === 0) {
      return [];
  }

  const scaleType = key.includes('major') ? 'major' : allowChromatic ? 'harmonicMinor' : 'minor';
  let processedNotes = [...notes];

  // 1. Sortuj po czasie przed przetwarzaniem
  processedNotes.sort((a, b) => a.start - b.start);

  // 2. Usuń nuty rozpoczynające się poza zakresem i przytnij wystające zakończenia
  processedNotes = processedNotes
    .filter(note => note.start >= 0 && note.start < maxDuration)
    .map(note => {
      const remaining = maxDuration - note.start;
      if (remaining <= 0) {
        return { ...note, duration: 0 };
      }
      return {
        ...note,
        duration: Math.min(note.duration, remaining),
      };
    })
    .filter(note => note.duration > 0);

  // 3. Quantize timing
  if (quantizeGrid > 0) {
    processedNotes = processedNotes
      .map(note => ({
        ...note,
        start: quantize(note.start, quantizeGrid),
        duration: Math.max(quantizeGrid, quantize(note.duration, quantizeGrid)),
      }))
      .map(note => {
        const clampedEnd = Math.min(note.start + note.duration, maxDuration);
        const adjustedDuration = clampedEnd - note.start;
        if (adjustedDuration <= 0) {
          return { ...note, duration: 0 };
        }
        return {
          ...note,
          duration: adjustedDuration,
        };
      })
      .filter(note => note.duration > 0);
  }

  // 4. Korekcja do skali
  if (correctToScale) {
    processedNotes = processedNotes.map(note => ({
      ...note,
      note: snapToScale(note.note, key, scaleType),
    }));
  }

  // 5. Ogranicz duże skoki melodyczne
  if (maxInterval > 0 && processedNotes.length > 1) {
    for (let i = 1; i < processedNotes.length; i++) {
      const prevMidi = noteToMidi(processedNotes[i - 1].note);
      let currMidi = noteToMidi(processedNotes[i].note);
      const interval = Math.abs(currMidi - prevMidi);
      
      if (interval > maxInterval) {
        // Przesuń nutę bliżej poprzedniej, zachowując kierunek
        const direction = Math.sign(currMidi - prevMidi);
        let newMidi = prevMidi + direction * maxInterval;
        processedNotes[i].note = snapToScale(midiToNote(newMidi), key, scaleType);
      }
    }
  }

  // 6. Usuń nakładające się nuty (duplikaty)
  if (removeDuplicates) {
    const uniqueNotes: MelodyNote[] = [];
    const timeSlots = new Set<string>();

    for (const note of processedNotes) {
        const startSlot = quantize(note.start, quantizeGrid > 0 ? quantizeGrid : 0.125);
        const key = `${startSlot}:${note.note}`;

        if (!timeSlots.has(key)) {
            uniqueNotes.push(note);
            timeSlots.add(key);
        }
    }
    processedNotes = uniqueNotes;
  }
  
  // 7. Zapewnij minimalną liczbę nut (prosta strategia - duplikowanie)
  if (ensureMinNotes > 0 && processedNotes.length > 0 && processedNotes.length < ensureMinNotes) {
    const originalNotes = [...processedNotes];
    while (processedNotes.length < ensureMinNotes) {
      const noteToCopy = originalNotes[processedNotes.length % originalNotes.length];
      const lastNote = processedNotes[processedNotes.length-1];
      const newStart = lastNote.start + lastNote.duration;
      if (newStart + noteToCopy.duration <= maxDuration) {
        processedNotes.push({ ...noteToCopy, start: newStart });
      } else {
        break; 
      }
    }
  }


  // 8. Humanizacja (opcjonalna)
  if (shouldHumanize) {
    processedNotes = processedNotes.map(note => humanize(note));
  }

  // 9. Ostateczne sortowanie
  processedNotes.sort((a, b) => a.start - b.start);

  return processedNotes;
}

/**
 * Analiza złożoności melodii
 */
export function analyzeMelody(notes: MelodyNote[]): {
  avgInterval: number;
  maxInterval: number;
  rhythmicDensity: number;
  range: number;
  score: number; // 0-100, wyższa = lepsza
} {
  if (notes.length < 2) {
    return { avgInterval: 0, maxInterval: 0, rhythmicDensity: 0, range: 0, score: 0 };
  }

  // Sort notes by start time for correct interval calculation
  const sortedNotes = [...notes].sort((a,b) => a.start - b.start);
  const midiNotes = sortedNotes.map(n => noteToMidi(n.note));
  
  // Oblicz średni i maksymalny interwał
  let totalInterval = 0;
  let maxInterval = 0;
  
  for (let i = 1; i < midiNotes.length; i++) {
    const interval = Math.abs(midiNotes[i] - midiNotes[i - 1]);
    totalInterval += interval;
    maxInterval = Math.max(maxInterval, interval);
  }
  
  const avgInterval = totalInterval / (midiNotes.length - 1);
  
  // Zakres melodyczny
  const range = Math.max(...midiNotes) - Math.min(...midiNotes);
  
  // Gęstość rytmiczna (ile nut na beat)
  const duration = Math.max(...sortedNotes.map(n => n.start + n.duration));
  const rhythmicDensity = duration > 0 ? sortedNotes.length / duration : 0;
  
  // Scoring (proste heurystyki)
  let score = 50;
  
  // Dobry średni interwał: 2-5 półtonów
  if (avgInterval >= 2 && avgInterval <= 5) score += 15;
  else if (avgInterval < 2 && avgInterval > 0) score -= 10; // zbyt monotonna
  else if (avgInterval > 5) score -= 5; // zbyt skaczaca
  
  // Dobry zakres: 1-2 oktawy
  if (range >= 12 && range <= 24) score += 15;
  else if (range < 12 && range > 0) score -= 10;
  
  // Dobra gęstość: 1-4 nuty na beat
  if (rhythmicDensity >= 1 && rhythmicDensity <= 4) score += 15;
  
  // Kara za zbyt duże skoki
  if (maxInterval > 12) score -= 10;

  // Kara za brak nut
  if (notes.length < 5) score -= 20;
  
  score = Math.max(0, Math.min(100, score));
  
  return { avgInterval, maxInterval, rhythmicDensity, range, score };
}
