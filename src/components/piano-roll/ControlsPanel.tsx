'use client';

import React, { useState } from 'react';
import type { Note } from '@/lib/types';
import { indexToNote } from '@/lib/music';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Sparkles, Trash2 } from 'lucide-react';

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
  onGenerateMelody: (prompt: string) => Promise<void>;
  isGenerating: boolean;
}

export function ControlsPanel({
  beats, setBeats, cellPx, setCellPx, verticalZoom, setVerticalZoom,
  selectedNote, onRemoveNote, onUpdateNote, onGenerateMelody, isGenerating
}: ControlsPanelProps) {
  const [prompt, setPrompt] = useState('');

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt || isGenerating) return;
    await onGenerateMelody(prompt);
    setPrompt('');
  };

  return (
    <div className="w-64 bg-card border-l p-4 flex flex-col gap-4 overflow-y-auto shrink-0">
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
            <CardDescription>{indexToNote(selectedNote.pitch)} @ Takt {selectedNote.start}</CardDescription>
          </Header>
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
          <CardDescription>Wygeneruj melodię z opisu tekstowego.</CardDescription>
        </CardHeader>
        <form onSubmit={handleGenerate}>
          <CardContent>
            <Textarea
              placeholder="np. mroczna melodia trapowa w A-moll, 140 bpm"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="min-h-[80px]"
            />
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={isGenerating || !prompt}>
              {isGenerating ? 'Generowanie...' : 'Generuj melodię'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
