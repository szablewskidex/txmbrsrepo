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
