'use client';

import React from 'react';

interface TimelineProps {
  beats: number;
  cellPx: number;
}

export function Timeline({ beats, cellPx }: TimelineProps) {
  const totalWidth = beats * cellPx;
  const measures = Array.from({ length: Math.floor(beats / 4) }, (_, i) => i + 1);

  return (
    <div
      className="relative h-6 bg-card border-b select-none"
      style={{ width: totalWidth }}
    >
      {measures.map(measure => (
        <div
          key={measure}
          className="absolute top-0 flex items-center justify-start h-full px-2 text-xs text-muted-foreground border-r"
          style={{
            left: (measure - 1) * 4 * cellPx,
            width: 4 * cellPx,
          }}
        >
          {measure}
        </div>
      ))}
    </div>
  );
}
