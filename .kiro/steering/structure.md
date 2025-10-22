# Project Structure

## Root Directory
- **Configuration files**: `next.config.ts`, `tailwind.config.ts`, `tsconfig.json`, `components.json`
- **Environment**: `.env`, `.env.local` (API keys and secrets)
- **Documentation**: `README.md`, `CHANGELOG.md`, `MIGRATION_GUIDE.md`, optimization reports
- **Scripts**: PowerShell scripts in `/scripts` for utilities and training

## Source Code Organization (`/src`)

### `/src/app` - Next.js App Router
- Page components and layouts
- Server actions for AI operations
- API routes (if any)

### `/src/components` - React Components
- **UI components**: Reusable interface elements
- **Piano roll components**: Core music editor interface
- **Form components**: Input handling and validation
- Follow shadcn/ui patterns for consistency

### `/src/ai` - AI & Music Generation
- **`/flows`**: Genkit flows for AI operations
  - `generate-melody-from-prompt.ts` - Main melody generation
  - `suggest-chord-progressions.ts` - Chord suggestions
- **`/utils`**: Modular AI utilities (refactored from monolithic files)
  - `chord-selection.ts` - Chord progression logic
  - `few-shot-learning.ts` - Training data integration
  - `melody-analysis.ts` - Music theory analysis
  - `prompt-detection.ts` - Prompt parsing utilities
  - `negative-feedback.ts` - Learning from user feedback
  - `cache-manager.ts` - Request caching
  - `rate-limit-manager.ts` - API rate limiting

### `/src/lib` - Core Utilities
- **Music theory**: Note conversion, scale validation, MIDI utilities
- **Schemas**: Zod validation schemas for type safety
- **Validators**: `melody-validator.ts` for music correctness
- **General utilities**: Shared helper functions

### `/src/hooks` - Custom React Hooks
- **`usePianoRollState.ts`**: Centralized piano roll state management
- Other custom hooks for complex state logic

### `/src/data` - Static Data
- Musical scales, chord progressions, instrument mappings
- Configuration data for AI models

## Training Data (`/training-data`)
- **`melody-training-dataset.json`**: Few-shot learning examples
- **`melody-feedback-log.json`**: User feedback for model improvement

## Public Assets (`/public`)
- **`/icons`**: PWA and UI icons
- **`/midi`**: Sample MIDI files
- **`manifest.json`**: PWA configuration

## Key Conventions

### File Naming
- **Components**: PascalCase (`PianoRoll.tsx`)
- **Utilities**: kebab-case (`melody-validator.ts`)
- **Hooks**: camelCase with `use` prefix (`usePianoRollState.ts`)
- **Types**: PascalCase with descriptive suffixes (`MelodyNote`, `GenerateMelodyInput`)

### Import Organization
1. External libraries (React, Next.js, etc.)
2. Internal utilities and types
3. Component imports
4. Relative imports

### Code Organization Principles
- **Separation of concerns**: AI logic separate from UI components
- **Modular utilities**: Break large files into focused modules
- **Type safety**: Zod schemas for runtime validation
- **Error handling**: Graceful degradation for AI failures
- **Caching**: Intelligent caching for expensive AI operations

### AI Module Structure
AI utilities follow a consistent pattern:
- Input validation with Zod schemas
- Error handling with fallbacks
- Logging for debugging
- Caching where appropriate
- Rate limiting for API protection