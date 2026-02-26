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

  function formatMessage(msg) {
    if (!msg) return '';
    var parts = String(msg).split(/\n/);
    var result = [];
    for (var i = 0; i < parts.length; i++) result.push(escapeHtml(parts[i]));
    return result.join('<br>');
  }

  function resolveIcon(name) {
    if (!name) return 'info';
    if (name === 'success') return 'check_circle';
    if (/[^\x20-\x7E]/.test(name)) return 'delete';
    return name;
  }

  var ICON_COLORS = {
    check_circle: '#10b981',
    error: '#ef4444',
    warning: '#f59e0b',
    info: '#6366f1',
    delete: '#ef4444',
    refresh: '#ef4444'
  };

  function injectStyles() {
    if (document.getElementById('notification-styles')) return;
    var el = document.createElement('style');
    el.id = 'notification-styles';

    var themes = {
      success: ['#f0fdf4','#10b981','#065f46','#dcfce7','#059669','#022c22','#a7f3d0','rgba(16,185,129,0.2)','#34d399'],
      error:   ['#fef2f2','#ef4444','#991b1b','#fee2e2','#dc2626','#2a0a0a','#fca5a5','rgba(239,68,68,0.2)','#f87171'],
      warning: ['#fffbeb','#f59e0b','#92400e','#fef3c7','#d97706','#2a1f00','#fde68a','rgba(245,158,11,0.2)','#fbbf24'],
      info:    ['#f5f3ff','#6366f1','#312e81','#ede9fe','#6366f1','#1e1b4b','#ddd6fe','rgba(99,102,241,0.2)','#818cf8']
    };

    var css = [
      '@keyframes notif-slideDown{from{transform:translateY(-20px);opacity:0}to{transform:translateY(0);opacity:1}}',
      '@keyframes notif-fadeIn{from{opacity:0}to{opacity:1}}',
      '@keyframes notif-slideUp{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}',
      '.notif-toast{animation:notif-slideDown .35s cubic-bezier(.21,1.02,.73,1);padding:10px 16px 10px 14px;border-radius:8px;border-left:4px solid transparent;display:flex;align-items:center;gap:10px;font-family:"Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;font-size:13px;line-height:1.5;box-shadow:0 4px 14px rgba(0,0,0,.12);pointer-events:auto;min-width:280px;max-width:480px;word-break:break-word;position:relative}',
      '.notif-toast-icon{width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;flex-shrink:0}',
      '.notif-toast-text{flex:1;font-weight:500}',
      '.notif-toast-close{background:none;border:none;cursor:pointer;font-size:16px;opacity:.45;transition:opacity .2s;padding:0 0 0 8px;flex-shrink:0;line-height:1}',
      '.notif-toast-close:hover{opacity:.8}'
    ];

    for (var type in themes) {
      var t = themes[type], pre = '.notif-toast-' + type;
      css.push(
        pre + '{background-color:' + t[0] + ';border-left-color:' + t[1] + ';color:' + t[2] + '}',
        pre + ' .notif-toast-icon{background:' + t[3] + ';color:' + t[4] + '}',
        pre + ' .notif-toast-close{color:' + t[2] + '}',
        '.dark-mode ' + pre + '{background:' + t[5] + ';border-left-color:' + t[1] + ';color:' + t[6] + '}',
        '.dark-mode ' + pre + ' .notif-toast-icon{background:' + t[7] + ';color:' + t[8] + '}',
        '.dark-mode ' + pre + ' .notif-toast-close{color:' + t[6] + '}'
      );
    }
    css.push('.dark-mode .notif-toast{box-shadow:0 4px 14px rgba(0,0,0,.4)}');

    css.push(
      '.notif-modal-overlay{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;z-index:10001;animation:notif-fadeIn .2s ease-out;backdrop-filter:blur(4px)}',
      '.notif-modal{background:#fff;border-radius:12px;padding:22px;max-width:420px;width:90%;box-shadow:0 25px 50px rgba(0,0,0,.12);animation:notif-slideUp .3s ease-out;font-family:"Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;border:1px solid rgba(0,0,0,.04)}',
      '.notif-modal h3{margin:0 0 12px;font-size:16px;font-weight:600;color:#1e293b;display:flex;align-items:center;padding-bottom:12px;border-bottom:1px solid rgba(0,0,0,.06)}',
      '.notif-modal .notif-modal-body{margin:0 0 18px;font-size:14px;color:#475569;line-height:1.5;word-break:break-word}',
      '.notif-modal .notif-modal-body p{margin:0 0 6px}',
      '.notif-modal .notif-modal-body p:last-child{margin-bottom:0}',
      '.notif-modal .notif-modal-body ul{margin:6px 0 10px;padding-left:20px;list-style:none}',
      '.notif-modal .notif-modal-body li{margin-bottom:5px;position:relative;padding-left:14px}',
      '.notif-modal .notif-modal-body li::before{content:"";position:absolute;left:0;top:8px;width:5px;height:5px;border-radius:50%;background:#6366f1}',
      '.notif-modal-buttons{margin-top:20px;padding-top:14px;display:flex;gap:10px;justify-content:flex-end}',
      '.notif-modal button{padding:7px 16px;border-radius:7px;border:none;font-size:12.5px;font-weight:600;cursor:pointer;transition:all .2s ease;font-family:inherit}',
      '.notif-modal button:hover{transform:translateY(-1px)}',
      '.notif-modal button:active{transform:translateY(0)}',
      '.notif-btn-primary{background:linear-gradient(135deg,#6366f1,#312e81);color:#fff;box-shadow:0 4px 12px rgba(99,102,241,.35)}',
      '.notif-btn-primary:hover{box-shadow:0 6px 16px rgba(99,102,241,.5)}',
      '.notif-btn-secondary{background:#f1f5f9;color:#475569;border:1px solid #e2e8f0}',
      '.notif-btn-secondary:hover{background:#e2e8f0;border-color:#cbd5e1}',
      '.notif-btn-danger{background:linear-gradient(135deg,#ef4444,#dc2626);color:#fff;box-shadow:0 4px 12px rgba(239,68,68,.35)}',
      '.notif-btn-danger:hover{box-shadow:0 6px 16px rgba(239,68,68,.5)}',
      '.notif-modal-danger{border-top:3px solid transparent}',
      '.notif-modal-danger h3{color:var(--color-slate-800)}',
      '.notif-modal-danger .notif-modal-body{color:#64748b}',
      '.notif-prompt-input:focus{border-color:#6366f1;box-shadow:0 0 0 2px rgba(99,102,241,.2)}',
      '.theme-text-strong{color:#334155}',
      '.theme-text{color:#475569}',
      '.theme-text-muted{color:#64748b}',
      '.dark-mode .notif-modal{background:rgba(32,32,38,.97);border:1px solid rgba(255,255,255,.06);box-shadow:0 25px 50px rgba(0,0,0,.45)}',
      '.dark-mode .notif-modal h3{color:#f1f5f9 !important;border-bottom-color:rgba(255,255,255,.06) !important}',
      '.dark-mode .notif-modal .notif-modal-body{color:#94a3b8 !important}',
      '.dark-mode .notif-modal-icon-delete{background:transparent !important;border-color:rgba(255,255,255,.1) !important}',
      '.dark-mode .notif-modal-icon-delete .material-icons{color:#94a3b8 !important}',
      '.dark-mode .notif-modal .notif-modal-body li::before{background:#a5b4fc}',
      '.dark-mode .notif-btn-secondary{background:#2a2a30;color:#cbd5e1;border-color:#404048}',
      '.dark-mode .notif-btn-secondary:hover{background:#3a3a42;border-color:#505058}',
      '.dark-mode .notif-modal-overlay{background:rgba(0,0,0,.6)}',
      '.dark-mode .notif-modal-danger h3{color:#f1f5f9 !important}',
      '.dark-mode .notif-modal-danger .notif-modal-body{color:#94a3b8 !important}',
      '.dark-mode .notif-prompt-input{background:#1e1e24;color:#e2e8f0;border-color:#404048}',
      '.dark-mode .notif-prompt-input:focus{border-color:#6366f1}',
      '.dark-mode .theme-text-strong{color:#f1f5f9 !important}',
      '.dark-mode .theme-text{color:#e2e8f0 !important}',
      '.dark-mode .theme-text-muted{color:#94a3b8 !important}'
    );

    el.textContent = css.join('');
    document.head.appendChild(el);
  }

  function createToast(msg, type) {
    initContainer();
    var toast = document.createElement('div');
    toast.className = 'notif-toast notif-toast-' + type;
    var iconName = resolveIcon(type);

    toast.innerHTML =
      '<span class="notif-toast-icon"><span class="material-icons" style="font-size:16px">' + iconName + '</span></span>' +
      '<span class="notif-toast-text">' + formatMessage(msg) + '</span>' +
      '<button class="notif-toast-close" aria-label="Close"><span class="material-icons" style="font-size:16px">close</span></button>';

    toast.querySelector('.notif-toast-close').onclick = function() { dismissToast(toast); };
    toastContainer.appendChild(toast);
    toast._autoTimer = setTimeout(function() { dismissToast(toast); }, 4000);
  }

  function dismissToast(toast) {
    if (toast._dismissed) return;
    toast._dismissed = true;
    if (toast._autoTimer) clearTimeout(toast._autoTimer);
    toast.style.cssText = 'opacity:0;transform:translateY(-10px);transition:opacity .3s,transform .3s';
    setTimeout(function() {
      if (toastContainer && toastContainer.contains(toast)) toastContainer.removeChild(toast);
    }, 300);
  }

  function prettyFormatMessage(msg, isHtml) {
    if (isHtml) return msg;
    if (!msg) return '';
    var lines = String(msg).split(/\n/);
    var html = '', inList = false;

    for (var i = 0; i < lines.length; i++) {
      var trimmed = lines[i].replace(/^\s+/, '');
      if (/^[-•]\s/.test(trimmed)) {
        if (!inList) { html += '<ul style="margin:8px 0;padding-left:20px;">'; inList = true; }
        var text = escapeHtml(trimmed.replace(/^[-•]\s*/, ''));
        html += '<li>' + text.replace(/^([A-Za-z][A-Za-z0-9 ]*:)/, '<strong>$1</strong>') + '</li>';
      } else {
        if (inList) { html += '</ul>'; inList = false; }
        html += trimmed === '' ? '<div style="height:8px"></div>'
          : '<p style="margin:0 0 6px">' + escapeHtml(trimmed) + '</p>';
      }
    }
    if (inList) html += '</ul>';
    return html;
  }

  function buildIconHtml(matIcon, iconColor, extraClass) {
    return '<span class="notif-modal-icon-container' + extraClass +
      '" style="display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:6px;background:transparent;margin-right:10px;flex-shrink:0">' +
      '<span class="material-icons" style="font-size:22px;color:' + iconColor + '">' + matIcon + '</span></span>';
  }

  function createModal(msg, title, buttons, options) {
    options = options || {};
    var overlay = document.createElement('div');
    overlay.className = 'notif-modal-overlay';
    var modal = document.createElement('div');
    var isDanger = buttons.some(function(b) { return b.danger; });
    modal.className = 'notif-modal' + (isDanger ? ' notif-modal-danger' : '');

    var matIcon = resolveIcon(options.icon || (isDanger ? 'warning' : 'info'));
    var iconColor = ICON_COLORS[matIcon] || (isDanger ? '#ef4444' : '#6366f1');
    var extraClass = (isDanger && matIcon === 'delete') ? ' notif-modal-icon-delete' : '';

    modal.innerHTML =
      '<h3>' + buildIconHtml(matIcon, iconColor, extraClass) + escapeHtml(title || 'Message') + '</h3>' +
      '<div class="notif-modal-body">' + prettyFormatMessage(msg, options.isHtml) + '</div>' +
      '<div class="notif-modal-buttons"></div>';

    var btnContainer = modal.querySelector('.notif-modal-buttons');
    var dismissed = false;
    function dismissModal() {
      if (dismissed) return;
      dismissed = true;
      if (document.body.contains(overlay)) document.body.removeChild(overlay);
      document.removeEventListener('keydown', keyHandler, true);
    }
    buttons.forEach(function(btn) {
      var button = document.createElement('button');
      button.textContent = btn.label;
      button.className = btn.danger ? 'notif-btn-danger' : btn.primary ? 'notif-btn-primary' : 'notif-btn-secondary';
      button.onclick = function() {
        try { if (btn.callback) btn.callback(); } catch(e) { console.error('Modal callback error:', e); }
        dismissModal();
      };
      btnContainer.appendChild(button);
    });

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    var keyHandler = function(e) {
      if (dismissed) return;
      if (e.key === 'Escape') {
        e.preventDefault(); e.stopPropagation();
        var cancelBtn = modal.querySelector('.notif-btn-secondary');
        if (cancelBtn) cancelBtn.click(); else dismissModal();
      } else if (e.key === 'Enter') {
        e.preventDefault(); e.stopPropagation();
        var primaryBtn = modal.querySelector('.notif-btn-primary') || modal.querySelector('.notif-btn-danger');
        if (primaryBtn) primaryBtn.click();
      }
    };
    document.addEventListener('keydown', keyHandler, true);

    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) {
        var cancelBtn = modal.querySelector('.notif-btn-secondary');
        if (cancelBtn) cancelBtn.click(); else dismissModal();
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
      var icon = options.icon || (isDanger ? 'warning' : 'info');
      createModal(msg, title || 'Confirm', [
        {label: options.cancelLabel || 'Cancel', primary: false, callback: function() { if (callback) callback(false); }},
        {label: options.confirmLabel || 'Confirm', primary: !isDanger, danger: isDanger, callback: function() { if (callback) callback(true); }}
      ], {icon: icon, isHtml: options.isHtml});
    },
    prompt: function(msg, title, callback, options) {
      options = options || {};
      var formHtml = '<div style="margin-top:15px">' +
        '<input type="' + (options.inputType || 'text') + '" id="notif-prompt-input" class="notif-prompt-input" ' +
        'placeholder="' + (options.inputPlaceholder || '') + '" ' +
        'style="width:100%;padding:10px 12px;border:1px solid #cbd5e1;border-radius:6px;font-size:14px;box-sizing:border-box;outline:none;transition:border-color .2s" /></div>';

      createModal(prettyFormatMessage(msg, false) + formHtml, title || 'Input Required', [
        {label: options.cancelLabel || 'Cancel', primary: false, callback: function() { if (callback) callback(null); }},
        {label: options.confirmLabel || 'Submit', primary: true, callback: function() {
          var inputEl = document.getElementById('notif-prompt-input');
          if (callback && inputEl) callback(inputEl.value);
        }}
      ], {icon: 'info', isHtml: true});

      setTimeout(function() {
        var inputEl = document.getElementById('notif-prompt-input');
        if (inputEl) inputEl.focus();
      }, 50);
    },
    backend: function(msg, title, type, buttons) {
      buttons = buttons || [{label: 'OK', primary: true, callback: null}];
      createModal(msg, title, buttons, {icon: type || 'info'});
    }
  };
})();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() { NotificationSystem.init(); });
} else {
  NotificationSystem.init();
}
