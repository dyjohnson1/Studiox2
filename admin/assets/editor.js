/* Xavier Haughton Studios — lightweight WYSIWYG editor (dependency-free).
   Usage:
     const ed = XHSEditor.mount('#editorMount', initialHtml);
     ed.getHTML();  // -> string of HTML
     ed.setHTML(s); // replace content
   Uses document.execCommand for broad, zero-dependency browser support. */
(function () {
  var TOOLBAR = [
    { cmd: 'formatBlock', value: 'H2', label: 'H2', title: 'Heading' },
    { cmd: 'formatBlock', value: 'H3', label: 'H3', title: 'Subheading' },
    { cmd: 'formatBlock', value: 'P', label: '¶', title: 'Paragraph' },
    { sep: true },
    { cmd: 'bold', label: 'B', title: 'Bold', style: 'font-weight:700;' },
    { cmd: 'italic', label: 'I', title: 'Italic', style: 'font-style:italic;' },
    { cmd: 'underline', label: 'U', title: 'Underline', style: 'text-decoration:underline;' },
    { sep: true },
    { cmd: 'formatBlock', value: 'BLOCKQUOTE', label: '❝', title: 'Quote' },
    { cmd: 'insertUnorderedList', label: '• List', title: 'Bulleted list' },
    { cmd: 'insertOrderedList', label: '1. List', title: 'Numbered list' },
    { sep: true },
    { cmd: 'createLink', label: 'Link', title: 'Insert link', prompt: true },
    { cmd: 'unlink', label: 'Unlink', title: 'Remove link' },
    { sep: true },
    { cmd: 'insertImage', label: '🖼 Image', title: 'Insert image', image: true },
    { sep: true },
    { cmd: 'removeFormat', label: 'Clear', title: 'Clear formatting' },
  ];

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }

  function mount(target, initialHtml) {
    var mountEl = typeof target === 'string' ? document.querySelector(target) : target;
    if (!mountEl) throw new Error('XHSEditor: mount target not found');

    var wrap = el('div', 'xhs-editor');
    var bar = el('div', 'xhs-toolbar');
    var area = el('div', 'xhs-content');
    area.setAttribute('contenteditable', 'true');
    area.setAttribute('role', 'textbox');
    area.setAttribute('aria-multiline', 'true');
    area.innerHTML = initialHtml || '<p><br></p>';

    // Hidden file input used by the "Insert Image" toolbar button.
    var fileInput = el('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/jpeg,image/png,image/webp';
    fileInput.style.display = 'none';
    var savedRange = null;

    function saveSelection() {
      var sel = window.getSelection();
      if (sel && sel.rangeCount && area.contains(sel.anchorNode)) {
        savedRange = sel.getRangeAt(0);
      }
    }
    function restoreSelection() {
      if (!savedRange) return;
      var sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(savedRange);
    }

    fileInput.addEventListener('change', function () {
      var file = fileInput.files && fileInput.files[0];
      fileInput.value = '';
      if (!file) return;
      var fd = new FormData();
      fd.append('image', file);
      // Show a lightweight inline status by disabling nothing; just upload.
      fetch('/api/upload', { method: 'POST', body: fd, credentials: 'same-origin' })
        .then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.error || 'Upload failed'); return d; }); })
        .then(function (res) {
          area.focus();
          restoreSelection();
          // Insert the image at the caret. Wrap in a paragraph break for spacing.
          document.execCommand('insertHTML', false, '<img src="' + res.path + '" alt="">');
          syncEmpty();
        })
        .catch(function (err) { window.alert(err.message || 'Image upload failed.'); });
    });

    TOOLBAR.forEach(function (item) {
      if (item.sep) { bar.appendChild(el('span', 'xhs-sep')); return; }
      var b = el('button', 'xhs-btn', item.label);
      b.type = 'button';
      b.title = item.title || '';
      if (item.style) b.setAttribute('style', item.style);
      b.addEventListener('mousedown', function (e) { e.preventDefault(); }); // keep selection
      b.addEventListener('click', function () {
        area.focus();
        if (item.image) {
          saveSelection();
          fileInput.click();
        } else if (item.prompt) {
          var url = window.prompt('Link URL (https://…):', 'https://');
          if (!url) return;
          document.execCommand(item.cmd, false, url);
        } else if (item.value) {
          document.execCommand(item.cmd, false, item.value);
        } else {
          document.execCommand(item.cmd, false, null);
        }
        syncEmpty();
      });
      bar.appendChild(b);
    });

    // Ensure there's always at least an empty paragraph so the caret behaves.
    function syncEmpty() {
      if (!area.textContent.trim() && !area.querySelector('img,hr,li')) {
        if (area.innerHTML.replace(/<br\s*\/?>/gi, '').trim() === '') {
          area.innerHTML = '<p><br></p>';
        }
      }
    }
    area.addEventListener('input', syncEmpty);

    // Paste as plain text to avoid importing messy external markup.
    area.addEventListener('paste', function (e) {
      e.preventDefault();
      var text = (e.clipboardData || window.clipboardData).getData('text/plain');
      document.execCommand('insertText', false, text);
    });

    wrap.appendChild(bar);
    wrap.appendChild(area);
    wrap.appendChild(fileInput);
    mountEl.innerHTML = '';
    mountEl.appendChild(wrap);

    return {
      getHTML: function () {
        syncEmpty();
        return area.innerHTML.trim();
      },
      setHTML: function (html) {
        area.innerHTML = html || '<p><br></p>';
      },
      focus: function () { area.focus(); },
      element: area,
    };
  }

  window.XHSEditor = { mount: mount };
})();
