// Aggressive iOS fullscreen script
(function() {
  'use strict';
  
  function isIOS() {
    return /iPhone|iPad|iPod/.test(navigator.userAgent);
  }
  
  function isIPhone13Mini() {
    return isIOS() && 
           window.screen.width === 375 && 
           window.screen.height === 812 && 
           window.devicePixelRatio === 3;
  }
  
  function forceFullscreen() {
    if (!isIOS()) return;
    
    const elements = [
      document.documentElement,
      document.body,
      document.getElementById('__next'),
      document.querySelector('main')
    ].filter(Boolean);

    // Special handling for iPhone 13 mini
    if (isIPhone13Mini()) {
      const isLandscape = window.orientation === 90 || window.orientation === -90;
      const width = isLandscape ? '812px' : '375px';
      const height = isLandscape ? '375px' : '812px';
      
      elements.forEach(el => {
        if (el) {
          el.style.cssText = `
            width: ${width} !important;
            height: ${height} !important;
            max-width: ${width} !important;
            max-height: ${height} !important;
            margin: 0 !important;
            padding: 0 !important;
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            overflow: hidden !important;
          `;
        }
      });
    } else {
      // General iOS handling
      elements.forEach(el => {
        if (el) {
          el.style.cssText = `
            width: 100vw !important;
            height: 100vh !important;
            height: -webkit-fill-available !important;
            max-width: 100vw !important;
            max-height: 100vh !important;
            margin: 0 !important;
            padding: 0 !important;
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            overflow: hidden !important;
          `;
        }
      });
    }

    // Update viewport meta tag
    let viewport = document.querySelector('meta[name=viewport]');
    if (viewport) {
      viewport.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover, shrink-to-fit=no');
    }
  }
  
  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', forceFullscreen);
  } else {
    forceFullscreen();
  }
  
  // Run on various events
  window.addEventListener('load', forceFullscreen);
  window.addEventListener('resize', forceFullscreen);
  window.addEventListener('orientationchange', () => {
    setTimeout(forceFullscreen, 100);
    setTimeout(forceFullscreen, 500);
  });
  window.addEventListener('focus', forceFullscreen);
  
  // Run periodically for the first few seconds
  setTimeout(forceFullscreen, 100);
  setTimeout(forceFullscreen, 500);
  setTimeout(forceFullscreen, 1000);
  setTimeout(forceFullscreen, 2000);
})();