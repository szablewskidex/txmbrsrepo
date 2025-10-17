import { PIANO_KEYS } from './constants';

export function noteToIndex(note: string): number {
  return PIANO_KEYS.indexOf(note);
}

export function indexToNote(i: number): string {
  return PIANO_KEYS[i] || '';
}

export function indexToMidiNote(pitchIndex: number): number {
    // MIDI note number for C1 is 24
    return 24 + pitchIndex;
}

export function midiToNoteName(midi: number): string {
  const octave = Math.floor(midi / 12) - 1;
  const noteName = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][midi % 12];
  return `${noteName}${octave}`;
}
