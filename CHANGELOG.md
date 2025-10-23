# Changelog

## [v2.2.0] - 2024-10-23

### 🎨 UI/UX Improvements

#### Liquid Glass Theme Enhancements
- **Fixed dark background** - Removed green tint, now pure neutral black/gray gradient
- **Improved transparency** - Mobile controls panel and Event Editor now have glass effect with blur
- **Visible grid lines** - Grid lines now properly visible with white/gray colors in liquid glass theme
- **Better contrast** - All UI elements properly visible on dark background

#### Piano Keys
- **Enhanced contrast** - White keys now pure white, black keys darker for better visibility
- **Neutral colors** - Removed color tints from key borders
- **Better 3D effect** - Added proper left borders for depth

### ✨ New Features

#### Ghost Notes
- **Compare melodies** - View previous melody as semi-transparent ghost notes
- **Toggle on/off** - Click ghost icon (👻) in toolbar to show/hide
- **Automatic save** - Previous melody automatically saved when generating new one

### 🔧 Technical Improvements

#### Code Organization
- **Cleaned up project structure** - Moved old documentation and Electron experiments to `_archive/`
- **Removed unused dependencies** - Cleaned up Electron-related packages
- **Better file organization** - Organized docs and scripts into archive folders

#### Grid System
- **Theme-aware grid** - Grid automatically detects theme and adjusts line colors
- **Liquid glass optimization** - Special handling for liquid glass theme to prevent background override
- **Better performance** - Optimized grid rendering with proper selectors

### 🐛 Bug Fixes
- Fixed grid lines not visible in liquid glass theme
- Fixed background color conflicts between themes
- Fixed piano keys color tints in different themes
- Restored API routes after Electron cleanup

### 🗑️ Removed
- Electron desktop app experiment (moved to `_archive/`)
- Unused documentation files (moved to `_archive/docs/`)
- Test scripts (moved to `_archive/scripts/`)

---

## Previous Versions
See `_archive/docs/` for older changelogs.
