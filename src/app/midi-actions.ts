'use server';

import { promises as fs } from 'fs';
import path from 'path';
import { Midi } from '@tonejs/midi';
import { midiToNoteName, noteToIndex } from '@/lib/music';
import type { MelodyNote } from '@/lib/schemas';

export async function getMidiExamplesAction(): Promise<{ data: string[] | null; error: string | null }> {
  try {
    const directoryPath = path.join(process.cwd(), 'src/lib/midi-examples');
    const files = await fs.readdir(directoryPath);
    const midiFiles = files.filter(file => file.endsWith('.mid') || file.endsWith('.midi'));
    return { data: midiFiles, error: null };
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      console.warn('MIDI examples directory not found:', error.path);
      return { data: [], error: 'MIDI examples directory `src/lib/midi-examples` not found.' };
    }
    console.error('Error reading MIDI examples directory:', error);
    return { data: null, error: 'Failed to read MIDI examples.' };
  }
}

export async function loadMidiFileAction(fileName: string): Promise<{ data: MelodyNote[] | null; error: string | null }> {
  try {
    const filePath = path.join(process.cwd(), `src/lib/midi-examples/${fileName}`);
    const fileContent = await fs.readFile(filePath);

    const midi = new Midi(fileContent);
    const ppq = midi.header.ppq;
    const melody: MelodyNote[] = [];

    midi.tracks.forEach(track => {
      track.notes.forEach(note => {
        const pitchName = midiToNoteName(note.midi);
        const pitchIndex = noteToIndex(pitchName);

        if (pitchIndex !== -1) {
          const startInBeats = note.ticks / ppq;
          const durationInBeats = note.durationTicks / ppq;

          melody.push({
            note: pitchName,
            start: startInBeats,
            duration: durationInBeats,
            velocity: Math.round(note.velocity * 127),
            slide: false,
          });
        }
      });
    });

    if (melody.length === 0) {
      return { data: null, error: `No notes found in MIDI file: ${fileName}` };
    }

    melody.sort((a, b) => a.start - b.start);

    return { data: melody, error: null };
  } catch (error: any) {
    console.error(`Error loading MIDI file ${fileName}:`, error);
    return { data: null, error: `Could not load or parse file: ${fileName}` };
  }
}
