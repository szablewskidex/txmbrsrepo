# 🚀 Migration Guide - Refactored Code

## ✅ Co Zostało Zrobione

1. ✅ Podzielono `generate-melody-from-prompt.ts` (1257 linii → 350 linii)
2. ✅ Utworzono 8 nowych modułów utility
3. ✅ Zachowano pełną kompatybilność wsteczną
4. ✅ Wszystkie testy diagnostyczne przeszły

## 🔄 Czy Musisz Coś Zmienić?

**NIE!** Wszystkie istniejące importy działają bez zmian:

```typescript
// To nadal działa:
import { generateMelodyFromPrompt } from '@/ai/flows/generate-melody-from-prompt';

// To też działa:
import { resetFewShotCache, getTotalEstimatedTokensUsed } from '@/ai/flows/generate-melody-from-prompt';
```

## 📦 Nowe Możliwości

Teraz możesz importować funkcje utility bezpośrednio:

```typescript
// Zamiast duplikować kod, użyj:
import { getMoodFromPrompt, detectInstrumentFromPrompt } from '@/ai/utils/prompt-detection';
import { selectChordProgressionForPrompt } from '@/ai/utils/chord-selection';
import { enhancedAnalyzeMelody } from '@/ai/utils/melody-analysis';
```

## 🧪 Testowanie

Uruchom testy aby upewnić się że wszystko działa:

```bash
# Sprawdź czy nie ma błędów TypeScript
npm run typecheck

# Zbuduj projekt
npm run build

# Uruchom dev server
npm run dev
```

## 🔙 Rollback (jeśli potrzeba)

Jeśli coś nie działa, możesz wrócić do starej wersji:

```bash
# Przywróć stary plik
mv src/ai/flows/generate-melody-from-prompt.ts src/ai/flows/generate-melody-from-prompt-new.ts
mv src/ai/flows/generate-melody-from-prompt.ts.backup src/ai/flows/generate-melody-from-prompt.ts

# Usuń nowe moduły (opcjonalnie)
rm -rf src/ai/utils/
```

## 📝 Zalecane Następne Kroki

### 1. Przetestuj Aplikację (5 min)
- [ ] Uruchom dev server
- [ ] Wygeneruj melodię
- [ ] Sprawdź czy chord progressions działają
- [ ] Sprawdź few-shot learning

### 2. Dodaj Testy Jednostkowe (30 min)
```bash
npm install --save-dev vitest @testing-library/react
```

Przykładowy test:
```typescript
// src/ai/utils/__tests__/prompt-detection.test.ts
import { describe, it, expect } from 'vitest';
import { getMoodFromPrompt, detectInstrumentFromPrompt } from '../prompt-detection';

describe('prompt-detection', () => {
  describe('getMoodFromPrompt', () => {
    it('should detect dark mood', () => {
      expect(getMoodFromPrompt('dark trap beat')).toBe('dark');
    });

    it('should detect bright mood', () => {
      expect(getMoodFromPrompt('happy uplifting melody')).toBe('bright');
    });

    it('should default to neutral', () => {
      expect(getMoodFromPrompt('simple melody')).toBe('neutral');
    });
  });

  describe('detectInstrumentFromPrompt', () => {
    it('should detect piano', () => {
      expect(detectInstrumentFromPrompt('piano melody')).toBe('piano');
    });

    it('should detect guitar', () => {
      expect(detectInstrumentFromPrompt('acoustic guitar')).toBe('guitar');
    });

    it('should return undefined for unknown', () => {
      expect(detectInstrumentFromPrompt('random text')).toBeUndefined();
    });
  });
});
```

### 3. Dodaj JSDoc (15 min)
Dodaj dokumentację do funkcji:

```typescript
/**
 * Detects the mood from a user prompt
 * @param prompt - User's text prompt
 * @param intensifyDarkness - Force dark mood regardless of keywords
 * @returns The detected mood: 'dark', 'bright', or 'neutral'
 * @example
 * ```typescript
 * getMoodFromPrompt('dark trap beat') // returns 'dark'
 * getMoodFromPrompt('happy melody') // returns 'bright'
 * getMoodFromPrompt('simple tune') // returns 'neutral'
 * ```
 */
export function getMoodFromPrompt(prompt: string, intensifyDarkness?: boolean): Mood {
  // ...
}
```

### 4. Monitoruj Performance (opcjonalnie)
Dodaj metryki do krytycznych funkcji:

```typescript
import { logger } from '@/lib/logger';

export function generateMelodyFromPrompt(input: GenerateMelodyInput) {
  const startTime = performance.now();
  
  try {
    // ... existing code
    const result = await generateMelodyFromPromptFlow(input);
    
    logger.info('Melody generated successfully', {
      duration: performance.now() - startTime,
      measures: input.measures,
      hasExample: !!input.exampleMelody,
    });
    
    return result;
  } catch (error) {
    logger.error('Melody generation failed', {
      duration: performance.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
```

## 🎯 Checklist

- [x] Kod zrefactorowany
- [x] Backup utworzony
- [x] Diagnostyka TypeScript OK
- [ ] Testy manualne przeszły
- [ ] Testy jednostkowe dodane (opcjonalnie)
- [ ] JSDoc dodany (opcjonalnie)
- [ ] Performance monitoring (opcjonalnie)

## 📞 Wsparcie

Jeśli napotkasz problemy:

1. Sprawdź `REFACTORING_SUMMARY.md` dla szczegółów
2. Sprawdź `OPTIMIZATION_REPORT.md` dla pełnego raportu
3. Przywróć backup jeśli coś nie działa
4. Otwórz issue z opisem problemu

## 🎉 Gratulacje!

Twój kod jest teraz:
- 72% krótszy w głównym pliku
- Bardziej modułowy
- Łatwiejszy do testowania
- Gotowy na przyszłe rozszerzenia

Happy coding! 🚀
