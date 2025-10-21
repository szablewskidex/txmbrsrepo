'use client';

import React, { useState, useEffect } from 'react';
import type { Note } from '@/lib/types';
import type { MelodyNote } from '@/lib/schemas';
import { indexToNote } from '@/lib/music';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sparkles, Trash2, Youtube } from 'lucide-react';
import { Input } from '../ui/input';
import { cn } from '@/lib/utils';
import { ALL_KEYS, DEFAULT_MEASURES, GRID_OPTIONS, getGridLabel } from '@/lib/constants';

interface ControlsPanelProps {
  measures: number;
  setMeasures: (value: number) => void;
  cellPx: number;
  setCellPx: (value: number) => void;
  verticalZoom: number;
  setVerticalZoom: (value: number) => void;
  selectedNote: Note | undefined;
  selectedNotes: Note[];
  onRemoveNote: (id: number) => void;
  onUpdateNote: (id: number, patch: Partial<Note>) => void;
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
  chordProgressions: string[];
  currentKey: string;
  setCurrentKey: (key: string) => void;
  isFetchingChords: boolean;
  selectedChordProgression?: string;
  setSelectedChordProgression: (value: string | undefined) => void;
  midiExamples: string[];
  selectedMidiExample: string;
  setSelectedMidiExample: (value: string) => void;
  bpm: number;
  gridResolution: number;
  setGridResolution: (value: number) => void;
}

export function ControlsPanel({
  measures,
  setMeasures,
  cellPx,
  setCellPx,
  verticalZoom,
  setVerticalZoom,
  selectedNote,
  selectedNotes,
  onRemoveNote,
  onUpdateNote,
  onGenerateMelody,
  isGenerating,
  chordProgressions,
  currentKey,
  setCurrentKey,
  isFetchingChords,
  selectedChordProgression,
  setSelectedChordProgression,
  midiExamples,
  selectedMidiExample,
  setSelectedMidiExample,
  bpm,
  gridResolution,
  setGridResolution,
}: ControlsPanelProps) {
  const [prompt, setPrompt] = useState('dark trap melody');
  const [useExample, setUseExample] = useState(true);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [intensifyDarkness, setIntensifyDarkness] = useState(false);

  const progressionOptions = Array.isArray(chordProgressions) ? chordProgressions : [];
  const midiOptions = Array.isArray(midiExamples) ? midiExamples : [];
  const selectedMidiOption = selectedMidiExample ?? '';

  useEffect(() => {
    if (!selectedMidiOption && midiOptions.length > 0) {
      setSelectedMidiExample(midiOptions[0]);
    }
  }, [midiOptions, selectedMidiOption, setSelectedMidiExample]);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isGenerating || (!prompt && !youtubeUrl)) return;
    await onGenerateMelody(
      prompt,
      currentKey,
      useExample,
      selectedChordProgression,
      youtubeUrl,
      undefined,
      DEFAULT_MEASURES,
      bpm,
      intensifyDarkness,
      gridResolution,
    );
  };

  return (
    <Tabs defaultValue="grid" className="w-full">
      <TabsList className="grid w-full grid-cols-2 gap-1 bg-card/70 h-9">
        <TabsTrigger className="px-2 py-1 text-xs" value="grid">Siatka</TabsTrigger>
        <TabsTrigger className="px-2 py-1 text-xs" value="generate">Generator</TabsTrigger>
      </TabsList>

      <TabsContent value="grid" className="mt-3">
        <div className="flex flex-col gap-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Ustawienia siatki</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 px-3 pb-3">
              <div className="space-y-1.5">
                <Label htmlFor="measures">Takty: {measures}</Label>
                <Slider id="measures" value={[measures]} onValueChange={([v]) => setMeasures(v)} min={4} max={64} step={4} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="h-zoom">Zoom poziomy</Label>
                <Slider id="h-zoom" value={[cellPx]} onValueChange={([v]) => setCellPx(v)} min={10} max={100} step={1} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="v-zoom">Zoom pionowy</Label>
                <Slider id="v-zoom" value={[verticalZoom]} onValueChange={([v]) => setVerticalZoom(v)} min={0.5} max={2.5} step={0.1} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Kwantyzacja</CardTitle>
              <CardDescription className="text-xs">Dokładność przyciągania nut do siatki.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 px-3 pb-3">
              <div className="space-y-1.5">
                <Label htmlFor="grid-resolution">Grid: {getGridLabel(gridResolution)}</Label>
                <Select
                  value={gridResolution.toString()}
                  onValueChange={value => setGridResolution(parseFloat(value))}
                >
                  <SelectTrigger id="grid-resolution">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GRID_OPTIONS.map(option => (
                      <SelectItem key={option.value} value={option.value.toString()}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[0.68rem] text-muted-foreground">
                  Mniejsze wartości = dokładniejsza siatka (więcej linii)
                </p>
              </div>
            </CardContent>
          </Card>

          {selectedNote ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">
                  {selectedNotes.length > 1 ? `Zaznaczone nuty: ${selectedNotes.length}` : 'Zaznaczona nuta'}
                </CardTitle>
                <CardDescription className="text-xs">
                  {selectedNotes.length > 1
                    ? 'Operacje masowe wpływają na wszystkie zaznaczone nuty.'
                    : 'Operacje dostępne dla aktualnie zaznaczonej nuty.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 px-3 pb-3">
                <div className="space-y-2">
                  <p className="text-sm">
                    {indexToNote(selectedNote.pitch)} — długość {selectedNote.duration.toFixed(2)}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => onUpdateNote(selectedNote.id, { duration: Math.max(0.1, selectedNote.duration * 0.5) })}>
                      Skróć x0.5
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => onUpdateNote(selectedNote.id, { duration: selectedNote.duration * 2 })}>
                      Wydłuż x2
                    </Button>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      const idsToRemove = selectedNotes.length > 0 ? selectedNotes : [selectedNote];
                      idsToRemove.forEach(note => onRemoveNote(note.id));
                    }}
                    className="w-full"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    {selectedNotes.length > 1 ? `Usuń ${selectedNotes.length} nut` : 'Usuń nutę'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </TabsContent>

      <TabsContent value="generate" className="mt-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Generator AI</CardTitle>
            <CardDescription className="text-xs">Wygeneruj melodię z opisu tekstowego lub linku YouTube.</CardDescription>
          </CardHeader>
          <form onSubmit={handleGenerate}>
            <CardContent className="space-y-3 px-3 pb-3">
              <div className="space-y-1.5">
                <Label htmlFor="prompt">Prompt</Label>
                <Textarea
                  id="prompt"
                  placeholder="np. mroczna melodia trapowa w A-moll"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="min-h-[70px]"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="youtube-url">Link YouTube (opcjonalnie)</Label>
                <div className="relative">
                  <Youtube className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="youtube-url"
                    type="url"
                    placeholder="https://www.youtube.com/watch?v=..."
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Tonacja</Label>
                <Select onValueChange={setCurrentKey} value={currentKey} disabled={!!youtubeUrl}>
                  <SelectTrigger>
                    <SelectValue placeholder="Wybierz tonację..." />
                  </SelectTrigger>
                  <SelectContent>
                    {ALL_KEYS.map((key) => (
                      <SelectItem key={key} value={key}>{key}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Progresja Akordów</Label>
                <Select
                  onValueChange={value => setSelectedChordProgression(value)}
                  value={selectedChordProgression}
                  disabled={!!youtubeUrl || isFetchingChords}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={isFetchingChords ? 'Ładowanie...' : 'Wybierz progresję...'} />
                  </SelectTrigger>
                  <SelectContent>
                    {progressionOptions.map((prog, i) => (
                      <SelectItem key={i} value={prog}>
                        {prog}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Przykład MIDI</Label>
                <Select
                  onValueChange={value => setSelectedMidiExample(value)}
                  value={selectedMidiOption}
                  disabled={!!youtubeUrl || midiOptions.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={midiOptions.length === 0 ? 'Brak plików MIDI' : 'Wybierz plik MIDI...'} />
                  </SelectTrigger>
                  <SelectContent>
                    {midiOptions.map(file => (
                      <SelectItem key={file} value={file}>
                        {file}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Switch id="use-example-mode" checked={useExample} onCheckedChange={setUseExample} disabled={!!youtubeUrl} />
                <Label htmlFor="use-example-mode" className={cn(!!youtubeUrl && 'text-muted-foreground')}>Użyj istniejącej melodii jako przykładu</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch id="intensify-darkness" checked={intensifyDarkness} onCheckedChange={setIntensifyDarkness} />
                <Label htmlFor="intensify-darkness">Wzmocnij mroczny klimat</Label>
              </div>
            </CardContent>
            <CardFooter className="px-3 pb-3">
              <Button type="submit" className="w-full" disabled={isGenerating || (!prompt && !youtubeUrl)}>
                {isGenerating ? 'Generowanie...' : 'Generuj melodię'}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
