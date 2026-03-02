// AppOrchestrator.js
// Initializes and coordinates the application

var AppOrchestrator = (function () {
  function init() {
    // Initialize view mode toggle (default to 2D)
    window.state.viewModeTarget = window.state.viewMode; // Sync target with current mode
    if (document.getElementById("viewModeToggle")) {
      document.getElementById("viewModeToggle").checked = window.state.viewMode === "3d";
      if (document.getElementById("darkModeToggle")) {
        document.getElementById("darkModeToggle").checked = window.state.darkMode || false;
        if (typeof window.applyDarkMode === "function") {
          window.applyDarkMode();
        }
      }
    }
    
    if (typeof window.updateDeleteImageButton === "function") window.updateDeleteImageButton();
    if (typeof window.updateDeleteXdImageButton === "function") window.updateDeleteXdImageButton();
    if (typeof window.updateDeleteDxfButton === "function") window.updateDeleteDxfButton();
    
    // Only call functions if they've been loaded
    if (typeof window.initIconSidebar === "function") window.iconSidebarData = window.initIconSidebar();
    if (typeof window.initLegendDrag === "function") window.initLegendDrag();
    if (typeof window.storeLegendDefaultPosition === "function") window.storeLegendDefaultPosition();
    if (typeof window.constrainLegendPosition === "function") setTimeout(window.constrainLegendPosition, 100);
    if (typeof window.updateAntennaPatternsList === "function") window.updateAntennaPatternsList();
    
    if (typeof window.draw === "function") window.draw();
  }

  return {
    init: init
  };
})();

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", AppOrchestrator.init);
} else {
  AppOrchestrator.init();
}