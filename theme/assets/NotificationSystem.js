// 
// 01-NOTIFICATION-SYSTEM.js - Professional Notification Manager
// Consolidates: showAnvilNotification(), showAnvilConfirm(), showBackendMessage()
// Theme: Purple palette (#667eea → #764ba2) matching app design
// 

var NotificationSystem = (function() {
  var toastContainer = null;

  function initContainer() {
    if (toastContainer) return;
    toastContainer = document.createElement('div');
    toastContainer.id = 'notification-container';
    toastContainer.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);z-index:10000;display:flex;flex-direction:column;gap:10px;pointer-events:none;';
    document.body.appendChild(toastContainer);
    injectStyles();
  }

  function isDarkMode() {
    return document.documentElement.classList.contains('dark-mode') ||
      document.body.classList.contains('dark-mode');
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  // Convert \n in messages to <br> for HTML display, while escaping HTML entities
  function formatMessage(msg) {
    if (!msg) return '';
    var parts = String(msg).split(/\n/);
    var result = [];
    for (var i = 0; i < parts.length; i++) {
      result.push(escapeHtml(parts[i]));
    }
    return result.join('<br>');
  }

  function injectStyles() {
    if (document.getElementById('notification-styles')) return;
    var style = document.createElement('style');
    style.id = 'notification-styles';
    style.textContent = [
      /* Animations */
      '@keyframes notif-slideDown{from{transform:translateY(-20px);opacity:0}to{transform:translateY(0);opacity:1}}',
      '@keyframes notif-fadeIn{from{opacity:0}to{opacity:1}}',
      '@keyframes notif-slideUp{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}',

      /* Toast base - light bg, colored left border */
      '.notif-toast{',
      'animation:notif-slideDown 0.35s cubic-bezier(0.21,1.02,0.73,1);',
      'padding:14px 20px 14px 16px;',
      'border-radius:8px;',
      'border-left:5px solid transparent;',
      'display:flex;',
      'align-items:center;',
      'gap:12px;',
      'font-family:"Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;',
      'font-size:14px;',
      'line-height:1.5;',
      'box-shadow:0 4px 14px rgba(0,0,0,0.12);',
      'pointer-events:auto;',
      'min-width:280px;',
      'max-width:480px;',
      'word-break:break-word;',
      'position:relative;',
      '}',

      /* Toast icon circle */
      '.notif-toast-icon{',
      'width:28px;height:28px;',
      'border-radius:50%;',
      'display:flex;align-items:center;justify-content:center;',
      'font-size:14px;font-weight:700;',
      'flex-shrink:0;',
      '}',

      /* Toast text */
      '.notif-toast-text{',
      'flex:1;',
      'font-weight:500;',
      '}',

      /* Toast close btn */
      '.notif-toast-close{',
      'background:none;border:none;',
      'cursor:pointer;',
      'font-size:16px;',
      'opacity:0.45;',
      'transition:opacity 0.2s;',
      'padding:0 0 0 8px;',
      'flex-shrink:0;',
      'line-height:1;',
      '}',
      '.notif-toast-close:hover{opacity:0.8}',

      /* ---- Success toast ---- */
      '.notif-toast-success{',
      'background-color:#f0fdf4;',
      'border-left-color:#10b981;',
      'color:#065f46;',
      '}',
      '.notif-toast-success .notif-toast-icon{background:#dcfce7;color:#059669}',
      '.notif-toast-success .notif-toast-close{color:#065f46}',

      /* ---- Error toast ---- */
      '.notif-toast-error{',
      'background-color:#fef2f2;',
      'border-left-color:#ef4444;',
      'color:#991b1b;',
      '}',
      '.notif-toast-error .notif-toast-icon{background:#fee2e2;color:#dc2626}',
      '.notif-toast-error .notif-toast-close{color:#991b1b}',

      /* ---- Warning toast ---- */
      '.notif-toast-warning{',
      'background-color:#fffbeb;',
      'border-left-color:#f59e0b;',
      'color:#92400e;',
      '}',
      '.notif-toast-warning .notif-toast-icon{background:#fef3c7;color:#d97706}',
      '.notif-toast-warning .notif-toast-close{color:#92400e}',

      /* ---- Info toast (purple themed) ---- */
      '.notif-toast-info{',
      'background-color:#eef2ff;',
      'border-left-color:#667eea;',
      'color:#3730a3;',
      '}',
      '.notif-toast-info .notif-toast-icon{background:#e0e7ff;color:#5a67d8}',
      '.notif-toast-info .notif-toast-close{color:#3730a3}',

      /* ---- Dark mode toast overrides ---- */
      '.dark-mode .notif-toast-success{background:#022c22;border-left-color:#10b981;color:#a7f3d0}',
      '.dark-mode .notif-toast-success .notif-toast-icon{background:rgba(16,185,129,0.2);color:#34d399}',
      '.dark-mode .notif-toast-success .notif-toast-close{color:#a7f3d0}',

      '.dark-mode .notif-toast-error{background:#2a0a0a;border-left-color:#ef4444;color:#fca5a5}',
      '.dark-mode .notif-toast-error .notif-toast-icon{background:rgba(239,68,68,0.2);color:#f87171}',
      '.dark-mode .notif-toast-error .notif-toast-close{color:#fca5a5}',

      '.dark-mode .notif-toast-warning{background:#2a1f00;border-left-color:#f59e0b;color:#fde68a}',
      '.dark-mode .notif-toast-warning .notif-toast-icon{background:rgba(245,158,11,0.2);color:#fbbf24}',
      '.dark-mode .notif-toast-warning .notif-toast-close{color:#fde68a}',

      '.dark-mode .notif-toast-info{background:#1a1a3e;border-left-color:#667eea;color:#c7d2fe}',
      '.dark-mode .notif-toast-info .notif-toast-icon{background:rgba(102,126,234,0.2);color:#818cf8}',
      '.dark-mode .notif-toast-info .notif-toast-close{color:#c7d2fe}',

      '.dark-mode .notif-toast{box-shadow:0 4px 14px rgba(0,0,0,0.4)}',

      /* ============ Modal styles ============ */

      /* Modal overlay */
      '.notif-modal-overlay{',
      'position:fixed;top:0;left:0;right:0;bottom:0;',
      'background:rgba(0,0,0,0.5);',
      'display:flex;align-items:center;justify-content:center;',
      'z-index:10001;',
      'animation:notif-fadeIn 0.2s ease-out;',
      'backdrop-filter:blur(4px);',
      '}',

      /* Modal box */
      '.notif-modal{',
      'background:#fff;',
      'border-radius:14px;',
      'padding:28px;',
      'max-width:480px;',
      'width:90%;',
      'box-shadow:0 25px 50px rgba(0,0,0,0.2);',
      'animation:notif-slideUp 0.3s ease-out;',
      'font-family:"Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;',
      '}',

      /* Modal title */
      '.notif-modal h3{',
      'margin:0 0 14px 0;',
      'font-size:17px;',
      'font-weight:700;',
      'color:#1e293b;',
      'display:flex;align-items:center;gap:8px;',
      '}',

      /* Modal body text */
      '.notif-modal .notif-modal-body{',
      'margin:0 0 22px 0;',
      'font-size:15px;',
      'color:#475569;',
      'line-height:1.6;',
      'word-break:break-word;',
      '}',
      '.notif-modal .notif-modal-body p {',
      'margin: 0 0 10px 0;',
      '}',
      '.notif-modal .notif-modal-body p:last-child {',
      'margin-bottom: 0;',
      '}',
      '.notif-modal .notif-modal-body ul {',
      'margin: 8px 0 12px 0;',
      'padding-left: 24px;',
      '}',
      '.notif-modal .notif-modal-body li {',
      'margin-bottom: 6px;',
      '}',

      /* Modal buttons container */
      '.notif-modal-buttons{display:flex;gap:10px;justify-content:flex-end}',

      /* Modal buttons */
      '.notif-modal button{',
      'padding:9px 20px;',
      'border-radius:8px;',
      'border:none;',
      'font-size:13px;',
      'font-weight:600;',
      'cursor:pointer;',
      'transition:all 0.2s ease;',
      'font-family:inherit;',
      '}',
      '.notif-modal button:hover{transform:translateY(-1px)}',
      '.notif-modal button:active{transform:translateY(0)}',

      /* Primary button - purple gradient matching app theme */
      '.notif-btn-primary{',
      'background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);',
      'color:#fff;',
      'box-shadow:0 4px 12px rgba(102,126,234,0.35);',
      '}',
      '.notif-btn-primary:hover{box-shadow:0 6px 16px rgba(102,126,234,0.5)}',

      /* Secondary button */
      '.notif-btn-secondary{',
      'background:#f1f5f9;',
      'color:#475569;',
      'border:1px solid #e2e8f0;',
      '}',
      '.notif-btn-secondary:hover{background:#e2e8f0;border-color:#cbd5e1}',

      /* Danger button (for destructive confirms) */
      '.notif-btn-danger{',
      'background:linear-gradient(135deg,#ef4444 0%,#dc2626 100%);',
      'color:#fff;',
      'box-shadow:0 4px 12px rgba(239,68,68,0.35);',
      '}',
      '.notif-btn-danger:hover{box-shadow:0 6px 16px rgba(239,68,68,0.5)}',

      /* ---- Dark mode modal overrides ---- */
      '.dark-mode .notif-modal{',
      'background:rgba(30,41,59,0.97);',
      'border:1px solid #334155;',
      'box-shadow:0 25px 50px rgba(0,0,0,0.5);',
      '}',
      '.dark-mode .notif-modal h3{color:#e2e8f0}',
      '.dark-mode .notif-modal .notif-modal-body{color:#cbd5e1}',
      '.dark-mode .notif-btn-secondary{background:#1e293b;color:#cbd5e1;border-color:#475569}',
      '.dark-mode .notif-btn-secondary:hover{background:#334155;border-color:#64748b}',
      '.dark-mode .notif-modal-overlay{background:rgba(0,0,0,0.65)}',
    ].join('');
    document.head.appendChild(style);
  }

  function createToast(msg, type) {
    initContainer();
    var toast = document.createElement('div');
    toast.className = 'notif-toast notif-toast-' + type;

    // Icon per type
    var icons = {success:'✓', error:'✕', warning:'⚠', info:'ℹ'};
    var icon = icons[type] || 'ℹ';

    // Build toast HTML
    toast.innerHTML =
      '<span class="notif-toast-icon">' + icon + '</span>' +
      '<span class="notif-toast-text">' + formatMessage(msg) + '</span>' +
      '<button class="notif-toast-close" aria-label="Close">&times;</button>';

    // Close button handler
    var closeBtn = toast.querySelector('.notif-toast-close');
    closeBtn.onclick = function() {
      dismissToast(toast);
    };

    toastContainer.appendChild(toast);

    // Auto-dismiss after 4s
    var autoTimer = setTimeout(function() {
      dismissToast(toast);
    }, 4000);

    // Store timer so close button can cancel it
    toast._autoTimer = autoTimer;
  }

  function dismissToast(toast) {
    if (toast._dismissed) return;
    toast._dismissed = true;
    if (toast._autoTimer) clearTimeout(toast._autoTimer);
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px)';
    toast.style.transition = 'opacity 0.3s, transform 0.3s';
    setTimeout(function() {
      if (toastContainer && toastContainer.contains(toast)) {
        toastContainer.removeChild(toast);
      }
    }, 300);
  }

  function createModal(msg, title, buttons, options) {
    options = options || {};
    var overlay = document.createElement('div');
    overlay.className = 'notif-modal-overlay';
    var modal = document.createElement('div');
    modal.className = 'notif-modal';

    // Title icon based on context
    var titleIcon = '';
    if (options.icon) {
      titleIcon = '<span style="font-size:20px;">' + options.icon + '</span>';
    }

    modal.innerHTML = '<h3>' + titleIcon + (title || 'Message') + '</h3>' +
      '<div class="notif-modal-body">' + (options.isHtml ? msg : formatMessage(msg)) + '</div>' +
      '<div class="notif-modal-buttons"></div>';

    var btnContainer = modal.querySelector('.notif-modal-buttons');
    buttons.forEach(function(btn) {
      var button = document.createElement('button');
      button.textContent = btn.label;
      // Determine button style class
      if (btn.danger) {
        button.className = 'notif-btn-danger';
      } else if (btn.primary) {
        button.className = 'notif-btn-primary';
      } else {
        button.className = 'notif-btn-secondary';
      }
      button.onclick = function() {
        if (btn.callback) btn.callback();
        if (document.body.contains(overlay)) document.body.removeChild(overlay);
        document.removeEventListener('keydown', keyHandler);
      };
      btnContainer.appendChild(button);
    });

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    var keyHandler = function(e) {
      if (!document.body.contains(overlay)) return;
      if (e.key === 'Escape') {
        document.body.removeChild(overlay);
        document.removeEventListener('keydown', keyHandler);
      } else if (e.key === 'Enter') {
        var primaryBtn = modal.querySelector('.notif-btn-primary') || modal.querySelector('.notif-btn-danger');
        if (primaryBtn) {
          e.preventDefault();
          primaryBtn.click();
        }
      }
    };
    document.addEventListener('keydown', keyHandler);

    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) {
        document.body.removeChild(overlay);
        document.removeEventListener('keydown', keyHandler);
      }
    });
  }

  return {
    init: function() { initContainer(); },
    toast: function(msg, type) { createToast(msg, type || 'info'); },
    success: function(msg) { createToast(msg, 'success'); },
    error: function(msg) { createToast(msg, 'error'); },
    warning: function(msg) { createToast(msg, 'warning'); },
    info: function(msg) { createToast(msg, 'info'); },
    confirm: function(msg, title, callback, options) { 
      options = options || {};
      var isDanger = options.danger || false;
      var confirmLabel = options.confirmLabel || 'Confirm';
      var cancelLabel = options.cancelLabel || 'Cancel';
      var icon = options.icon ;//|| '⚡';
      createModal(msg, title || 'Confirm', [
        {label: cancelLabel, primary: false, callback: function() { if (callback) callback(false); }},
        {label: confirmLabel, primary: !isDanger, danger: isDanger, callback: function() { if (callback) callback(true); }}
      ], {icon: icon, isHtml: options.isHtml});
    },
    backend: function(msg, title, type, buttons) {
      buttons = buttons || [{label:'OK', primary:true, callback:null}];
      var icons = {success:'✔', error:'✕', warning:'⚠', info:'ℹ'};
      createModal(msg, title, buttons, {icon: icons[type] || 'ℹ'});
    }
  };
})();

if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',function(){NotificationSystem.init()})} else {NotificationSystem.init();}

// AI COMMENT: Consolidated notification system - Purple theme aligned
// REPLACES: showAnvilNotification() [line 84], showAnvilConfirm() [line 109], showBackendMessage() [line 152]
// USAGE: NotificationSystem.toast/success/error/confirm/backend()
