// 
// 01-NOTIFICATION-SYSTEM.js - Professional Notification Manager
// Consolidates: showAnvilNotification(), showAnvilConfirm(), showBackendMessage()
// Theme: Deep Violet palette (#6366f1 → #312e81) matching app design
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
        'padding:10px 16px 10px 14px;',
        'border-radius:8px;',
        'border-left:4px solid transparent;',
        'display:flex;',
        'align-items:center;',
        'gap:10px;',
        'font-family:"Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;',
        'font-size:13px;',
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
        'width:24px;height:24px;',
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

      /* ---- Info toast (deep violet themed) ---- */
      '.notif-toast-info{',
        'background-color:#f5f3ff;',
        'border-left-color:#6366f1;',
        'color:#312e81;',
      '}',
      '.notif-toast-info .notif-toast-icon{background:#ede9fe;color:#6366f1}',
      '.notif-toast-info .notif-toast-close{color:#312e81}',

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

      '.dark-mode .notif-toast-info{background:#1e1b4b;border-left-color:#6366f1;color:#ddd6fe}',
      '.dark-mode .notif-toast-info .notif-toast-icon{background:rgba(99,102,241,0.2);color:#818cf8}',
      '.dark-mode .notif-toast-info .notif-toast-close{color:#ddd6fe}',

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
        'border-radius:12px;',
        'padding:22px;',
        'max-width:420px;',
        'width:90%;',
        'box-shadow:0 25px 50px rgba(0,0,0,0.12);',
        'animation:notif-slideUp 0.3s ease-out;',
        'font-family:"Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;',
        'border:1px solid rgba(0,0,0,0.04);',
      '}',

      /* Modal title */
      '.notif-modal h3{',
        'margin:0 0 14px 0;',
        'font-size:15px;',
        'font-weight:700;',
        'color:#1e293b;',
        'display:flex;align-items:center;',
        'padding-bottom:10px;',
        'border-bottom:1px solid #f1f5f9;',
      '}',

      /* Modal body text */
      '.notif-modal .notif-modal-body{',
        'margin:0 0 18px 0;',
        'font-size:13px;',
        'color:#475569;',
        'line-height:1.65;',
        'word-break:break-word;',
      '}',
      '.notif-modal .notif-modal-body p{',
        'margin:0 0 6px 0;',
      '}',
      '.notif-modal .notif-modal-body p:last-child{',
        'margin-bottom:0;',
      '}',
      '.notif-modal .notif-modal-body ul{',
        'margin:6px 0 10px 0;',
        'padding-left:20px;',
        'list-style:none;',
      '}',
      '.notif-modal .notif-modal-body li{',
        'margin-bottom:5px;',
        'position:relative;',
        'padding-left:14px;',
      '}',
      '.notif-modal .notif-modal-body li::before{',
        'content:"";',
        'position:absolute;left:0;top:8px;',
        'width:5px;height:5px;border-radius:50%;',
        'background:#6366f1;',
      '}',

      /* Modal buttons container */
      '.notif-modal-buttons{display:flex;gap:10px;justify-content:flex-end}',

      /* Modal buttons */
      '.notif-modal button{',
        'padding:7px 16px;',
        'border-radius:7px;',
        'border:none;',
        'font-size:12.5px;',
        'font-weight:600;',
        'cursor:pointer;',
        'transition:all 0.2s ease;',
        'font-family:inherit;',
      '}',
      '.notif-modal button:hover{transform:translateY(-1px)}',
      '.notif-modal button:active{transform:translateY(0)}',

      /* Primary button - deep violet gradient matching app theme */
      '.notif-btn-primary{',
        'background:linear-gradient(135deg,#6366f1 0%,#312e81 100%);',
        'color:#fff;',
        'box-shadow:0 4px 12px rgba(99,102,241,0.35);',
      '}',
      '.notif-btn-primary:hover{box-shadow:0 6px 16px rgba(99,102,241,0.5)}',

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

      /* Danger modal variant — red accent strip */
      '.notif-modal-danger{border-top:3px solid #ef4444}',
      '.notif-modal-danger h3{color:#dc2626}',
      '.dark-mode .notif-modal-danger h3{color:#f87171}',
      '.notif-modal-danger .notif-modal-body{color:#64748b}',
      '.dark-mode .notif-modal-danger .notif-modal-body{color:#94a3b8}',

      /* ---- Dark mode modal overrides ---- */
      '.dark-mode .notif-modal{',
        'background:rgba(32,32,38,0.97);',
        'border:1px solid rgba(255,255,255,0.06);',
        'box-shadow:0 25px 50px rgba(0,0,0,0.45);',
      '}',
      '.dark-mode .notif-modal h3{color:#e2e8f0;border-bottom-color:rgba(255,255,255,0.06)}',
      '.dark-mode .notif-modal .notif-modal-body{color:#cbd5e1}',
      '.dark-mode .notif-modal .notif-modal-body li::before{background:#a5b4fc}',
      '.dark-mode .notif-btn-secondary{background:#2a2a30;color:#cbd5e1;border-color:#404048}',
      '.dark-mode .notif-btn-secondary:hover{background:#3a3a42;border-color:#505058}',
      '.dark-mode .notif-modal-overlay{background:rgba(0,0,0,0.6)}',
    ].join('');
    document.head.appendChild(style);
  }

  var MATERIAL_ICONS = {
    success: 'check_circle',
    error: 'error',
    warning: 'warning',
    info: 'info',
    delete: 'delete'
  };

  function createToast(msg, type) {
    initContainer();
    var toast = document.createElement('div');
    toast.className = 'notif-toast notif-toast-' + type;

    var iconName = MATERIAL_ICONS[type] || 'info';

    toast.innerHTML =
      '<span class="notif-toast-icon"><span class="material-icons" style="font-size:16px">' + iconName + '</span></span>' +
      '<span class="notif-toast-text">' + formatMessage(msg) + '</span>' +
      '<button class="notif-toast-close" aria-label="Close"><span class="material-icons" style="font-size:16px">close</span></button>';

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

  function prettyFormatMessage(msg, isHtml) {
    if (isHtml) return msg;
    if (!msg) return '';
    var raw = String(msg);
    var lines = raw.split(/\n/);
    var html = '';
    var inList = false;

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var trimmed = line.replace(/^\s+/, '');
      var isBullet = /^[-•]\s/.test(trimmed);

      if (isBullet) {
        if (!inList) { html += '<ul style="margin:8px 0;padding-left:20px;">'; inList = true; }
        html += '<li>' + escapeHtml(trimmed.replace(/^[-•]\s*/, '')) + '</li>';
      } else {
        if (inList) { html += '</ul>'; inList = false; }
        if (trimmed === '') {
          html += '<div style="height:8px"></div>';
        } else {
          html += '<p style="margin:0 0 6px 0">' + escapeHtml(trimmed) + '</p>';
        }
      }
    }
    if (inList) html += '</ul>';
    return html;
  }

  function createModal(msg, title, buttons, options) {
    options = options || {};
    var overlay = document.createElement('div');
    overlay.className = 'notif-modal-overlay';
    var modal = document.createElement('div');
    var isDanger = buttons.some(function(b) { return b.danger; });
    modal.className = 'notif-modal' + (isDanger ? ' notif-modal-danger' : '');

    var iconColors = {
      check_circle: '#10b981',
      error: '#ef4444',
      warning: '#f59e0b',
      info: '#6366f1',
      delete: '#ef4444'
    };

    var titleIcon = '';
    if (options.icon) {
      var matIcon = MATERIAL_ICONS[options.icon] || options.icon;
      var iconColor = iconColors[matIcon] || '#6366f1';
      var iconBg = isDanger ? 'rgba(239,68,68,0.08)' : 'rgba(99,102,241,0.08)';
      titleIcon = '<span style="display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:8px;background:' + iconBg + ';margin-right:8px;flex-shrink:0">' +
        '<span class="material-icons" style="font-size:18px;color:' + iconColor + '">' + matIcon + '</span></span>';
    }

    modal.innerHTML = '<h3>' + titleIcon + escapeHtml(title || 'Message') + '</h3>' +
      '<div class="notif-modal-body">' + prettyFormatMessage(msg, options.isHtml) + '</div>' +
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
        document.removeEventListener('keydown', keyHandler, true);
      };
      btnContainer.appendChild(button);
    });

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    var keyHandler = function(e) {
      if (!document.body.contains(overlay)) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        var cancelBtn = modal.querySelector('.notif-btn-secondary');
        if (cancelBtn) {
          cancelBtn.click();
        } else {
          document.body.removeChild(overlay);
          document.removeEventListener('keydown', keyHandler);
        }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        var primaryBtn = modal.querySelector('.notif-btn-primary') || modal.querySelector('.notif-btn-danger');
        if (primaryBtn) {
          primaryBtn.click();
        }
      }
    };
    document.addEventListener('keydown', keyHandler, true); // use capture phase to prevent other Enter listeners

    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) {
        var cancelBtn = modal.querySelector('.notif-btn-secondary');
        if (cancelBtn) {
          cancelBtn.click();
        } else {
          document.body.removeChild(overlay);
          document.removeEventListener('keydown', keyHandler, true);
        }
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
      var icon = options.icon || (isDanger ? 'warning' : 'info');
      createModal(msg, title || 'Confirm', [
        {label: cancelLabel, primary: false, callback: function() { if (callback) callback(false); }},
        {label: confirmLabel, primary: !isDanger, danger: isDanger, callback: function() { if (callback) callback(true); }}
      ], {icon: icon, isHtml: options.isHtml});
    },
    backend: function(msg, title, type, buttons) {
      buttons = buttons || [{label:'OK', primary:true, callback:null}];
      createModal(msg, title, buttons, {icon: type || 'info'});
    }
  };
})();

if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',function(){NotificationSystem.init()})} else {NotificationSystem.init();}

// AI COMMENT: Consolidated notification system - Purple theme aligned
// REPLACES: showAnvilNotification() [line 84], showAnvilConfirm() [line 109], showBackendMessage() [line 152]
// USAGE: NotificationSystem.toast/success/error/confirm/backend()
