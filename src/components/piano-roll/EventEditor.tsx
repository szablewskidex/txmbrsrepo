'use client';

import React from 'react';
import type { Note } from '@/lib/types';
import { indexToNote } from '@/lib/music';
import { cn } from '@/lib/utils';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Button } from '../ui/button';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface EventEditorProps {
  notes: Note[];
  selectedNoteId: number | null;
  onUpdateNote: (id: number, patch: Partial<Note>) => void;
  cellPx: number;
  isCollapsed: boolean;
  onToggleCollapsed: () => void;
}

export function EventEditor({ notes, selectedNoteId, onUpdateNote, cellPx, isCollapsed, onToggleCollapsed }: EventEditorProps) {
  const sortedNotes = React.useMemo(() => [...notes].sort((a, b) => a.start - b.start), [notes]);
  const totalWidth = Math.max(...notes.map(n => (n.start + n.duration) * cellPx), 0);
  
  return (
    <div className={cn(
      'bg-card border-t shrink-0 flex flex-col transition-[height] duration-200 ease-out overflow-hidden',
      isCollapsed ? 'h-12 md:h-28' : 'h-16 sm:h-28 md:h-28'
    )}>
      <div className="flex items-center justify-between px-2 py-1 md:hidden">
        <span className="text-xs font-medium text-muted-foreground">Event Editor: Velocity</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onToggleCollapsed}
          aria-expanded={!isCollapsed}
        >
          {isCollapsed ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </div>
      <div className={cn('flex-1 flex flex-col', isCollapsed ? 'hidden md:flex' : 'flex')}>
        <h3 className="hidden md:block text-xs text-muted-foreground px-3 py-1">Event Editor: Velocity</h3>
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
    </div>
  );
}
