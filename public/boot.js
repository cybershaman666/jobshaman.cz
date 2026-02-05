// ROBUST POLYFILLS FOR BROWSER ENVIRONMENT
window.global = window;

// Process Polyfill
window.process = {
  env: {
    NODE_ENV: 'development'
  },
  version: 'v16.0.0',
  versions: {
    node: '16.0.0'
  },
  nextTick: function (cb) { setTimeout(cb, 0); },
  cwd: function () { return '/'; }
};

// Buffer Polyfill (Required for some JWT libraries used by Supabase)
if (!window.Buffer) {
  window.Buffer = {
    isBuffer: function (obj) {
      return obj && obj.constructor && obj.constructor.name === 'Buffer';
    },
    from: function (data, encoding) {
      if (typeof data === 'string' && encoding === 'base64') {
        try {
          const binString = atob(data);
          const bytes = new Uint8Array(binString.length);
          for (let i = 0; i < binString.length; i++) {
            bytes[i] = binString.charCodeAt(i);
          }
          return bytes;
        } catch (e) {
          console.warn('Buffer.from polyfill failed for base64', e);
          return new Uint8Array(0);
        }
      }
      if (Array.isArray(data) || data instanceof Uint8Array) {
        return new Uint8Array(data);
      }
      if (typeof data === 'string') {
        return new TextEncoder().encode(data);
      }
      return new Uint8Array(0);
    },
    alloc: function (size) {
      return new Uint8Array(size);
    }
  };
}

// VISUAL ERROR TRAP
window.onerror = function (message) {
  console.error('Critical Error:', message);
  // Only take over screen for fatal errors, not 404s
  if (String(message).includes('import') || String(message).includes('module')) {
    const root = document.getElementById('root');
    if (root && root.innerHTML.trim() === '') {
      const wrapper = document.createElement('div');
      wrapper.className = 'boot-error';

      const title = document.createElement('h1');
      title.className = 'boot-error__title';
      title.textContent = 'App Startup Error';

      const msg = document.createElement('p');
      msg.className = 'boot-error__message';
      msg.textContent = String(message);

      const button = document.createElement('button');
      button.className = 'boot-error__button';
      button.type = 'button';
      button.textContent = 'Reload';
      button.addEventListener('click', function () {
        window.location.reload();
      });

      wrapper.appendChild(title);
      wrapper.appendChild(msg);
      wrapper.appendChild(button);
      root.appendChild(wrapper);
    }
  }
};
