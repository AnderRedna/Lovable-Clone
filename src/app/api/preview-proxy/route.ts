import type { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");
  const edit = searchParams.get("edit") === "1";
  if (!url) {
    return new Response("Missing url", { status: 400 });
  }

  let res: Response;
  try {
    res = await fetch(url, {
      // Revalidate quickly; this is a preview proxy
      cache: "no-store",
      headers: { "user-agent": "Mozilla/5.0 (Proxy)" },
    });
  } catch (e) {
    return new Response("Failed to fetch target", { status: 502 });
  }

  const html = await res.text();
  const targetOrigin = (() => {
    try {
      return new URL(url).origin;
    } catch {
      return "";
    }
  })();

  const sanitized = edit ? stripScripts(html) : html;
  const rewritten = edit ? rewriteRelativeUrls(sanitized, targetOrigin) : sanitized;
  const withGuard = injectHistoryGuard(rewritten);
  const withScript = injectEditorScript(withGuard, edit);

  return new Response(withScript, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
    },
  });
}

// intentionally no <base> injection; base can confuse Next's router and cause cross-origin history updates

function injectHistoryGuard(html: string) {
  const guard = `\n<script>(function(){\n  try {\n    var _rp = history.replaceState;\n    history.replaceState = function(state, title, url){\n      try { if (url) { var u = new URL(url, location.href); if (u.origin !== location.origin) return; } } catch(e) {}\n      return _rp.apply(this, arguments);\n    };\n    var _ps = history.pushState;\n    history.pushState = function(state, title, url){\n      try { if (url) { var u = new URL(url, location.href); if (u.origin !== location.origin) return; } } catch(e) {}\n      return _ps.apply(this, arguments);\n    };\n    var _assign = location.assign;\n    location.assign = function(url){ try { var u=new URL(url, location.href); if(u.origin!==location.origin) return; } catch(e){} return _assign.apply(this, arguments); };\n    var _replace = location.replace;\n    location.replace = function(url){ try { var u=new URL(url, location.href); if(u.origin!==location.origin) return; } catch(e){} return _replace.apply(this, arguments); };\n  } catch(e) {}\n})();</script>\n`;
  if (/<head\b[^>]*>/i.test(html)) {
    return html.replace(/<head\b[^>]*>/i, (m) => `${m}\n${guard}`);
  }
  return guard + html;
}

function stripScripts(html: string) {
  try {
    // Remove all script tags (inline and external)
    return html.replace(/<script\b[\s\S]*?<\/script>/gi, "");
  } catch {
    return html;
  }
}

function rewriteRelativeUrls(html: string, origin: string) {
  if (!origin) return html;
  let out = html;
  // href="/path" or src="/path" -> absolute
  out = out.replace(/\b(href|src)=(\"|\')(\/(?!\/)[^\"']*)(\2)/gi, (_m, attr, q, path, q2) => {
    return `${attr}=${q}${origin}${path}${q2}`;
  });
  // srcset: 
  out = out.replace(/\bsrcset=(\"|\')([^\"']+)(\1)/gi, (_m: string, q: string, value: string, q2: string) => {
    const parts = value.split(',').map((s: string) => s.trim()).filter(Boolean);
    const mapped = parts.map((p: string) => {
      const [url, desc] = p.split(/\s+/, 2) as [string, string | undefined];
      if (url && url.startsWith('/')) {
        return `${origin}${url}${desc ? ` ${desc}` : ''}`;
      }
      return p;
    });
    return `srcset=${q}${mapped.join(', ')}${q2}`;
  });
  return out;
}

function injectEditorScript(html: string, edit: boolean) {
  const script = `
<script>(function(){
  // Guard history API to avoid cross-origin URL updates from Next Router
  try {
    var _rp = history.replaceState;
    history.replaceState = function(state, title, url){
      try {
        if (url) {
          var u = new URL(url, location.href);
          if (u.origin !== location.origin) return; // ignore cross-origin
        }
      } catch(e) {}
      return _rp.apply(this, arguments);
    };
    var _ps = history.pushState;
    history.pushState = function(state, title, url){
      try {
        if (url) {
          var u = new URL(url, location.href);
          if (u.origin !== location.origin) return; // ignore cross-origin
        }
      } catch(e) {}
      return _ps.apply(this, arguments);
    };
  } catch(e) {}

  var state = new Map();
  var enabled = false;
  var teardownFns = [];
  // Inject minimal styles for visibility (red outline)
  try {
    var __style = document.createElement('style');
    __style.setAttribute('data-inline-style','1');
    __style.textContent = '[data-inline-wrapper][contenteditable="true"]{outline:1.5px dashed rgba(239,68,68,0.95);outline-offset:2px}'+
                          '[data-inline-wrapper][contenteditable="true"]:hover,[data-inline-wrapper][contenteditable="true"]:focus{outline-color:#ef4444;background:rgba(239,68,68,0.06)}';
    (document.head||document.documentElement).appendChild(__style);
    teardownFns.push(function(){ try{ __style.remove(); }catch(e){} });
  } catch(e) {}
  function getSelector(el){
    var parts=[]; var cur=el; var root=document.body;
    while(cur && cur!==root){
      var name=cur.tagName.toLowerCase();
      var idx=0, sibs=cur.parentElement?cur.parentElement.children:[];
      var same=Array.prototype.filter.call(sibs, function(s){return s.tagName===cur.tagName});
      idx = same.indexOf(cur)+1; if(idx<1) idx=1;
      parts.unshift(name+':nth-of-type('+idx+')');
      cur=cur.parentElement;
    }
    return parts.join(' > ');
  }
  function setup(){
    var excludedTags = new Set(['SCRIPT','STYLE','SVG']);
    var nextId = 1;

    // 1) Wrap all visible text nodes into editable spans
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: function(node){
        try {
          var text = (node.nodeValue||'').trim();
          if (!text) return NodeFilter.FILTER_REJECT;
          var parent = node.parentElement;
          if (!parent || excludedTags.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
          if (parent.closest('[data-inline-wrapper]')) return NodeFilter.FILTER_REJECT; // already wrapped
          return NodeFilter.FILTER_ACCEPT;
        } catch(e){ return NodeFilter.FILTER_REJECT; }
      }
    }, false);

    var nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);

    nodes.forEach(function(textNode){
      if (!enabled) return;
      var parent = textNode.parentElement; if (!parent) return;
      var key = String(nextId++);
      var oldText = (textNode.nodeValue||'').trim();
      var span = document.createElement('span');
      span.setAttribute('data-inline-wrapper','1');
      span.setAttribute('data-inline-id', key);
      span.setAttribute('contenteditable','true');
      span.style.outline='1.5px dashed rgba(239,68,68,0.95)';
      span.style.outlineOffset='2px';
      span.textContent = oldText;
      parent.replaceChild(span, textNode);

      function onInput(){
        var newText = (span.textContent||'').trim();
        var selector = getSelector(span);
        state.set(key, { key: key, selector: selector, oldText: oldText, newText: newText });
        try { parent_post({ type:'inline-edits' }); } catch(e){}
      }
      function stopClick(e){ try{ e.preventDefault(); e.stopImmediatePropagation(); e.stopPropagation(); }catch(_){} }
      span.addEventListener('input', onInput);
      span.addEventListener('click', stopClick);
      span.addEventListener('dblclick', stopClick);

      teardownFns.push(function(){ try{ span.removeEventListener('input', onInput); span.removeEventListener('click', stopClick); span.removeEventListener('dblclick', stopClick);}catch(e){}; try{ var t=document.createTextNode(span.textContent||''); parent.replaceChild(t, span); }catch(e){} });
    });

    // 2) Placeholder editing for input/textarea via dblclick -> prompt
    var placeholders = Array.prototype.slice.call(document.querySelectorAll('input[placeholder], textarea[placeholder]'));
    placeholders.forEach(function(el){
      var key = String(nextId++);
      var attr = 'placeholder';
      var oldText = (el.getAttribute(attr)||'').trim();
      function onDbl(ev){
        try{ ev.preventDefault(); ev.stopImmediatePropagation(); ev.stopPropagation(); }catch(_){}
        if (!enabled) return;
        var cur = (el.getAttribute(attr)||'');
        var next = null;
        try { next = window.prompt('Editar placeholder:', cur); } catch(e) { next = null; }
        if (next === null) return;
        try { el.setAttribute(attr, next); } catch {}
        var selector = getSelector(el);
        state.set(key, { key: key, selector: selector, oldText: oldText, newText: String(next) });
        try { parent_post({ type:'inline-edits' }); } catch(e){}
      }
      el.addEventListener('dblclick', onDbl);
      teardownFns.push(function(){ try{ el.removeEventListener('dblclick', onDbl); }catch(e){} });
    });
  }
  function parent_post(msg){ try { parent.postMessage({ ...msg, edits: Array.from(state.values()) }, '*'); } catch(e){} }
  function enable(){ enabled = true; teardown(); setup(); }
  function disable(){ enabled = false; teardown(); }
  function teardown(){ while(teardownFns.length){ try{ (teardownFns.pop())(); }catch(e){} } }

  // Prevent button/form actions when clicking editable text spans
  function isEditableTarget(t){ try { return !!(t && (t.closest && t.closest('[data-inline-wrapper][contenteditable="true"]'))); } catch(e){ return false; } }
  function guardClick(e){ if(!enabled) return; var t=e.target; if(isEditableTarget(t)){ try{ e.preventDefault(); e.stopImmediatePropagation(); e.stopPropagation(); }catch(_){} } }
  function guardDown(e){ if(!enabled) return; var t=e.target; if(isEditableTarget(t)){ try{ e.stopImmediatePropagation(); e.stopPropagation(); }catch(_){} } }
  try {
    document.addEventListener('click', guardClick, true);
    document.addEventListener('submit', guardClick, true);
    document.addEventListener('pointerdown', guardDown, true);
    document.addEventListener('pointerup', guardClick, true);
    teardownFns.push(function(){ try{ document.removeEventListener('click', guardClick, true); document.removeEventListener('submit', guardClick, true); document.removeEventListener('pointerdown', guardDown, true); document.removeEventListener('pointerup', guardClick, true);}catch(e){} });
  } catch(e) {}

  window.addEventListener('message', function(ev){
    var data = ev && ev.data || {};
    if(data && data.type==='collect-edits'){
      parent_post({ type:'inline-edits' });
    } else if (data && data.type==='enable-editing') {
      enable();
    } else if (data && data.type==='disable-editing') {
      disable();
    }
  });
  function init(){
    try { parent.postMessage({ type: 'proxy-ready' }, '*'); } catch (e) {}
    setTimeout(function(){ if(enabled) setup(); }, 50);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', init); else init();
})();</script>`;

  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `${script}\n</body>`);
  }
  return `${html}\n${script}`;
}
