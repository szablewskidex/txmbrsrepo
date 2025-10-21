"use client";

import React from 'react';

interface TimelineProps {
  beats: number;
  cellPx: number;
  onWheel: (e: React.WheelEvent) => void;
  scrollLeft: number;
}

export function Timeline({ beats, cellPx, onWheel, scrollLeft }: TimelineProps) {
  const totalWidth = beats * cellPx;
  const measures = React.useMemo(
    () => Array.from({ length: Math.floor(beats / 4) }, (_, i) => i + 1),
    [beats],
  );
  const beatLines = React.useMemo(
    () => Array.from({ length: beats + 1 }, (_, i) => i),
    [beats],
  );
  const measureWidth = 4 * cellPx;

  return (
    <div className="relative h-6 bg-card border-b select-none overflow-hidden">
      <div
        className="absolute inset-y-0 cursor-ew-resize"
        style={{ width: totalWidth, transform: `translateX(-${scrollLeft}px)` }}
        onWheel={onWheel}
      >
        {beatLines.map(beat => {
          const isMeasureLine = beat % 4 === 0;
          return (
            <div
              key={`tl-line-${beat}`}
              className="absolute top-0 bottom-0"
              style={{
                left: beat * cellPx,
                width: isMeasureLine ? 2 : 1,
                backgroundColor: `hsl(var(--border) / ${isMeasureLine ? 0.9 : 0.45})`,
              }}
            />
          );
        })}
        {measures.map(measure => (
          <div
            key={`tl-label-${measure}`}
            className="absolute top-0 flex h-full items-center justify-center text-xs text-muted-foreground"
            style={{
              left: (measure - 1) * measureWidth,
              transform: 'translateX(-50%)',
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            {measure}
          </div>
        ))}
      </div>
    </div>
  );
}
