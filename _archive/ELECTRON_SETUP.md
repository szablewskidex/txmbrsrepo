# Electron Desktop App - PianoRollAI

## ✅ Co zostało zrobione:

1. **Zainstalowane pakiety:**
   - electron
   - electron-builder
   - concurrently, wait-on, cross-env

2. **Utworzone pliki:**
   - `electron/main.js` - główny proces Electron
   - `electron/preload.js` - bridge między Electron a React

3. **Dodane funkcje:**
   - Zapisywanie MIDI z dialog box (Save As)
   - Export bezpośrednio do folderu FL Studio
   - Automatyczne wykrywanie FL Studio MIDI folder

4. **Zaktualizowane:**
   - `package.json` - dodane scripty electron
   - `next.config.ts` - wsparcie dla static export
   - `PianoRoll.tsx` - wsparcie dla Electron API

## 🚀 Jak uruchomić:

### Development Mode (z hot reload):
```bash
npm run electron:dev
```

To uruchomi:
- Next.js dev server na localhost:3000
- Electron window który ładuje localhost:3000
- DevTools otwarte automatycznie

### Build Production App:

**Windows:**
```bash
npm run electron:build:win
```

**Mac:**
```bash
npm run electron:build:mac
```

**Linux:**
```bash
npm run electron:build:linux
```

Zbudowana aplikacja będzie w folderze `dist/`

## 🎹 Nowe funkcje w Electron:

### 1. Save MIDI File
- Kliknij przycisk Download (⬇)
- Otworzy się dialog "Save As"
- Wybierz lokalizację i zapisz

### 2. Export to FL Studio (TODO - dodać przycisk)
- Automatycznie znajdzie folder FL Studio MIDI
- Lub pozwoli wybrać folder ręcznie
- Zapisze plik bezpośrednio tam

## 📁 Struktura:

```
project/
├── electron/
│   ├── main.js       # Główny proces Electron
│   └── preload.js    # Bridge API
├── src/              # React app (Next.js)
├── out/              # Static export (po build)
└── dist/             # Zbudowana aplikacja Electron
```

## 🔧 Następne kroki:

1. **Przetestuj:** `npm run electron:dev`
2. **Dodaj przycisk "Export to FL Studio"** w Toolbar
3. **Build:** `npm run electron:build:win`
4. **Testuj przeciąganie** plików z app do FL Studio

## ⚠️ Uwagi:

- W trybie dev używa localhost:3000
- W production używa statycznych plików z `out/`
- Electron API dostępne przez `window.electron`
- Działa offline (po zbudowaniu)

## 🐛 Troubleshooting:

**Problem:** "Cannot find module electron"
**Rozwiązanie:** `npm install`

**Problem:** Port 3000 zajęty
**Rozwiązanie:** Zmień port w `package.json` i `electron/main.js`

**Problem:** Build fails
**Rozwiązanie:** Sprawdź czy `out/` folder istnieje po `next build`
