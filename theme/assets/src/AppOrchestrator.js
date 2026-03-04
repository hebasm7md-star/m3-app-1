// AppOrchestrator.js
// Initializes and coordinates the application UI and entry points

var AppOrchestrator = (function () {
  "use strict";

  var iconSidebarData = { sidebar: null, currentSection: null };

  function initIconSidebar() {
    var iconButtons = document.querySelectorAll(".icon-btn");
    var currentSection = "floorplan";
    var sidebar = document.getElementById("mainSidebar");

    if (!sidebar) {
      console.error("Sidebar not found");
      return null;
    }

    if (iconButtons.length === 0) {
      console.error("Icon buttons not found");
      return null;
    }

    iconButtons.forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        var modal = document.getElementById("wallsHelpModal");
        if (modal && modal.style.display === "block") {
          modal.style.display = "none";
        }

        e.preventDefault();
        e.stopPropagation();

        var section = this.getAttribute("data-section");
        if (!section) return;

        if (
          section === currentSection &&
          sidebar.classList.contains("expanded")
        ) {
          sidebar.classList.remove("expanded");
          currentSection = null;
          iconSidebarData.currentSection = null;
          iconButtons.forEach(function (b) {
            b.classList.remove("active");
          });
          setTimeout(function () {
            if (typeof constrainLegendPosition === "function") {
              constrainLegendPosition(true);
            }
          }, 350);
          return;
        }

        iconButtons.forEach(function (b) {
          b.classList.remove("active");
        });
        this.classList.add("active");
        currentSection = section;
        iconSidebarData.currentSection = section;

        var sections = document.querySelectorAll(".section-content");
        sections.forEach(function (s) {
          s.classList.remove("active");
        });

        var selectedSection = document.querySelector(
          '.section-content[data-section="' + section + '"]'
        );
        if (selectedSection) {
          selectedSection.classList.add("active");
          var headerTitle = document.getElementById("sidebarHeaderTitle");
          if (headerTitle) {
            var cardTitle = selectedSection.querySelector(".card-title");
            headerTitle.textContent = cardTitle
              ? cardTitle.textContent.trim()
              : section;
          }
        }

        sidebar.classList.add("expanded");
        setTimeout(function () {
          if (typeof window.constrainLegendPosition === "function") {
            window.constrainLegendPosition();
          }
        }, 350);
      });
    });

    iconSidebarData.sidebar = sidebar;
    iconSidebarData.currentSection = currentSection;
    window.iconSidebarData = iconSidebarData;
    return iconSidebarData;
  }

  function setupGlobalClickHandlers() {
    // Close sidebar when clicking outside
    document.addEventListener("click", function (e) {
      var clickedOnModal =
        e.target.closest(".notif-modal-overlay") ||
        e.target.closest(".notif-modal");
      if (clickedOnModal) return;

      if (window.iconSidebarData && window.iconSidebarData.sidebar) {
        var sidebar = window.iconSidebarData.sidebar;
        var iconButtons = document.querySelectorAll(".icon-btn");

        var clickedInsideSidebar =
          sidebar &&
          (sidebar.contains(e.target) || e.target.closest(".icon-sidebar"));
        var clickedOnSidebarButton =
          e.target.closest(".list-item") || e.target.closest("button.small");

        if (clickedInsideSidebar || clickedOnSidebarButton) {
          // inside sidebar — do nothing
        } else if (
          !e.target.closest(".canvas-container") &&
          e.target.id !== "plot"
        ) {
          if (sidebar && sidebar.classList.contains("expanded")) {
            sidebar.classList.remove("expanded");
            iconButtons.forEach(function (b) {
              b.classList.remove("active");
            });
            window.iconSidebarData.currentSection = null;
            setTimeout(function () {
              if (typeof window.constrainLegendPosition === "function") {
                window.constrainLegendPosition(true);
              }
            }, 350);
          }
        }
      }

      // Close right sidebar (AP detail) when clicking outside it
      var apDetailSidebar = document.getElementById("apDetailSidebar");
      if (apDetailSidebar && apDetailSidebar.classList.contains("visible")) {
        if (apDetailSidebar.contains(e.target)) return;
        if (window.state && window.state.justOpenedApSidebar) return;
        apDetailSidebar.classList.remove("visible");
        if (window.state) window.state.selectedApForDetail = null;
      }
    });
  }

  function init() {
    // Initialize view mode toggle (default to 2D)
    if (window.state) {
      window.state.viewModeTarget = window.state.viewMode; // Sync target with current mode
    }
    
    if (document.getElementById("viewModeToggle")) {
      document.getElementById("viewModeToggle").checked = window.state && window.state.viewMode === "3d";
      if (document.getElementById("darkModeToggle")) {
        document.getElementById("darkModeToggle").checked = (window.state && window.state.darkMode) || false;
        if (typeof window.applyDarkMode === "function") {
          window.applyDarkMode();
        }
      }
    }
    
    if (typeof window.updateDeleteImageButton === "function") window.updateDeleteImageButton();
    if (typeof window.updateDeleteXdImageButton === "function") window.updateDeleteXdImageButton();
    if (typeof window.updateDeleteDxfButton === "function") window.updateDeleteDxfButton();
    
    // Initialize UI parts
    initIconSidebar();
    setupGlobalClickHandlers();

    if (typeof window.initLegendDrag === "function") window.initLegendDrag();
    if (typeof window.storeLegendDefaultPosition === "function") window.storeLegendDefaultPosition();
    if (typeof window.constrainLegendPosition === "function") setTimeout(window.constrainLegendPosition, 100);
    if (typeof window.updateAntennaPatternsList === "function") window.updateAntennaPatternsList();
    
    if (typeof window.draw === "function") window.draw();

    window.parent.postMessage({ type: "request_app_version" }, "*");
  }

  return {
    init: init,
    getIconSidebarData: function() { return iconSidebarData; }
  };
})();

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", AppOrchestrator.init);
} else {
  AppOrchestrator.init();
}