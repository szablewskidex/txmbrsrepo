'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { PianoRoll } from '@/components/piano-roll/PianoRoll';
import type { GenerateFullCompositionOutput, MelodyNote } from '@/lib/schemas';
import {
  generateMelodyAction,
  analyzeAndGenerateAction,
} from '@/app/ai-actions';
import { useGenerationProgress } from '@/hooks/useGenerationProgress';

export default function Home() {
  const [melody, setMelody] = useState<GenerateFullCompositionOutput | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [overlayStep, setOverlayStep] = useState<string | undefined>(undefined);
  const [suppressProgress, setSuppressProgress] = useState(false);
  const { progress, status, start, stop, reset } = useGenerationProgress();
  const cancelGenerationRef = useRef(false);
  const overlayClearTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restoreOverlayTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (overlayClearTimeoutRef.current) {
        clearTimeout(overlayClearTimeoutRef.current);
        overlayClearTimeoutRef.current = null;
      }
      if (restoreOverlayTimeoutRef.current) {
        clearTimeout(restoreOverlayTimeoutRef.current);
        restoreOverlayTimeoutRef.current = null;
      }
    };
  }, []);

  const cancelGeneration = useCallback(
    (reason: string) => {
      if (!isGenerating) {
        return;
      }

      cancelGenerationRef.current = true;

      if (overlayClearTimeoutRef.current) {
        clearTimeout(overlayClearTimeoutRef.current);
        overlayClearTimeoutRef.current = null;
      }

      if (restoreOverlayTimeoutRef.current) {
        clearTimeout(restoreOverlayTimeoutRef.current);
        restoreOverlayTimeoutRef.current = null;
      }

      setOverlayStep(reason);
      setIsGenerating(false);
      setSuppressProgress(true);
      stop();
      reset();

      restoreOverlayTimeoutRef.current = setTimeout(() => {
        setOverlayStep(undefined);
        setSuppressProgress(false);
      }, 1500);
    },
    [isGenerating, reset, stop],
  );

  useEffect(() => {
    const handlePageHide = () => {
      cancelGeneration('Generowanie przerwane – karta zamknięta');
    };

    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('beforeunload', handlePageHide);

    return () => {
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('beforeunload', handlePageHide);
    };
  }, [cancelGeneration]);

  const handleGenerateMelody = async (
    prompt: string,
    key: string,
    useExample: boolean,
    chordProgression?: string,
    youtubeUrl?: string,
    exampleMelody?: MelodyNote[],
    generationMeasures?: number,
    tempo?: number,
    intensifyDarkness?: boolean,
    gridResolution?: number,
  ) => {
    setIsGenerating(true);
    setOverlayStep('Łączenie z modelem...');
    setSuppressProgress(false);
    start();

    cancelGenerationRef.current = false;

    if (restoreOverlayTimeoutRef.current) {
      clearTimeout(restoreOverlayTimeoutRef.current);
      restoreOverlayTimeoutRef.current = null;
    }

    if (overlayClearTimeoutRef.current) {
      clearTimeout(overlayClearTimeoutRef.current);
    }

    overlayClearTimeoutRef.current = setTimeout(() => {
      setOverlayStep(undefined);
    }, 600);

    let encounteredError = false;

    try {
      const trimmedPrompt = prompt.trim();
      const promptWithKey = key ? `${trimmedPrompt} (${key})` : trimmedPrompt;

      if (youtubeUrl && youtubeUrl.trim().length > 0) {
        const youtubePayload: any = {
          youtubeUrl: youtubeUrl.trim(),
          targetPrompt: promptWithKey,
          measures: generationMeasures ?? 8,
        };
        const result = await analyzeAndGenerateAction(youtubePayload);

        if (result.error) {
          throw new Error(result.error);
        }

        setMelody(result.data ?? null);
      } else {
        const result = await generateMelodyAction({
          prompt: promptWithKey,
          chordProgression,
          exampleMelody: useExample ? exampleMelody ?? [] : undefined,
          measures: generationMeasures ?? 8,
          tempo,
          intensifyDarkness,
          gridResolution,
        });

        if (result.error) {
          throw new Error(result.error);
        }

        if (!cancelGenerationRef.current) {
          setMelody(result.data ?? null);
        }
      }

      if (overlayClearTimeoutRef.current) {
        clearTimeout(overlayClearTimeoutRef.current);
        overlayClearTimeoutRef.current = null;
      }
      setOverlayStep('Gotowe!');
      stop();
    } catch (error) {
      encounteredError = true;
      console.error('Błąd generowania melodii:', error);
      if (overlayClearTimeoutRef.current) {
        clearTimeout(overlayClearTimeoutRef.current);
        overlayClearTimeoutRef.current = null;
      }
      if (cancelGenerationRef.current) {
        return;
      }
      setOverlayStep('Błąd generowania – sprawdź konsolę.');
      setSuppressProgress(true);
      reset();
    } finally {
      if (cancelGenerationRef.current) {
        return;
      }

      const cleanupDelay = encounteredError ? 2000 : 500;

      if (overlayClearTimeoutRef.current) {
        clearTimeout(overlayClearTimeoutRef.current);
        overlayClearTimeoutRef.current = null;
      }

      setTimeout(() => {
        setIsGenerating(false);
        setOverlayStep(undefined);
        setSuppressProgress(false);
        reset();
      }, cleanupDelay);
    }
  };

  const progressValue = !isGenerating || suppressProgress ? undefined : progress;
  const stepValue = isGenerating ? (overlayStep ?? status ?? 'Łączenie z modelem...') : undefined;

  return (
    <main className="h-screen w-screen overflow-hidden">
      <PianoRoll
        melody={melody}
        setMelody={setMelody}
        isGenerating={isGenerating}
        generationProgress={progressValue}
        generationStep={stepValue}
        onGenerateMelody={handleGenerateMelody}
      />
    </main>
  );
}
