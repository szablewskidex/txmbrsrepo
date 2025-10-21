'use client';

import React, { useRef, useCallback, useState } from 'react';
import type { Note, GhostNote } from '@/lib/types';
import { PIANO_KEYS, ROW_HEIGHT } from '@/lib/constants';
import { NoteItem } from './NoteItem';

interface GridProps {
  notes: Note[];
  ghostNotes: GhostNote[];
  beats: number;
  cellPx: number;
  verticalZoom: number;
  playPosition: number;
  selectedNoteIds: number[];
  onAddNote: (start: number, pitch: number) => void;
  onUpdateNote: (id: number, patch: Partial<Note>) => void;
  onRemoveNote: (id: number) => void;
  getNote: (id: number) => Note | undefined;
  onSelectionChange: (ids: number[], activeId?: number | null) => void;
  gridResolution: number;
}

type DragState = {
  type: 'move' | 'resize';
  id: number;
  startX: number;
  startY: number;
  originalNote: Note;
};

export function Grid({
  notes,
  ghostNotes,
  beats,
  cellPx,
  verticalZoom,
  playPosition,
  selectedNoteIds,
  onAddNote,
  onUpdateNote,
  onRemoveNote,
  getNote,
  onSelectionChange,
  gridResolution,
}: GridProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const selectionStateRef = useRef({
    isSelecting: false,
    startX: 0,
    startY: 0,
    moved: false,
    preventClick: false,
  });
  const [selectionBox, setSelectionBox] = useState<{ left: number; top: number; width: number; height: number } | null>(null);

  const gridWidth = beats * cellPx;
  const gridHeight = PIANO_KEYS.length * ROW_HEIGHT * verticalZoom;
  const beatsPerMeasure = 4;
  const majorGridSize = cellPx * beatsPerMeasure;
  const minorGridSize = cellPx;
  const subdivisionSize = cellPx * gridResolution;

  const handleMouseUp = useCallback(() => {
    if (dragRef.current) {
      dragRef.current = null;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    }
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragRef.current || !gridRef.current) return;

    const { type, id, startX, startY, originalNote } = dragRef.current;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    const gridCellHeight = ROW_HEIGHT * verticalZoom;

    if (type === 'move') {
      const deltaBeats = Math.round(dx / cellPx);
      const deltaPitch = -Math.round(dy / gridCellHeight);

      const newStart = Math.max(0, originalNote.start + deltaBeats);
      const newPitch = Math.max(0, Math.min(PIANO_KEYS.length - 1, originalNote.pitch + deltaPitch));

      onUpdateNote(id, { start: newStart, pitch: newPitch });
    } else if (type === 'resize') {
      const deltaBeats = dx / cellPx;
      const newDuration = Math.max(0.25, Math.round((originalNote.duration + deltaBeats) * 4) / 4);
      onUpdateNote(id, { duration: newDuration });
    }
  }, [cellPx, verticalZoom, onUpdateNote]);

  const handleSelectionMouseMove = useCallback((event: MouseEvent) => {
    const state = selectionStateRef.current;
    const grid = gridRef.current;
    if (!state.isSelecting || !grid) return;

    const currentX = event.clientX;
    const currentY = event.clientY;
    const dx = currentX - state.startX;
    const dy = currentY - state.startY;

    if (!state.moved) {
      if (Math.abs(dx) < 2 && Math.abs(dy) < 2) {
        return;
      }
      state.moved = true;
    }

    const rect = grid.getBoundingClientRect();
    const x1 = Math.min(state.startX, currentX) - rect.left;
    const x2 = Math.max(state.startX, currentX) - rect.left;
    const y1 = Math.min(state.startY, currentY) - rect.top;
    const y2 = Math.max(state.startY, currentY) - rect.top;

    const left = Math.max(0, Math.min(x1, gridWidth));
    const right = Math.max(0, Math.min(x2, gridWidth));
    const top = Math.max(0, Math.min(y1, gridHeight));
    const bottom = Math.max(0, Math.min(y2, gridHeight));

    const normalizedLeft = Math.min(left, right);
    const normalizedTop = Math.min(top, bottom);
    const width = Math.max(0, Math.abs(right - left));
    const height = Math.max(0, Math.abs(bottom - top));

    const box = {
      left: normalizedLeft,
      top: normalizedTop,
      width,
      height,
    };

    setSelectionBox(box);

    const boxRight = box.left + box.width;
    const boxBottom = box.top + box.height;

    const selectedIds = notes
      .filter(note => {
        const noteLeft = note.start * cellPx;
        const noteRight = noteLeft + note.duration * cellPx;
        const noteTop = (PIANO_KEYS.length - 1 - note.pitch) * ROW_HEIGHT * verticalZoom;
        const noteBottom = noteTop + ROW_HEIGHT * verticalZoom;

        return !(noteRight < box.left || noteLeft > boxRight || noteBottom < box.top || noteTop > boxBottom);
      })
      .map(note => note.id);

    onSelectionChange(selectedIds, selectedIds[selectedIds.length - 1] ?? null);
  }, [cellPx, gridHeight, gridWidth, notes, onSelectionChange, verticalZoom]);

  const handleSelectionMouseUp = useCallback(() => {
    const state = selectionStateRef.current;
    if (!state.isSelecting) return;

    window.removeEventListener('mousemove', handleSelectionMouseMove);
    window.removeEventListener('mouseup', handleSelectionMouseUp);

    const wasDrag = state.moved;
    state.isSelecting = false;
    state.moved = false;
    state.preventClick = wasDrag;
    setSelectionBox(null);

    if (!wasDrag) {
      onSelectionChange([]);
    }

    window.setTimeout(() => {
      state.preventClick = false;
    }, 0);
  }, [handleSelectionMouseMove, onSelectionChange]);

  const handleNoteMouseDown = useCallback((e: React.MouseEvent, noteId: number, type: 'move' | 'resize') => {
    if (e.button !== 0) {
      return;
    }
    e.stopPropagation();
    const originalNote = getNote(noteId);
    if (!originalNote) return;

    onSelectionChange([noteId], noteId);
    dragRef.current = { type, id: noteId, startX: e.clientX, startY: e.clientY, originalNote };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [getNote, onSelectionChange, handleMouseMove, handleMouseUp]);


  const handleGridClick = useCallback((e: React.MouseEvent) => {
    if (selectionStateRef.current.preventClick) {
      selectionStateRef.current.preventClick = false;
      return;
    }
    if (e.target !== gridRef.current || !gridRef.current) return;

    const rect = gridRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const start = x / cellPx;
    const pitch = PIANO_KEYS.length - 1 - Math.floor(y / (ROW_HEIGHT * verticalZoom));

    if (pitch >= 0 && pitch < PIANO_KEYS.length) {
      onAddNote(start, pitch);
    }
  }, [cellPx, onAddNote, verticalZoom]);

  const handleGridMouseDown = useCallback((e: React.MouseEvent) => {
    if (!gridRef.current) return;

    if (e.button === 2) {
      e.preventDefault();
      onSelectionChange([]);
      return;
    }

    if (e.button === 0 && e.target === gridRef.current) {
      const state = selectionStateRef.current;
      state.isSelecting = true;
      state.startX = e.clientX;
      state.startY = e.clientY;
      state.moved = false;
      state.preventClick = false;
      setSelectionBox(null);
      onSelectionChange([]);
      window.addEventListener('mousemove', handleSelectionMouseMove);
      window.addEventListener('mouseup', handleSelectionMouseUp);
    }
  }, [handleSelectionMouseMove, handleSelectionMouseUp, onSelectionChange]);

  return (
    <div
      ref={gridRef}
      className="absolute left-0 top-0 bg-background"
      style={{
        width: gridWidth,
        height: gridHeight,
        backgroundImage: `
          linear-gradient(to right, hsl(var(--border) / 0.8) 2px, transparent 2px),
          linear-gradient(to right, hsl(var(--border) / 0.5) 1px, transparent 1px),
          linear-gradient(to right, hsl(var(--border) / 0.2) 1px, transparent 1px),
          linear-gradient(to bottom, hsl(var(--border)) 1px, transparent 1px)
        `,
        backgroundSize: `
          ${majorGridSize}px 100%,
          ${minorGridSize}px 100%,
          ${subdivisionSize}px 100%,
          100% ${ROW_HEIGHT * verticalZoom}px
        `,
        backgroundPosition: '0 0, 0 0, 0 0, 0 0',
      }}
      onClick={handleGridClick}
      onMouseDown={handleGridMouseDown}
      onContextMenu={e => e.preventDefault()}
    >
      {selectionBox && (
        <div
          className="absolute z-30 border border-primary/60 bg-primary/15"
          style={{
            left: selectionBox.left,
            top: selectionBox.top,
            width: selectionBox.width,
            height: selectionBox.height,
            pointerEvents: 'none',
          }}
        />
      )}

      <div
        className="absolute top-0 w-0.5 bg-accent/70 z-20"
        style={{ left: playPosition * cellPx, height: gridHeight }}
      />

      {ghostNotes.map((note, i) => (
        <div
          key={`g-${i}`}
          className="absolute bg-primary/20 rounded-sm"
          style={{
            left: note.start * cellPx,
            top: (PIANO_KEYS.length - 1 - note.pitch) * ROW_HEIGHT * verticalZoom,
            width: note.duration * cellPx,
            height: ROW_HEIGHT * verticalZoom,
          }}
        />
      ))}

      {notes.map(note => (
        <NoteItem
          key={note.id}
          note={note}
          cellPx={cellPx}
          verticalZoom={verticalZoom}
          isSelected={selectedNoteIds.includes(note.id)}
          onMouseDown={handleNoteMouseDown}
        />
      ))}
    </div>
  );
}
