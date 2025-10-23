# Piano Roll Quantization Fix

## 🎯 **Problem**
Użytkownik nie może umieszczać nut w pozycjach 1/6, 1/8, 1/12 beat - tylko 1/4. Kwantyzacja powinna być tylko ustawieniem **widoku siatki**, nie ograniczeniem dla AI czy użytkownika.

## 🔍 **Analiza Obecnego Stanu**

### ✅ **Co Działa Dobrze:**
1. **AI Generator** - używa `validateMode: 'preserve'` - może generować dowolne pozycje
2. **Melody Validator** - w preserve mode tylko zaokrągla do 0.01, nie kwantyzuje
3. **Grid Options** - ma opcje 1/6, 1/8, 1/12 beat
4. **addNote Function** - nie ma kwantyzacji, przyjmuje dowolne `start`

### ❌ **Potencjalne Problemy:**
1. **UI Precision** - może kliknięcia nie są wystarczająco precyzyjne
2. **Visual Grid** - siatka może mylić użytkownika
3. **Mouse Event Handling** - może być zaokrąglanie w obliczeniach pozycji

## 🧪 **Test Cases**

### Test 1: Sprawdź precyzję kliknięć
```typescript
// W Grid.tsx - dodaj debug log
const start = x / cellPx;
console.log('Click position:', { x, cellPx, start, gridResolution });
```

### Test 2: Sprawdź czy AI generuje różnorodne pozycje
```typescript
// Sprawdź wygenerowane nuty
notes.forEach(note => {
  const remainder = note.start % 0.25;
  if (remainder !== 0) {
    console.log('Non-quantized note:', note.start, remainder);
  }
});
```

### Test 3: Sprawdź visual grid rendering
- Czy subdivisionSize odpowiada gridResolution?
- Czy linie siatki są w odpowiednich miejscach?

## 🔧 **Potencjalne Rozwiązania**

### 1. **Snap-to-Grid Option**
Dodaj opcję "Snap to Grid" którą użytkownik może włączyć/wyłączyć:

```typescript
const [snapToGrid, setSnapToGrid] = useState(false);

const addNote = useCallback((start: number, pitch: number) => {
  const finalStart = snapToGrid ? quantize(start, gridResolution) : start;
  // ... rest of function
}, [snapToGrid, gridResolution]);
```

### 2. **Improve Click Precision**
Zwiększ precyzję kliknięć przez lepsze obliczenia:

```typescript
const start = Math.round((x / cellPx) * 1000) / 1000; // 3 decimal places
```

### 3. **Visual Feedback**
Dodaj wizualną wskazówkę gdzie zostanie umieszczona nuta:

```typescript
const [ghostNote, setGhostNote] = useState<{start: number, pitch: number} | null>(null);
```

### 4. **Grid Resolution Independence**
Upewnij się, że gridResolution wpływa tylko na wizualizację:

```typescript
// gridResolution should only affect:
// 1. Visual grid lines
// 2. Snap-to-grid (if enabled)
// 3. NOT AI generation
// 4. NOT manual note placement (unless snap enabled)
```

## 🎵 **Expected Behavior**

### **AI Generation:**
- ✅ Może generować nuty w dowolnych pozycjach (0.01 precyzja)
- ✅ Nie jest ograniczone przez gridResolution
- ✅ Może tworzyć triplets, syncopation, itp.

### **Manual Note Placement:**
- ✅ Użytkownik może kliknąć w dowolnym miejscu
- ✅ Nuta zostanie umieszczona dokładnie gdzie kliknął (lub z snap-to-grid jeśli włączone)
- ✅ Może umieszczać nuty między liniami siatki

### **Visual Grid:**
- ✅ Pokazuje linie zgodnie z gridResolution
- ✅ Pomaga w orientacji, ale nie ogranicza
- ✅ Można przełączać między różnymi rozdzielczościami

### **Snap-to-Grid (Optional):**
- ✅ Opcjonalna funkcja dla użytkowników którzy chcą precyzji
- ✅ Można włączyć/wyłączyć
- ✅ Snapuje do aktualnego gridResolution

## 🚀 **Implementation Plan**

1. **Add Debug Logging** - sprawdź gdzie jest problem
2. **Add Snap-to-Grid Toggle** - daj użytkownikowi kontrolę
3. **Improve Click Precision** - lepsze obliczenia pozycji
4. **Visual Feedback** - ghost notes podczas hover
5. **Test with Different Grid Resolutions** - upewnij się że wszystko działa

## 📊 **Success Metrics**

- ✅ Użytkownik może umieścić nutę w pozycji 1.333 (1/6 beat)
- ✅ AI generuje nuty w różnych pozycjach (nie tylko 0.25 multiples)
- ✅ Grid resolution wpływa tylko na wizualizację
- ✅ Snap-to-grid jest opcjonalne i kontrolowane przez użytkownika