'use strict';
// Minimal, dependency-free HTML sanitizer for WYSIWYG body content.
// Allowlists a small set of formatting tags and safe attributes, and strips
// scripts, event handlers, and dangerous URL schemes. This is intentionally
// conservative: content comes only from the authenticated admin, but we still
// sanitize before storing so nothing unexpected is persisted or rendered.

const ALLOWED_TAGS = new Set([
  'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'blockquote',
  'h1', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'a', 'hr', 'span', 'img',
]);

// Attributes allowed per tag. Everything else is dropped.
const ALLOWED_ATTRS = {
  a: ['href', 'title', 'target', 'rel'],
  img: ['src', 'alt'],
};

function stripDangerousBlocks(html) {
  // Remove entire <script>/<style> blocks and HTML comments.
  return String(html)
    .replace(/<!--([\s\S]*?)-->/g, '')
    .replace(/<script\b[\s\S]*?<\/script\s*>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style\s*>/gi, '')
    .replace(/<script\b[^>]*>/gi, '')
    .replace(/<style\b[^>]*>/gi, '');
}

function safeHref(value) {
  const v = String(value).trim();
  // Allow http, https, mailto, and relative/anchor links only.
  if (/^(https?:|mailto:)/i.test(v)) return v;
  if (/^[/#]/.test(v)) return v;
  if (/^[a-z0-9._~%-]+(\/|$)/i.test(v) && !/^[a-z]+:/i.test(v)) return v;
  return null; // reject javascript:, data:, etc.
}

// Image src: allow local paths (e.g. /uploads/...) and http(s) URLs only.
function safeSrc(value) {
  const v = String(value).trim();
  if (/^https?:\/\//i.test(v)) return v;
  if (/^\//.test(v)) return v; // local absolute path like /uploads/works/x.jpg
  return null; // reject data:, javascript:, etc.
}

// Rebuild each tag from its allowlisted attributes only.
function sanitizeTag(rawTag) {
  const m = rawTag.match(/^<\s*(\/?)([a-zA-Z0-9]+)([\s\S]*?)(\/?)>$/);
  if (!m) return '';
  const closing = m[1] === '/';
  const tag = m[2].toLowerCase();
  const attrPart = m[3] || '';
  const selfClose = m[4] === '/';

  if (!ALLOWED_TAGS.has(tag)) return '';
  if (closing) return `</${tag}>`;

  let out = `<${tag}`;
  const allowed = ALLOWED_ATTRS[tag];
  if (allowed) {
    const attrRe = /([a-zA-Z-]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
    let a;
    const seen = {};
    while ((a = attrRe.exec(attrPart)) !== null) {
      const name = a[1].toLowerCase();
      let val = a[3] !== undefined ? a[3] : a[4];
      if (name.startsWith('on')) continue; // never allow event handlers
      if (!allowed.includes(name)) continue;
      if (name === 'href') {
        const safe = safeHref(val);
        if (!safe) continue;
        val = safe;
      }
      if (name === 'src') {
        const safe = safeSrc(val);
        if (!safe) continue;
        val = safe;
      }
      val = val.replace(/"/g, '&quot;');
      seen[name] = val;
    }
    // Force safe rel/target on links that open externally.
    if (tag === 'a' && seen.target === '_blank') seen.rel = 'noopener noreferrer';
    // Drop an <img> with no valid src entirely.
    if (tag === 'img' && !seen.src) return '';
    Object.keys(seen).forEach((k) => { out += ` ${k}="${seen[k]}"`; });
  }
  // Self-close void elements.
  if (tag === 'br' || tag === 'hr' || tag === 'img') { out += '/>'; return out; }
  out += '>';
  return out;
}

function sanitizeHtml(html) {
  if (!html) return '';
  let s = stripDangerousBlocks(html);
  // Walk tags; escape any stray < that isn't part of an allowed tag.
  let out = '';
  let i = 0;
  while (i < s.length) {
    const lt = s.indexOf('<', i);
    if (lt === -1) {
      out += s.slice(i);
      break;
    }
    out += s.slice(i, lt);
    const gt = s.indexOf('>', lt);
    if (gt === -1) {
      out += s.slice(lt).replace(/</g, '&lt;');
      break;
    }
    const rawTag = s.slice(lt, gt + 1);
    out += sanitizeTag(rawTag);
    i = gt + 1;
  }
  return out.trim();
}

module.exports = { sanitizeHtml };
