
'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import MidiWriter from 'midi-writer-js';
import { Midi } from '@tonejs/midi';
import * as Tone from 'tone';
import type { Note, GhostNote } from '@/lib/types';
import { DEFAULT_MEASURES, DEFAULT_CELL_PX, ROW_HEIGHT } from '@/lib/constants';
import { indexToNote, indexToMidiNote, noteToIndex, midiToNoteName } from '@/lib/music';
import { useToast } from "@/hooks/use-toast";
import { generateMelodyAction, suggestChordProgressionsAction, analyzeAndGenerateAction } from '@/app/actions';
import type { GenerateFullCompositionOutput, MelodyNote } from '@/lib/schemas';
import { Disc3 } from 'lucide-react';

import { Toolbar } from './Toolbar';
import { PianoKeys } from './PianoKeys';
import { Grid } from './Grid';
import { ControlsPanel } from './ControlsPanel';
import { EventEditor } from './EventEditor';
import { ScrollArea, ScrollBar } from '../ui/scroll-area';
import { Timeline } from './Timeline';
import { useGenerationProgress } from '@/hooks/useGenerationProgress';
import { Progress } from '../ui/progress';

export function PianoRoll() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [ghostNotes, setGhostNotes] = useState<GhostNote[]>([]);
  const [measures, setMeasures] = useState(DEFAULT_MEASURES);
  const [cellPx, setCellPx] = useState(DEFAULT_CELL_PX);
  const [verticalZoom, setVerticalZoom] = useState(1);
  const [selectedNoteId, setSelectedNoteId] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playPosition, setPlayPosition] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [chordProgressions, setChordProgressions] = useState<string[]>([]);
  const [currentKey, setCurrentKey] = useState('A minor');
  const [bpm, setBpm] = useState(120);

  const {
    progress,
    status,
    start: startProgress,
    stop: stopProgress,
    reset: resetProgress,
  } = useGenerationProgress();

  const nextId = useRef(1);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const synthRef = useRef<Tone.PolySynth | null>(null);
  const scheduledEventsRef = useRef<number[]>([]);
  const { toast } = useToast();
  
  const beats = measures * 4;

  // Initialize Tone.js on the client side
  useEffect(() => {
    if (typeof window !== 'undefined') {
        synthRef.current = new Tone.PolySynth(Tone.Synth, {
            oscillator: { type: 'triangle8' },
            envelope: { attack: 0.02, decay: 0.1, sustain: 0.3, release: 1 }
        }).toDestination();
        Tone.Transport.bpm.value = bpm;
    }
    // Clean up on unmount
    return () => {
        if (synthRef.current) {
            synthRef.current.dispose();
        }
        if (Tone.Transport.state !== 'stopped') {
            Tone.Transport.stop();
        }
        Tone.Transport.cancel();
        scheduledEventsRef.current.forEach(id => Tone.Transport.clear(id));
        scheduledEventsRef.current = [];
    }
  }, []);

  // Sync BPM with Tone.Transport
  useEffect(() => {
    if (typeof window !== 'undefined') {
      Tone.Transport.bpm.value = bpm;
    }
  }, [bpm]);
  
  // Playback logic with Tone.js
  useEffect(() => {
    let animationFrameId: number;

    const loop = () => {
        // Use Tone.Transport.progress which returns a value between 0-1
        setPlayPosition(Tone.Transport.progress * beats);
        animationFrameId = requestAnimationFrame(loop);
    };

    if (isPlaying) {
        animationFrameId = requestAnimationFrame(loop);
    } else {
        cancelAnimationFrame(animationFrameId!);
    }

    return () => cancelAnimationFrame(animationFrameId);
  }, [isPlaying, beats]);

   // Fetch chord progressions when the key changes
   useEffect(() => {
    const fetchChords = async () => {
      const result = await suggestChordProgressionsAction({ key: currentKey });
      if (result.data) {
        setChordProgressions(result.data.chordProgressions);
      } else {
        toast({
          variant: "destructive",
          title: "Błąd przy pobieraniu akordów",
          description: result.error || "Nieznany błąd",
        });
      }
    };
    fetchChords();
  }, [currentKey, toast]);


  const addNote = useCallback((start: number, pitch: number) => {
    const id = nextId.current++;
    const newNote: Note = {
      id,
      start: Math.floor(start),
      pitch,
      duration: 1,
      velocity: 100,
      slide: false,
    };
    setNotes(ns => [...ns, newNote]);
    setSelectedNoteId(id);
    // Play sound on add
    const synth = synthRef.current;
    if (synth) {
      const noteName = indexToNote(pitch);
      synth.triggerAttackRelease(noteName, "8n", Tone.now(), newNote.velocity / 127);
    }
  }, []);

  const removeNote = useCallback((id: number) => {
    setNotes(ns => ns.filter(n => n.id !== id));
    if (selectedNoteId === id) {
      setSelectedNoteId(null);
    }
  }, [selectedNoteId]);

  const updateNote = useCallback((id: number, patch: Partial<Note>) => {
    setNotes(ns => ns.map(n => (n.id === id ? { ...n, ...patch } : n)));
  }, []);
  
  const getNote = (id: number) => notes.find(n => n.id === id);

  const scheduleNotes = useCallback(() => {
    // Clear previously scheduled events
    scheduledEventsRef.current.forEach(id => Tone.Transport.clear(id));
    scheduledEventsRef.current = [];

    const synth = synthRef.current;
    if (!synth) return;
    
    // Schedule new events
    notes.forEach(note => {
      if (note.duration > 0) {
        const noteName = indexToNote(note.pitch as number);
        // Convert beats to Tone.Time notation (e.g. "4n", "8n")
        const time = Tone.Time(note.start, "i").toNotation(); 
        const duration = Tone.Time(note.duration, "i").toNotation();

        const eventId = Tone.Transport.schedule(t => {
            synth.triggerAttackRelease(noteName, duration, t, note.velocity / 127);
        }, time);
        scheduledEventsRef.current.push(eventId);
      }
    });
  }, [notes]);
  
  const handlePlayToggle = async () => {
    if (Tone.context.state !== 'running') {
        await Tone.start();
    }
    
    if (isPlaying) {
        Tone.Transport.stop();
        setPlayPosition(0);
    } else {
        scheduleNotes();
        Tone.Transport.loop = true;
        Tone.Transport.loopEnd = Tone.Time(beats, 'i').toNotation();
        Tone.Transport.start();
    }
    setIsPlaying(p => !p);
  };


  const exportMidi = () => {
    const track = new MidiWriter.Track();
    track.setTempo(bpm);
    track.addEvent(new MidiWriter.ProgramChangeEvent({ instrument: 1 }));
    
    const sortedNotes = [...notes].sort((a, b) => a.start - b.start);

    const PPQ = 960; // Pulses per quarter note

    sortedNotes.forEach(note => {
        if (note.duration > 0) {
            const startInTicks = note.start * PPQ;
            const durationInTicks = note.duration * PPQ;
    
            const durationString = `T${Math.floor(durationInTicks)}`;
    
            track.addEvent(new MidiWriter.NoteEvent({
                pitch: [indexToMidiNote(note.pitch as number)],
                duration: durationString,
                startTick: Math.floor(startInTicks),
                velocity: Math.round(note.velocity / 127 * 100),
            }));
        }
    });

    const write = new MidiWriter.Writer([track]);
    const dataUri = write.dataUri();
    const a = document.createElement('a');
    a.href = dataUri;
    a.download = 'pianoroll-export.mid';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast({ title: "MIDI Eksportowane", description: "Twoja kompozycja została pobrana." });
  };

  const exportJson = () => {
    const exportData = notes.map(n => ({
        note: indexToNote(n.pitch as number),
        start: n.start,
        duration: n.duration,
        velocity: n.velocity,
        slide: n.slide,
    }));
    const jsonString = JSON.stringify(exportData, null, 2);
    navigator.clipboard.writeText(jsonString).then(() => {
        toast({ title: "JSON Skopiowany", description: "Dane nut zostały skopiowane do schowka." });
    }, () => {
        toast({ variant: "destructive", title: "Błąd", description: "Nie udało się skopiować danych JSON." });
    });
  };

  const handleImportMidiClick = () => {
    fileInputRef.current?.click();
  };

  const handleMidiFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const arrayBuffer = await file.arrayBuffer();
      const midi = new Midi(arrayBuffer);
      
      const newBpm = midi.header.tempos[0]?.bpm || 120;
      setBpm(newBpm);
      
      const ppq = midi.header.ppq;
      const newNotes: Note[] = [];
      let maxTimeInBeats = 0;

      midi.tracks.forEach(track => {
        track.notes.forEach(note => {
            const pitchName = midiToNoteName(note.midi);
            const pitchIndex = noteToIndex(pitchName);

            if (pitchIndex !== -1) {
                const startInBeats = note.ticks / ppq;
                const durationInBeats = note.durationTicks / ppq;

                newNotes.push({
                    id: nextId.current++,
                    start: startInBeats,
                    duration: durationInBeats,
                    pitch: pitchIndex,
                    velocity: Math.round(note.velocity * 127),
                    slide: false,
                });
                maxTimeInBeats = Math.max(maxTimeInBeats, startInBeats + durationInBeats);
            }
        });
      });
      
      const newMeasures = Math.ceil(maxTimeInBeats / 4);
      setMeasures(Math.max(DEFAULT_MEASURES, newMeasures));
      setNotes(newNotes);
      toast({ title: "MIDI Zaimportowane", description: "Twoja kompozycja została załadowana." });

    } catch (error) {
      console.error("Error parsing MIDI file:", error);
      toast({ variant: "destructive", title: "Błąd Importu", description: "Nie udało się przetworzyć pliku MIDI." });
    } finally {
        if(event.target) {
            event.target.value = '';
        }
    }
  };
  
  const toggleGhostExample = () => {
    if (ghostNotes.length > 0) {
      setGhostNotes([]);
    } else {
      setGhostNotes([
        { start: 2, pitch: noteToIndex('E4'), duration: 1 },
        { start: 6, pitch: noteToIndex('G4'), duration: 1 },
      ]);
    }
  };

  const processAndSetNotes = (composition: GenerateFullCompositionOutput | null) => {
    if (!composition) return;

    const convertAiNotes = (aiNotes: MelodyNote[]): Note[] => {
      return aiNotes.map(aiNote => {
        const pitch = noteToIndex(aiNote.note);
        if (pitch === -1) {
          console.warn(`AI wygenerowało nieprawidłową nutę: ${aiNote.note}`);
          return null;
        }
        return {
          id: nextId.current++,
          start: aiNote.start,
          duration: aiNote.duration,
          pitch,
          velocity: aiNote.velocity,
          slide: aiNote.slide,
        };
      }).filter((n): n is Note => n !== null);
    };

    const newMelody = convertAiNotes(composition.melody);
    const newChords = convertAiNotes(composition.chords);
    const newBassline = convertAiNotes(composition.bassline);

    const allNotes = [...newMelody, ...newChords, ...newBassline];
    allNotes.sort((a, b) => a.start - b.start);
    
    setNotes(allNotes);
    toast({ title: "Kompozycja Wygenerowana", description: "AI stworzyło nową, pełną kompozycję." });
  };


  const handleGenerateMelody = async (prompt: string, useExample: boolean, chordProgression?: string, youtubeUrl?: string) => {
    setIsGenerating(true);
    startProgress();
  
    try {
        let result;
        const fullPrompt = `${prompt}, ${bpm} bpm`;

        if (youtubeUrl) {
            result = await analyzeAndGenerateAction({ youtubeUrl, targetPrompt: fullPrompt });
            if (result.error) {
                toast({ variant: "destructive", title: "Błąd Analizy YouTube", description: result.error });
            }
        } else {
            const keyMatch = prompt.match(/([A-G][b#]?\s+(major|minor))/i);
            const key = keyMatch ? keyMatch[0] : currentKey;
            if (key !== currentKey) {
              setCurrentKey(key);
            }
          
            const exampleMelody = useExample ? notes.map(n => ({
                note: indexToNote(n.pitch as number),
                start: n.start,
                duration: n.duration,
                velocity: n.velocity,
                slide: n.slide,
            })) : undefined;
          
            result = await generateMelodyAction({ prompt: fullPrompt, exampleMelody, chordProgression });
            
            if (result.error) {
              toast({ variant: "destructive", title: "Błąd AI", description: result.error });
            }
        }
        
        if (result && !result.error) {
            processAndSetNotes(result.data);
        }

    } finally {
        stopProgress();
        // Give a moment for the 100% to show before hiding the overlay
        setTimeout(() => {
            setIsGenerating(false);
            resetProgress();
        }, 500);
    }
  };

  const selectedNote = notes.find(n => n.id === selectedNoteId);

  return (
    <div className="flex flex-col h-full w-full font-body bg-background text-foreground relative">
       {isGenerating && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="flex flex-col items-center gap-6 w-80">
            <Disc3 className="w-24 h-24 text-primary animate-spin" />
            <div className="w-full text-center">
                <p className="text-2xl text-primary-foreground font-semibold tabular-nums">
                    {Math.round(progress)}%
                </p>
                <p className="text-sm text-muted-foreground mt-1 min-h-[20px]">{status}</p>
            </div>
            <Progress value={progress} className="w-full" />
          </div>
        </div>
      )}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleMidiFileChange}
        accept=".mid,.midi"
        className="hidden"
      />
      <Toolbar
        isPlaying={isPlaying}
        onPlayToggle={handlePlayToggle}
        onImportMidiClick={handleImportMidiClick}
        onExportMidi={exportMidi}
        onExportJson={exportJson}
        onToggleGhost={toggleGhostExample}
        bpm={bpm}
        onBpmChange={setBpm}
      />
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 flex flex-col">
            <ScrollArea className="flex-grow" type="always">
              <div className="flex">
                <div className="w-20 shrink-0 sticky left-0 z-30 bg-card border-r" />
                <div className="flex-grow">
                  <Timeline beats={beats} cellPx={cellPx} />
                </div>
              </div>
              <div className="flex relative">
                <ScrollArea
                  className="flex-grow overflow-auto"
                  style={{ height: 'calc(100vh - 14rem)' }}
                  viewportRef={useRef<HTMLDivElement>(null)}
                >
                  <PianoKeys rowHeight={ROW_HEIGHT} verticalZoom={verticalZoom} />
                  <Grid
                    notes={notes}
                    ghostNotes={ghostNotes}
                    beats={beats}
                    cellPx={cellPx}
                    verticalZoom={verticalZoom}
                    playPosition={playPosition}
                    onAddNote={addNote}
                    onUpdateNote={updateNote}
                    getNote={getNote}
                    selectedNoteId={selectedNoteId}
                    onSelectNote={setSelectedNoteId}
                  />
                </ScrollArea>
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </div>
          <EventEditor
            notes={notes}
            selectedNoteId={selectedNoteId}
            onUpdateNote={updateNote}
            cellPx={cellPx}
          />
        </div>
        <ControlsPanel
          measures={measures}
          setMeasures={setMeasures}
          cellPx={cellPx}
          setCellPx={setCellPx}
          verticalZoom={verticalZoom}
          setVerticalZoom={setVerticalZoom}
          selectedNote={selectedNote}
          onRemoveNote={removeNote}
          onUpdateNote={updateNote}
          onGenerateMelody={handleGenerateMelody}
          isGenerating={isGenerating}
          chordProgressions={chordProgressions}
          currentKey={currentKey}
          setCurrentKey={setCurrentKey}
        />
      </div>
    </div>
  );
}

    
    