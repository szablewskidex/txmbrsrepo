interface NoteLike {
  note: string;
  start: number;
  duration: number;
  velocity: number;
  slide: boolean;
}

export function applyGuitarStrum(
  notes: NoteLike[],
  direction: 'up' | 'down',
  step: number,
  velocitySwing = 6
): NoteLike[] {
  if (notes.length === 0) return notes;

  const groupedByStart = new Map<number, NoteLike[]>();
  notes.forEach(note => {
    const key = Number(note.start.toFixed(6));
    const group = groupedByStart.get(key) ?? [];
    group.push(note);
    groupedByStart.set(key, group);
  });

  const result: NoteLike[] = [];

  groupedByStart.forEach(group => {
    if (group.length <= 1) {
      result.push(...group.map(n => ({ ...n, slide: Boolean(n.slide) })));
      return;
    }

    const sorted = [...group].sort((a, b) => a.note.localeCompare(b.note));
    const ordered = direction === 'down' ? sorted.slice().reverse() : sorted;
    
    ordered.forEach((note, index) => {
      const offset = step * index;
      result.push({
        ...note,
        start: note.start + offset,
        velocity: Math.max(1, Math.min(127, note.velocity + ((index % 2 === 0 ? 1 : -1) * velocitySwing))),
        slide: Boolean(note.slide),
      });
    });
  });

  return result
    .sort((a, b) => a.start - b.start || a.note.localeCompare(b.note))
    .map(note => ({ ...note, slide: Boolean(note.slide) }));
}
