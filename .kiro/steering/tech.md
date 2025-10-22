# Technology Stack

## Framework & Runtime
- **Next.js 15.5.6** - React framework with App Router
- **React 18.3.1** - UI library
- **TypeScript 5** - Type safety and development experience
- **Node.js** - Runtime environment

## AI & Music Processing
- **Google Genkit 1.21.0** - AI workflow orchestration
- **Google Gemini API** - LLM for melody generation
- **Tone.js 15.1.1** - Web Audio API wrapper for audio playback
- **@tonejs/midi 2.0.28** - MIDI file parsing
- **midi-writer-js 3.1.1** - MIDI file generation

## UI & Styling
- **Tailwind CSS 3.4.1** - Utility-first CSS framework
- **Radix UI** - Headless component primitives
- **Lucide React** - Icon library
- **shadcn/ui components** - Pre-built component system

## Data & Validation
- **Zod 3.24.2** - Schema validation
- **React Hook Form 7.54.2** - Form state management
- **Firebase 11.9.1** - Backend services (optional)

## Development Tools
- **ESLint** - Code linting
- **PostCSS** - CSS processing
- **Turbopack** - Fast bundler (dev mode)

## Common Commands

### Development
```bash
# Start development server with Turbopack
npm run dev

# Start Genkit development server
npm run genkit:dev

# Watch mode for Genkit
npm run genkit:watch
```

### Build & Deploy
```bash
# Production build
npm run build

# Start production server
npm start

# Type checking
npm run typecheck

# Linting
npm run lint
```

## Environment Variables
Required environment variables:
- `GOOGLE_GENAI_API_KEY` - Google Gemini API key
- `GEMINI_API_KEY` - Alternative Gemini API key

## Architecture Patterns
- **Server Actions** - For AI operations and data mutations
- **Genkit Flows** - For AI workflow orchestration
- **Custom Hooks** - For complex state management
- **Utility Functions** - For music theory and MIDI operations
- **Schema Validation** - Zod schemas for type safety
- **Modular AI Utils** - Separated concerns for maintainability