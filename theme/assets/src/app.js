//
// app.js
// Icon sidebar initialization and outside-click closing logic.
// Extracted from IPSStudioV2.6_clean.js.
//
// Depends on: DOM (.icon-btn, #mainSidebar, .section-content),
//             constrainLegendPosition (monolith/global)
//

(function () {
  "use strict";

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
          if (typeof constrainLegendPosition === "function") {
            constrainLegendPosition();
          }
        }, 350);
      });
    });

    return { sidebar: sidebar, currentSection: currentSection };
  }

  // Close sidebar when clicking outside
  document.addEventListener("click", function (e) {
    var clickedOnModal =
      e.target.closest(".notif-modal-overlay") ||
      e.target.closest(".notif-modal");
    if (clickedOnModal) return;

    if (window.iconSidebarData) {
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
            if (typeof constrainLegendPosition === "function") {
              constrainLegendPosition(true);
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

  window.initIconSidebar = initIconSidebar; //DOM
})();
