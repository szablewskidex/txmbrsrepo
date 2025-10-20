"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo, useTransition } from 'react';
import { Midi } from '@tonejs/midi';
import * as Tone from 'tone';
import type { Note, GhostNote } from '@/lib/types';
import { DEFAULT_MEASURES, DEFAULT_CELL_PX, ROW_HEIGHT, DEFAULT_GRID_RESOLUTION } from '@/lib/constants';
import { indexToNote, indexToMidiNote, noteToIndex, midiToNoteName } from '@/lib/music';
import { useToast } from '@/hooks/use-toast';
import { getMidiExamplesAction, loadMidiFileAction } from '../../app/midi-actions';
import { suggestChordProgressionsAction } from '../../app/ai-actions';
import type { GenerateFullCompositionOutput, MelodyNote } from '@/lib/schemas';
import { Disc3, Loader2, ThumbsDown, ThumbsUp } from 'lucide-react';

import { Toolbar } from './Toolbar';
import { PianoKeys } from './PianoKeys';
import { Grid } from './Grid';
import { ControlsPanel } from './ControlsPanel';
import { EventEditor } from './EventEditor';
import { ScrollArea, ScrollBar } from '../ui/scroll-area';
import { Timeline } from './Timeline';
import { Progress } from '../ui/progress';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Label } from '../ui/label';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Textarea } from '../ui/textarea';
import { submitFeedbackAction } from '@/app/feedback-actions';

const slugify = (input: string | undefined, maxWords: number = 3, fallback: string = 'melody') => {
  if (!input) return fallback;
  const normalized = input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .trim();

  if (!normalized) return fallback;

  const words = normalized.split(/\s+/).filter(Boolean).slice(0, maxWords);
  return words.length > 0 ? words.join('-') : fallback;
};

interface PianoRollProps {
  melody: GenerateFullCompositionOutput | null;
  onGenerateMelody: (
    prompt: string,
    key: string,
    useExample: boolean,
    chordProgression?: string,
    youtubeUrl?: string,
    exampleMelody?: MelodyNote[],
    measures?: number,
    tempo?: number,
    intensifyDarkness?: boolean,
    gridResolution?: number,
  ) => Promise<void>;
  isGenerating: boolean;
  setMelody: (melody: GenerateFullCompositionOutput | null) => void;
  generationProgress?: number;
  generationStep?: string;
}

export function PianoRoll({
  melody,
  onGenerateMelody,
  isGenerating,
  setMelody,
  generationProgress,
  generationStep,
}: PianoRollProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [ghostNotes, setGhostNotes] = useState<GhostNote[]>([]);
  const [measures, setMeasures] = useState(DEFAULT_MEASURES);
  const [cellPx, setCellPx] = useState(DEFAULT_CELL_PX);
  const [verticalZoom, setVerticalZoom] = useState(1);
  const [selectedNoteId, setSelectedNoteId] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playPosition, setPlayPosition] = useState(0);
  const [chordProgressions, setChordProgressions] = useState<string[]>([]);
  const [isFetchingChords, setIsFetchingChords] = useState(false);
  const [selectedChordProgression, setSelectedChordProgression] = useState<string | undefined>(undefined);
  const [currentKey, setCurrentKey] = useState('A minor');
  const [debouncedKey, setDebouncedKey] = useState(currentKey);
  const [bpm, setBpm] = useState(120);
  const [midiExamples, setMidiExamples] = useState<string[]>([]);
  const [selectedMidiExample, setSelectedMidiExample] = useState<string>('');
  const [lastPrompt, setLastPrompt] = useState<string>('melody');
  const [gridResolution, setGridResolution] = useState(DEFAULT_GRID_RESOLUTION);
  const [lastKey, setLastKey] = useState('A minor');
  const [lastChordProgression, setLastChordProgression] = useState<string | undefined>(undefined);
  const [lastIntensifyDarkness, setLastIntensifyDarkness] = useState(false);
  const [feedbackState, setFeedbackState] = useState<'idle' | 'upvoted' | 'downvoted' | 'submitting'>('idle');
  const [negativeReason, setNegativeReason] = useState<'quality' | 'prompt_mismatch' | 'other'>('quality');
  const [negativeNotes, setNegativeNotes] = useState('');
  const [isFeedbackDialogOpen, setIsFeedbackDialogOpen] = useState(false);
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [isSendPositivePending, startSendPositive] = useTransition();
  const [isSendNegativePending, startSendNegative] = useTransition();

  const nextId = useRef(1);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const synthRef = useRef<Tone.PolySynth | null>(null);
  const scheduledEventsRef = useRef<number[]>([]);
  const { toast } = useToast();
  const dragUrlRef = useRef<string | null>(null);

  const compositionMeasures = DEFAULT_MEASURES;
  const compositionBeats = compositionMeasures * 4;
  const gridBeats = measures * 4;

  useEffect(() => {
    if (melody) {
      const convertAiNotes = (aiNotes: MelodyNote[]): Note[] => {
        return aiNotes
          .map(aiNote => {
            const pitchIndex = noteToIndex(aiNote.note);
            if (pitchIndex === -1) {
              console.warn(`AI generated an invalid note: ${aiNote.note}`);
              return null;
            }
            const convertedNote: Note = {
              id: nextId.current++,
              start: aiNote.start,
              duration: aiNote.duration,
              pitch: pitchIndex,
              velocity: aiNote.velocity,
              slide: aiNote.slide,
            };
            return convertedNote;
          })
          .filter((n): n is Note => n !== null);
      };

      const newMelody = convertAiNotes(melody.melody);
      const newChords = convertAiNotes(melody.chords);
      const newBassline = convertAiNotes(melody.bassline);

      const allNotes = [...newMelody, ...newChords, ...newBassline];
      allNotes.sort((a, b) => a.start - b.start);

      const totalBeatsLimit = compositionBeats;

      const clampedNotes = allNotes
        .map(note => {
          if (note.start >= totalBeatsLimit) {
            return null;
          }
          const remaining = Math.max(0, totalBeatsLimit - note.start);
          const clampedDuration = Math.min(note.duration, remaining);
          if (clampedDuration <= 0) {
            return null;
          }
          return {
            ...note,
            duration: clampedDuration,
          };
        })
        .filter((n): n is Note => n !== null);

      if (clampedNotes.length > 0) {
        setNotes(clampedNotes);
        const maxId = Math.max(...clampedNotes.map(n => n.id));
        nextId.current = maxId + 1;
      } else {
        setNotes([]);
      }
    } else {
      setNotes([]);
    }
  }, [melody, measures]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      synthRef.current = new Tone.PolySynth({
        maxPolyphony: 64,
        voice: Tone.Synth,
        options: {
          oscillator: { type: 'triangle8' },
          envelope: { attack: 0.02, decay: 0.1, sustain: 0.3, release: 1 },
        },
      }).toDestination();
      Tone.Transport.bpm.value = bpm;
    }
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
    };
  }, [bpm]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      Tone.Transport.bpm.value = bpm;
    }
  }, [bpm]);

  useEffect(() => {
    let animationFrameId: number | null = null;

    const loop = () => {
      setPlayPosition(Tone.Transport.progress * compositionBeats);
      animationFrameId = requestAnimationFrame(loop);
    };

    if (isPlaying) {
      animationFrameId = requestAnimationFrame(loop);
    } else if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
    }

    return () => {
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, compositionBeats]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedKey(currentKey);
    }, 500);

    return () => {
      clearTimeout(handler);
    };
  }, [currentKey]);

  useEffect(() => {
    const fetchChords = async () => {
      setIsFetchingChords(true);
      setChordProgressions([]);
      setSelectedChordProgression(undefined);
      try {
        const result = await suggestChordProgressionsAction({ key: debouncedKey });
        if (result.data) {
          const progressions = result.data.chordProgressions ?? [];
          setChordProgressions(progressions);
          if (progressions.length > 0) {
            setSelectedChordProgression(progressions[0]);
          }
        } else {
          toast({
            variant: 'destructive',
            title: 'Błąd przy pobieraniu akordów',
            description: result.error || 'Nieznany błąd',
          });
        }
      } catch (err) {
        console.error('Failed to fetch chord progressions:', err);
        toast({
          variant: 'destructive',
          title: 'Błąd przy pobieraniu akordów',
          description: 'Wystąpił nieoczekiwany błąd.',
        });
      } finally {
        setIsFetchingChords(false);
      }
    };
    fetchChords();
  }, [debouncedKey, toast]);

  useEffect(() => {
    const fetchMidiExamples = async () => {
      try {
        const result = await getMidiExamplesAction();
        if (result.data) {
          setMidiExamples(result.data);
        } else if (result.error) {
          console.warn('Could not load MIDI examples:', result.error);
          toast({
            variant: 'default',
            title: 'Nie udało się wczytać przykładów MIDI',
            description: result.error,
          });
        }
      } catch (err) {
        console.error('Error fetching MIDI examples:', err);
      }
    };
    fetchMidiExamples();
  }, [toast]);

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
    const synth = synthRef.current;
    if (synth) {
      const noteName = indexToNote(pitch);
      synth.triggerAttackRelease(noteName, '8n', Tone.now(), newNote.velocity / 127);
    }
  }, []);

  const removeNote = useCallback(
    (id: number) => {
      setNotes(ns => ns.filter(n => n.id !== id));
      if (selectedNoteId === id) {
        setSelectedNoteId(null);
      }
    },
    [selectedNoteId],
  );

  const updateNote = useCallback((id: number, patch: Partial<Note>) => {
    setNotes(ns => ns.map(n => (n.id === id ? { ...n, ...patch } : n)));
  }, []);

  const getNote = (id: number) => notes.find(n => n.id === id);

  const scheduleNotes = useCallback(() => {
    scheduledEventsRef.current.forEach(id => Tone.Transport.clear(id));
    scheduledEventsRef.current = [];

    const synth = synthRef.current;
    if (!synth) return;

    const secondsPerBeat = 60 / bpm;
    const maxBeats = compositionBeats;

    notes
      .filter(note => note.start < maxBeats)
      .forEach(note => {
        if (typeof note.pitch !== 'number') {
          return;
        }

        const remainingBeats = Math.max(0, maxBeats - note.start);
        const playableBeats = Math.min(note.duration, remainingBeats);
        if (playableBeats <= 0) {
          return;
        }

        const noteName = indexToNote(note.pitch);
        const time = note.start * secondsPerBeat;
        const duration = playableBeats * secondsPerBeat;

        const eventId = Tone.Transport.schedule(t => {
          synth.triggerAttackRelease(noteName, duration, t, note.velocity / 127);
        }, time);

        scheduledEventsRef.current.push(eventId);
      });
  }, [notes, bpm, measures]);

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
      Tone.Transport.loopEnd = `${compositionMeasures}m`;
      Tone.Transport.start();
    }
    setIsPlaying(p => !p);
  };

  const buildMidiFile = () => {
    const TICKS_PER_BEAT = 480;
    const midi = new Midi();
    midi.header.setTempo(bpm);
    const track = midi.addTrack();

    const events = notes
      .filter(note => note.start < compositionBeats)
      .map(note => {
        const remainingBeats = Math.max(0, compositionBeats - note.start);
        const playableBeats = Math.min(note.duration, remainingBeats);
        if (typeof note.pitch !== 'number' || playableBeats <= 0) {
          return null;
        }
        return {
          startTicks: Math.round(note.start * TICKS_PER_BEAT),
          durationTicks: Math.max(1, Math.round(playableBeats * TICKS_PER_BEAT)),
          pitch: indexToMidiNote(note.pitch),
          velocity: Math.min(1, Math.max(0, note.velocity / 127)),
        };
      })
      .filter((event): event is {
        startTicks: number;
        durationTicks: number;
        pitch: number;
        velocity: number;
      } => event !== null)
      .sort((a, b) => a.startTicks - b.startTicks);

    if (events.length > 0) {
      const maxTicks = Math.max(...events.map(event => event.startTicks + event.durationTicks));
      console.log('[MIDI_EXPORT] Total measures ~', maxTicks / TICKS_PER_BEAT / 4, {
        notesCount: events.length,
        maxStartBeats: maxTicks / TICKS_PER_BEAT,
      });
    }

    events.forEach(event => {
      track.addNote({
        midi: event.pitch,
        ticks: event.startTicks,
        durationTicks: event.durationTicks,
        velocity: event.velocity,
      });
    });

    if (events.length === 0) {
      return null;
    }

    const midiArray = midi.toArray();
    const blob = new Blob([midiArray], { type: 'audio/midi' });
    const keySlug = slugify(currentKey, 3, 'key');
    const promptSlug = slugify(lastPrompt, 3, 'melody');
    const bpmLabel = `${Math.round(bpm)}bpm`;
    const fileName = `${keySlug}_${bpmLabel}_${promptSlug}.mid`;

    return { blob, fileName };
  };

  const exportMidi = () => {
    const file = buildMidiFile();
    if (!file) {
      toast({ variant: 'destructive', title: 'Brak nut', description: 'Nie ma czego eksportować do MIDI.' });
      return;
    }

    const url = URL.createObjectURL(file.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: 'MIDI Eksportowane', description: 'Twoja kompozycja została pobrana.' });
  };

  const handleDragMidiStart = async (event: React.DragEvent<HTMLButtonElement>) => {
    const file = buildMidiFile();
    if (!file) {
      event.preventDefault();
      toast({ variant: 'destructive', title: 'Brak nut', description: 'Nie ma czego przeciągnąć.' });
      return;
    }

    if (event.dataTransfer) {
      try {
        const midiFile = new File([file.blob], file.fileName, {
          type: 'audio/midi',
          lastModified: Date.now(),
        });

        if (event.dataTransfer.items && event.dataTransfer.items.add) {
          event.dataTransfer.items.add(midiFile);
          event.dataTransfer.effectAllowed = 'copy';

          const arrayBuffer = await file.blob.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);
          const binaryString = uint8Array.reduce((data, byte) => data + String.fromCharCode(byte), '');
          const base64 = btoa(binaryString);

          event.dataTransfer.setData('DownloadURL', `audio/midi:${file.fileName}:data:audio/midi;base64,${base64}`);
        } else {
          const url = URL.createObjectURL(file.blob);
          dragUrlRef.current = url;
          event.dataTransfer.effectAllowed = 'copy';
          event.dataTransfer.setData('DownloadURL', `audio/midi:${file.fileName}:${url}`);
        }
      } catch (error) {
        console.error('[MIDI_DRAG] Error setting up drag data:', error);
        toast({
          variant: 'destructive',
          title: 'Błąd przeciągania',
          description: 'Nie udało się przygotować pliku do przeciągnięcia.',
        });
        event.preventDefault();
      }
    }
  };

  const handleDragMidiEnd = () => {
    if (dragUrlRef.current) {
      URL.revokeObjectURL(dragUrlRef.current);
      dragUrlRef.current = null;
    }
  };

  const exportJson = () => {
    const currentMelody = melody?.melody ?? [];
    const exportData = currentMelody.map(n => ({
      note: n.note,
      start: n.start,
      duration: n.duration,
      velocity: n.velocity,
      slide: n.slide,
    }));
    const jsonString = JSON.stringify(exportData, null, 2);
    navigator.clipboard.writeText(jsonString).then(
      () => {
        toast({ title: 'JSON Skopiowany', description: 'Dane nut zostały skopiowane do schowka.' });
      },
      () => {
        toast({ variant: 'destructive', title: 'Błąd', description: 'Nie udało się skopiować danych JSON.' });
      },
    );
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
      toast({ title: 'MIDI Zaimportowane', description: 'Twoja kompozycja została załadowana.' });
    } catch (error) {
      console.error('Error parsing MIDI file:', error);
      toast({
        variant: 'destructive',
        title: 'Błąd wczytywania MIDI',
        description: 'Nie udało się wczytać pliku MIDI.',
      });
      return;
    } finally {
      if (event.target) {
        event.target.value = '';
      }
    }
  };

  const handleGenerateMelody = async (
    prompt: string,
    key: string,
    useExample: boolean,
    chordProgression?: string,
    youtubeUrl?: string,
    exampleMelodyInput?: MelodyNote[],
    generationMeasures?: number,
    tempo?: number,
    intensifyDarkness?: boolean,
    generationGridResolution?: number,
  ): Promise<void> => {
    if (isPlaying) {
      Tone.Transport.stop();
      Tone.Transport.cancel();
      scheduledEventsRef.current.forEach(id => Tone.Transport.clear(id));
      scheduledEventsRef.current = [];
      setIsPlaying(false);
      setPlayPosition(0);
    }

    const targetMeasures = generationMeasures ?? measures;
    let exampleMelody: MelodyNote[] | undefined = exampleMelodyInput;

    if (selectedMidiExample) {
      const result = await loadMidiFileAction(selectedMidiExample);
      if (result.data) {
        exampleMelody = result.data;
        toast({
          title: 'Inspiracja Załadowana',
          description: `Użyto pliku ${selectedMidiExample} jako inspiracji.`,
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Błąd wczytywania MIDI',
          description: result.error || 'Nie udało się wczytać pliku MIDI.',
        });
        return;
      }
    } else if (useExample && !exampleMelody) {
      const C4_INDEX = noteToIndex('C4');
      const C6_INDEX = noteToIndex('C6');

      const gridMelody = notes
        .filter(note => typeof note.pitch === 'number' && note.pitch >= C4_INDEX && note.pitch <= C6_INDEX)
        .map(note => ({
          note: indexToNote(note.pitch as number),
          start: note.start,
          duration: note.duration,
          velocity: note.velocity,
          slide: note.slide ?? false,
        }));

      if (gridMelody.length > 0) {
        exampleMelody = gridMelody;
      }
    }

    await onGenerateMelody(
      prompt,
      key,
      useExample,
      chordProgression,
      youtubeUrl,
      exampleMelody,
      targetMeasures,
      tempo,
      intensifyDarkness,
      generationGridResolution ?? gridResolution,
    );
    setLastPrompt(prompt);
    setLastKey(key);
    setLastChordProgression(chordProgression);
    setLastIntensifyDarkness(Boolean(intensifyDarkness));
    setFeedbackState('idle');
    setNegativeReason('quality');
    setNegativeNotes('');
    setIsFeedbackDialogOpen(false);
  };

  const latestComposition = melody;

  const canSendFeedback = Boolean(
    latestComposition &&
      latestComposition.melody?.length > 0 &&
      lastPrompt &&
      lastKey
  );

  const handleSendPositiveFeedback = () => {
    if (!canSendFeedback || !latestComposition) {
      return;
    }
    startSendPositive(async () => {
      setIsSubmittingFeedback(true);
      const result = await submitFeedbackAction({
        rating: 'up',
        prompt: lastPrompt,
        key: lastKey,
        measures,
        tempo: bpm,
        gridResolution,
        chordProgression: lastChordProgression,
        intensifyDarkness: lastIntensifyDarkness,
        melody: latestComposition,
      });
      setIsSubmittingFeedback(false);
      if (!result.ok) {
        toast({
          title: 'Nie udało się zapisać opinii',
          description: result.error,
          variant: 'destructive',
        });
        return;
      }
      setFeedbackState('upvoted');
      toast({
        title: 'Dzięki za opinię!',
        description: 'Ta melodia zostanie użyta jako przykład do kolejnych generacji.',
      });
    });
  };

  const handleOpenNegativeFeedback = () => {
    if (!canSendFeedback) {
      return;
    }
    setIsFeedbackDialogOpen(true);
  };

  const handleSubmitNegativeFeedback = () => {
    if (!canSendFeedback || !latestComposition) {
      return;
    }
    startSendNegative(async () => {
      setIsSubmittingFeedback(true);
      const result = await submitFeedbackAction({
        rating: 'down',
        prompt: lastPrompt,
        key: lastKey,
        measures,
        tempo: bpm,
        gridResolution,
        chordProgression: lastChordProgression,
        intensifyDarkness: lastIntensifyDarkness,
        reason: negativeReason,
        notes: negativeNotes,
        melody: latestComposition,
      });
      setIsSubmittingFeedback(false);
      if (!result.ok) {
        toast({
          title: 'Nie udało się zapisać opinii',
          description: result.error,
          variant: 'destructive',
        });
        return;
      }
      setFeedbackState('downvoted');
      setIsFeedbackDialogOpen(false);
      toast({
        title: 'Dzięki za opinię!',
        description: 'Twoja uwaga pomoże ulepszyć przyszłe melodie.',
      });
    });
  };

  const handleTimelineWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    setCellPx(prev => Math.max(10, Math.min(100, prev * zoomFactor)));
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

  const selectedNote = notes.find(n => n.id === selectedNoteId);

  return (
    <div className="flex flex-col h-full w-full font-body bg-background text-foreground relative">
      {isGenerating && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="flex flex-col items-center gap-6 w-80">
            <Disc3 className="w-24 h-24 text-primary animate-spin" />
            {generationProgress !== undefined ? (
              <div className="relative w-full">
                <Progress value={generationProgress} className="w-full h-5" />
                <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-primary-foreground">
                  {generationStep || 'Generowanie melodii...'}
                </span>
              </div>
            ) : (
              <p className="text-xl text-primary-foreground">{generationStep || 'Generowanie melodii...'}</p>
            )}
          </div>
        </div>
      )}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleMidiFileChange}
        accept=".mid,.midi"
        className="hidden"
        title="Wybierz plik MIDI"
      />
      <Toolbar
        isPlaying={isPlaying}
        onPlayToggle={handlePlayToggle}
        onImportMidiClick={handleImportMidiClick}
        onExportMidi={exportMidi}
        onDragMidiStart={handleDragMidiStart}
        onDragMidiEnd={handleDragMidiEnd}
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
                  <Timeline beats={gridBeats} cellPx={cellPx} onWheel={handleTimelineWheel} />
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
                    beats={gridBeats}
                    cellPx={cellPx}
                    verticalZoom={verticalZoom}
                    playPosition={playPosition}
                    onAddNote={addNote}
                    onUpdateNote={updateNote}
                    getNote={getNote}
                    selectedNoteId={selectedNoteId}
                    onSelectNote={setSelectedNoteId}
                    gridResolution={gridResolution}
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
          isFetchingChords={isFetchingChords}
          selectedChordProgression={selectedChordProgression}
          setSelectedChordProgression={setSelectedChordProgression}
          currentKey={currentKey}
          setCurrentKey={setCurrentKey}
          midiExamples={midiExamples}
          selectedMidiExample={selectedMidiExample}
          setSelectedMidiExample={setSelectedMidiExample}
          bpm={bpm}
          gridResolution={gridResolution}
          setGridResolution={setGridResolution}
        />
      </div>

      <div className="border-t bg-card/60 backdrop-blur-sm p-4 flex flex-col gap-3">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">Jak oceniasz tę melodię?</h3>
            <p className="text-xs text-muted-foreground">
              Opcjonalnie podziel się opinią – pomoże to ulepszyć kolejne generacje.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={feedbackState === 'upvoted' ? 'secondary' : 'outline'}
              size="sm"
              disabled={!canSendFeedback || feedbackState === 'upvoted' || isSubmittingFeedback || isSendPositivePending}
              onClick={handleSendPositiveFeedback}
              className="flex items-center gap-1"
            >
              {isSubmittingFeedback && (isSendPositivePending || feedbackState === 'submitting') ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ThumbsUp className="h-4 w-4" />
              )}
              <span>Kciuk w górę</span>
            </Button>
            <Button
              variant={feedbackState === 'downvoted' ? 'secondary' : 'outline'}
              size="sm"
              disabled={!canSendFeedback || feedbackState === 'downvoted'}
              onClick={handleOpenNegativeFeedback}
              className="flex items-center gap-1"
            >
              <ThumbsDown className="h-4 w-4" />
              <span>Kciuk w dół</span>
            </Button>
          </div>
        </div>
        {feedbackState === 'upvoted' && (
          <p className="text-xs text-emerald-600 dark:text-emerald-400">
            ✓ Dodano do zestawu przykładów – dzięki!
          </p>
        )}
        {feedbackState === 'downvoted' && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            ✓ Zapisano uwagę. Postaramy się poprawić kolejne generacje.
          </p>
        )}
        {!canSendFeedback && (
          <p className="text-xs text-muted-foreground">
            Wygeneruj melodię, aby móc ją ocenić.
          </p>
        )}
      </div>

      <Dialog open={isFeedbackDialogOpen} onOpenChange={setIsFeedbackDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Co było nie tak?</DialogTitle>
            <DialogDescription>
              Wybierz powód i opcjonalnie opisz szczegóły, abyśmy mogli poprawić przyszłe wyniki.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Powód</Label>
              <RadioGroup value={negativeReason} onValueChange={value => setNegativeReason(value as typeof negativeReason)}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="quality" id="negative-quality" />
                  <Label htmlFor="negative-quality">Słaba jakość / nudna melodia</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="prompt_mismatch" id="negative-mismatch" />
                  <Label htmlFor="negative-mismatch">Nie pasuje do promptu</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="other" id="negative-other" />
                  <Label htmlFor="negative-other">Inny powód</Label>
                </div>
              </RadioGroup>
            </div>
            <div className="space-y-2">
              <Label htmlFor="negative-notes">Dodatkowe informacje (opcjonalnie)</Label>
              <Textarea
                id="negative-notes"
                value={negativeNotes}
                onChange={e => setNegativeNotes(e.target.value)}
                placeholder="np. zbyt jasna tonacja, za mało rytmu, itp."
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setIsFeedbackDialogOpen(false)}
              disabled={isSubmittingFeedback || isSendNegativePending}
            >
              Anuluj
            </Button>
            <Button
              onClick={handleSubmitNegativeFeedback}
              disabled={isSubmittingFeedback || isSendNegativePending}
              className="flex items-center gap-2"
            >
              {(isSubmittingFeedback && isSendNegativePending) ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Wyślij opinię
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
