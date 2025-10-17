'use client';

import React, { useState, useEffect } from 'react';
import type { Note } from '@/lib/types';
import { indexToNote } from '@/lib/music';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sparkles, Trash2, Youtube } from 'lucide-react';
import { Input } from '../ui/input';
import { cn } from '@/lib/utils';
import { ALL_KEYS } from '@/lib/constants';

interface ControlsPanelProps {
  beats: number;
  setBeats: (value: number) => void;
  cellPx: number;
  setCellPx: (value: number) => void;
  verticalZoom: number;
  setVerticalZoom: (value: number) => void;
  selectedNote: Note | undefined;
  onRemoveNote: (id: number) => void;
  onUpdateNote: (id: number, patch: Partial<Note>) => void;
  onGenerateMelody: (prompt: string, useExample: boolean, chordProgression?: string, youtubeUrl?: string) => Promise<void>;
  isGenerating: boolean;
  chordProgressions: string[];
  currentKey: string;
  setCurrentKey: (key: string) => void;
}

export function ControlsPanel({
  beats, setBeats, cellPx, setCellPx, verticalZoom, setVerticalZoom,
  selectedNote, onRemoveNote, onUpdateNote, onGenerateMelody, isGenerating,
  chordProgressions, currentKey, setCurrentKey
}: ControlsPanelProps) {
  const [prompt, setPrompt] = useState('dark trap melody, 140 bpm');
  const [useExample, setUseExample] = useState(true);
  const [selectedChordProgression, setSelectedChordProgression] = useState<string | undefined>(undefined);
  const [youtubeUrl, setYoutubeUrl] = useState('');

  useEffect(() => {
    if (chordProgressions.length > 0) {
      setSelectedChordProgression(chordProgressions[0]);
    } else {
      setSelectedChordProgression(undefined);
    }
  }, [chordProgressions]);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isGenerating || (!prompt && !youtubeUrl)) return;
    await onGenerateMelody(prompt, useExample, selectedChordProgression, youtubeUrl);
  };

  return (
    <div className="w-80 bg-card border-l p-4 flex flex-col gap-4 overflow-y-auto shrink-0">
      <Card>
        <CardHeader>
          <CardTitle>Ustawienia siatki</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="beats">Takty: {beats}</Label>
            <Slider id="beats" value={[beats]} onValueChange={([v]) => setBeats(v)} min={4} max={64} step={4} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="h-zoom">Zoom poziomy</Label>
            <Slider id="h-zoom" value={[cellPx]} onValueChange={([v]) => setCellPx(v)} min={10} max={100} step={1} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="v-zoom">Zoom pionowy</Label>
            <Slider id="v-zoom" value={[verticalZoom]} onValueChange={([v]) => setVerticalZoom(v)} min={0.5} max={2.5} step={0.1} />
          </div>
        </CardContent>
      </Card>
      
      {selectedNote && (
        <Card>
          <CardHeader>
            <CardTitle>Zaznaczona nuta</CardTitle>
            <CardDescription>{indexToNote(selectedNote.pitch as number)} @ Takt {Math.floor(selectedNote.start)}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
             <div className="space-y-2">
                <Label htmlFor="velocity">Velocity: {selectedNote.velocity}</Label>
                <Slider id="velocity" value={[selectedNote.velocity]} onValueChange={([v]) => onUpdateNote(selectedNote.id, { velocity: v })} min={1} max={127} step={1} />
             </div>
             <div className="flex items-center space-x-2">
                <Switch id="slide-mode" checked={selectedNote.slide} onCheckedChange={(c) => onUpdateNote(selectedNote.id, { slide: c })}/>
                <Label htmlFor="slide-mode">Slide</Label>
            </div>
          </CardContent>
          <CardFooter>
            <Button variant="destructive" size="sm" onClick={() => onRemoveNote(selectedNote.id)}>
              <Trash2 className="mr-2 h-4 w-4" /> Usuń
            </Button>
          </CardFooter>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Sparkles className="text-accent" /> Generator AI</CardTitle>
          <CardDescription>Wygeneruj melodię z opisu tekstowego lub linku YouTube.</CardDescription>
        </CardHeader>
        <form onSubmit={handleGenerate}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="prompt">Prompt</Label>
              <Textarea
                id="prompt"
                placeholder="np. mroczna melodia trapowa w A-moll, 140 bpm"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="min-h-[80px]"
              />
            </div>
             <div className="space-y-2">
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
            <div className="space-y-2">
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
             <div className="space-y-2">
              <Label>Progresja Akordów</Label>
              <Select onValueChange={setSelectedChordProgression} value={selectedChordProgression} disabled={!!youtubeUrl}>
                <SelectTrigger>
                  <SelectValue placeholder="Wybierz progresję..." />
                </SelectTrigger>
                <SelectContent>
                  {chordProgressions.map((prog, i) => (
                    <SelectItem key={i} value={prog}>{prog}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2">
                <Switch id="use-example-mode" checked={useExample} onCheckedChange={setUseExample} disabled={!!youtubeUrl} />
                <Label htmlFor="use-example-mode" className={cn(!!youtubeUrl && "text-muted-foreground")}>Użyj istniejącej melodii jako przykładu</Label>
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={isGenerating || (!prompt && !youtubeUrl)}>
              {isGenerating ? 'Generowanie...' : 'Generuj melodię'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
