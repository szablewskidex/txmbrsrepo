'use client';

import React from 'react';
import type { Note } from '@/lib/types';
import { indexToNote } from '@/lib/music';
import { cn } from '@/lib/utils';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

interface EventEditorProps {
  notes: Note[];
  selectedNoteId: number | null;
  onUpdateNote: (id: number, patch: Partial<Note>) => void;
  cellPx: number;
}

export function EventEditor({ notes, selectedNoteId, onUpdateNote, cellPx }: EventEditorProps) {
  const sortedNotes = React.useMemo(() => [...notes].sort((a, b) => a.start - b.start), [notes]);
  const totalWidth = Math.max(...notes.map(n => (n.start + n.duration) * cellPx), 0);
  
  return (
    <div className="h-36 bg-card border-t shrink-0 flex flex-col p-2">
      <h3 className="text-xs text-muted-foreground px-2">Event Editor: Velocity</h3>
      <ScrollArea className="flex-1 whitespace-nowrap">
        <div className="h-full w-full relative pt-2" style={{ width: totalWidth || '100%' }}>
          <div className="h-full flex items-end gap-px">
            {sortedNotes.map(note => (
              <div
                key={note.id}
                title={`${indexToNote(note.pitch)} | Velocity: ${note.velocity}`}
                className={cn(
                    "bg-primary/70 hover:bg-accent transition-colors rounded-t-sm",
                    note.id === selectedNoteId && "bg-accent ring-1 ring-accent"
                )}
                style={{
                  position: 'absolute',
                  left: note.start * cellPx,
                  bottom: 0,
                  height: `${(note.velocity / 127) * 100}%`,
                  width: note.duration * cellPx,
                }}
              />
            ))}
          </div>
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}
