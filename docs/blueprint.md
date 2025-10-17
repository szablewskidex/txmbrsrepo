# **App Name**: PianoRollAI

## Core Features:

- Note Addition: Allow users to add notes to the piano roll by clicking on the grid.
- Note Manipulation: Enable users to drag notes to move them and drag the right edge to resize their duration.
- MIDI Export: Implement MIDI export functionality using MidiWriterJS.
- Ghost Notes: Render ghost notes (lighter color) to show possible future note placements.
- AI Melody Generation: Integrate an AI agent that uses an LLM tool to generate melodies based on user prompts such as key, tempo, and length.
- Velocity Editing: Provide an event editor pane for adjusting the velocity of notes using velocity bars.
- Zoom Controls: Add horizontal and vertical zoom sliders to adjust the grid scale.

## Style Guidelines:

- Primary color: Forest green (#63B350) for a musical and fresh feel.
- Background color: Dark charcoal (#292E2D) to emphasize the notes and provide contrast.
- Accent color: Light turquoise (#70C5CE) for interactive elements and highlights.
- Headline and body font: 'Inter' sans-serif font, to provide a modern, machined, objective look. Note: currently only Google Fonts are supported.
- Use simple, clean icons for controls such as play, pause, and export.
- Divide the interface into distinct sections for the piano roll grid, piano keys, and controls.
- Use subtle animations for note creation and adjustments.