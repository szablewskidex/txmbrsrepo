'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { PianoRoll } from '@/components/piano-roll/PianoRoll';
import type { GenerateFullCompositionOutput, MelodyNote } from '@/lib/schemas';
import {
  generateMelodyAction,
  analyzeAndGenerateAction,
} from '@/app/ai-actions';
import { useGenerationProgress } from '@/hooks/useGenerationProgress';

const detectMobileDevice = () => {
  if (typeof window === 'undefined') {
    return false;
  }
  const userAgent = window.navigator.userAgent || '';
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const matchesMobileUA = /iphone|ipad|ipod|android|windows phone|blackberry|iemobile/i.test(userAgent);
  const isNarrow = window.matchMedia('(max-width: 768px)').matches;
  return matchesMobileUA || (isTouchDevice && isNarrow);
};

const detectStandalone = () => {
  if (typeof window === 'undefined') {
    return false;
  }
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    ((window.navigator as typeof window.navigator & { standalone?: boolean }).standalone === true)
  );
};

export default function Home() {
  const [melody, setMelody] = useState<GenerateFullCompositionOutput | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [overlayStep, setOverlayStep] = useState<string | undefined>(undefined);
  const [suppressProgress, setSuppressProgress] = useState(false);
  const [isStandalone, setIsStandalone] = useState<boolean>(detectStandalone);
  const [isMobileDevice, setIsMobileDevice] = useState<boolean>(detectMobileDevice);
  const [isClientReady, setIsClientReady] = useState<boolean>(false);
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

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const mobileWidthQuery = window.matchMedia('(max-width: 768px)');

    const detectMobile = () => {
      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      const matchesMobileUA = /iphone|ipad|ipod|android|windows phone|blackberry|iemobile/i.test(window.navigator.userAgent || '');
      setIsMobileDevice(matchesMobileUA || (isTouchDevice && mobileWidthQuery.matches));
    };

    const checkStandalone = () => {
      const standaloneFromMedia = mediaQuery.matches;
      const standaloneFromNavigator = (window.navigator as typeof window.navigator & { standalone?: boolean }).standalone === true;
      setIsStandalone(standaloneFromMedia || standaloneFromNavigator);
    };

    const preventGesture = (event: TouchEvent) => {
      if (event.touches.length > 1) {
        event.preventDefault();
      }
    };

    let lastTouchEnd = 0;
    const preventDoubleTap = (event: TouchEvent) => {
      const now = Date.now();
      if (now - lastTouchEnd <= 300) {
        event.preventDefault();
      }
      lastTouchEnd = now;
    };

    const setViewportHeight = () => {
      document.documentElement.style.setProperty('--app-vh', `${window.innerHeight * 0.01}px`);
    };

    detectMobile();
    checkStandalone();
    setViewportHeight();
    mediaQuery.addEventListener('change', checkStandalone);
    mobileWidthQuery.addEventListener('change', detectMobile);
    window.addEventListener('appinstalled', checkStandalone);
    window.addEventListener('resize', setViewportHeight);
    const orientationHandler = () => {
      setTimeout(setViewportHeight, 220);
    };
    window.addEventListener('orientationchange', orientationHandler);

    document.addEventListener('touchmove', preventGesture, { passive: false });
    const gestureHandler = (event: Event) => event.preventDefault();
    document.addEventListener('gesturestart', gestureHandler);
    document.addEventListener('touchend', preventDoubleTap, { passive: false });

    setIsClientReady(true);

    return () => {
      mediaQuery.removeEventListener('change', checkStandalone);
      mobileWidthQuery.removeEventListener('change', detectMobile);
      window.removeEventListener('appinstalled', checkStandalone);
      window.removeEventListener('resize', setViewportHeight);
      window.removeEventListener('orientationchange', orientationHandler);
      document.removeEventListener('touchmove', preventGesture);
      document.removeEventListener('gesturestart', gestureHandler);
      document.removeEventListener('touchend', preventDoubleTap);
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
    fastMode?: boolean,
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
    }, 250);

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
          fastMode,
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

      const cleanupDelay = encounteredError ? 1500 : 200;

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

  if (!isClientReady) {
    return <main className="min-h-screen w-screen bg-black" />;
  }

  if (isMobileDevice && !isStandalone) {
    return (
      <main className="min-h-screen w-screen bg-gradient-to-br from-black via-zinc-900 to-purple-950 text-foreground flex flex-col items-center justify-center gap-6 px-6 text-center">
        <div className="max-w-md space-y-4">
          <h1 className="text-3xl font-bold tracking-tight">Dodaj PianoRollAI do ekranu głównego</h1>
          <p className="text-sm text-muted-foreground">
            Aby korzystać z aplikacji w trybie pełnoekranowym, dodaj ją do ekranu głównego swojego urządzenia i uruchom z ikony skrótu.
          </p>
          <div className="bg-card/60 border border-white/10 rounded-xl p-4 text-left space-y-3">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-white/70">Android (Chrome)</h2>
              <p className="text-xs text-white/60">Menu ⋮ → „Dodaj do ekranu głównego”, następnie otwórz aplikację z nowej ikony.</p>
            </div>
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-white/70">iOS (Safari)</h2>
              <p className="text-xs text-white/60">Udostępnij → „Dodaj do ekranu domowego”, a potem uruchom z ekranu głównego.</p>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="w-screen overflow-hidden" style={{ minHeight: 'calc(var(--app-vh, 1vh) * 100)' }}>
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
