// Force Sidebar Initialization - Run this script to ensure sidebar listeners are attached
// This is a standalone script that can be included or run manually

(function() {
  'use strict';
  
  console.log('🚀 FORCE SIDEBAR INIT: Starting...');
  
  function attachListeners() {
    var buttons = document.querySelectorAll('.icon-btn');
    var sidebar = document.getElementById('mainSidebar');
    
    if (!buttons || buttons.length === 0) {
      console.warn('🚀 FORCE INIT: No buttons found, retrying...');
      setTimeout(attachListeners, 500);
      return;
    }
    
    if (!sidebar) {
      console.warn('🚀 FORCE INIT: Sidebar not found, retrying...');
      setTimeout(attachListeners, 500);
      return;
    }
    
    console.log('🚀 FORCE INIT: Found', buttons.length, 'buttons');
    
    var stateRef = window.state || {};
    var sidebarState = { currentSection: null };
    var attached = 0;
    
    for (var i = 0; i < buttons.length; i++) {
      var btn = buttons[i];
      var section = btn.getAttribute('data-section');
      
      if (!section) continue;
      if (btn.hasAttribute('data-force-init')) continue; // Already initialized
      
      btn.setAttribute('data-force-init', 'true');
      
      (function(button, sec) {
        button.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
          
          console.log('🚀 FORCE INIT: Clicked', sec);
          
          if (stateRef && typeof stateRef === 'object') {
            stateRef.activeSection = sec;
          }
          
          // Toggle
          if (sec === sidebarState.currentSection && sidebar.classList.contains('expanded')) {
            sidebar.classList.remove('expanded');
            sidebarState.currentSection = null;
            for (var j = 0; j < buttons.length; j++) {
              buttons[j].classList.remove('active');
            }
            return;
          }
          
          // Update active
          for (var j = 0; j < buttons.length; j++) {
            buttons[j].classList.remove('active');
          }
          button.classList.add('active');
          sidebarState.currentSection = sec;
          
          // Show section
          var sections = document.querySelectorAll('.section-content');
          for (var j = 0; j < sections.length; j++) {
            sections[j].classList.remove('active');
          }
          var target = document.querySelector('.section-content[data-section="' + sec + '"]');
          if (target) {
            target.classList.add('active');
            var headerTitle = document.getElementById('sidebarHeaderTitle');
            if (headerTitle) {
              var cardTitle = target.querySelector('.card-title');
              headerTitle.textContent = cardTitle ? cardTitle.textContent.trim() : sec;
            }
          }
          
          // Expand
          sidebar.classList.add('expanded');
          
          console.log('🚀 FORCE INIT: Sidebar expanded for', sec);
        });
        
        attached++;
        console.log('🚀 FORCE INIT: ✅ Attached to', sec);
      })(btn, section);
    }
    
    console.log('🚀 FORCE INIT: ✅✅✅ Attached', attached, 'listeners!');
  }
  
  // Try immediately
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attachListeners);
  } else {
    attachListeners();
  }
  
  // Also try on load
  window.addEventListener('load', function() {
    setTimeout(attachListeners, 200);
  });
  
  // Expose globally
  window.forceSidebarInit = attachListeners;
  
  console.log('🚀 FORCE SIDEBAR INIT: Script loaded. Call window.forceSidebarInit() to manually trigger.');
})();
