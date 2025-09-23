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
        state.set(key, { key: key, selector: selector, oldText: oldText, newText: newText, type: 'text-edit' });
        try { parent_post({ type:'inline-edits' }); } catch(e){}
      }
      
      function showToolbar(e){
        try{ e.preventDefault(); e.stopImmediatePropagation(); e.stopPropagation(); }catch(_){}
        if (!enabled) return;
        
        // Remove existing toolbar
        var existingToolbar = document.querySelector('.inline-edit-toolbar');
        if (existingToolbar) existingToolbar.remove();
        
        // Create toolbar
        var toolbar = document.createElement('div');
        toolbar.className = 'inline-edit-toolbar';
        toolbar.style.cssText = 'position: fixed; z-index: 10000; background: white; border: 1px solid #ccc; border-radius: 6px; padding: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); display: flex; gap: 4px;';
        
        // Position toolbar near the clicked element
        var rect = span.getBoundingClientRect();
        toolbar.style.left = rect.left + 'px';
        toolbar.style.top = (rect.bottom + 5) + 'px';
        
        // Create hyperlink button
        var linkBtn = document.createElement('button');
        linkBtn.innerHTML = '🔗';
        linkBtn.title = 'Adicionar Hyperlink';
        linkBtn.style.cssText = 'border: none; background: #f3f4f6; padding: 6px 8px; border-radius: 4px; cursor: pointer; font-size: 14px;';
        linkBtn.onmouseover = function(){ this.style.background = '#e5e7eb'; };
        linkBtn.onmouseout = function(){ this.style.background = '#f3f4f6'; };
        
        linkBtn.onclick = function(e){
          e.preventDefault();
          e.stopPropagation();
          
          // Get selected text or use span content
          var selection = window.getSelection();
          var selectedText = selection.toString().trim();
          if (!selectedText) selectedText = span.textContent.trim();
          
          // Show URL input modal
          var modal = document.createElement('div');
          modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 10001; display: flex; align-items: center; justify-content: center;';
          
          var modalContent = document.createElement('div');
          modalContent.style.cssText = 'background: white; padding: 20px; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.3); max-width: 500px; width: 90%; word-wrap: break-word; overflow-wrap: break-word;';
          
          var title = document.createElement('h3');
          title.textContent = 'Adicionar Hyperlink';
          title.style.cssText = 'margin: 0 0 15px 0; font-size: 16px; font-weight: 600;';
          
          var urlInput = document.createElement('input');
          urlInput.type = 'url';
          urlInput.placeholder = 'https://exemplo.com';
          urlInput.style.cssText = 'width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 4px; margin-bottom: 15px; font-size: 14px; box-sizing: border-box; word-break: break-all; overflow-wrap: break-word;';
          
          var buttonContainer = document.createElement('div');
          buttonContainer.style.cssText = 'display: flex; gap: 10px; justify-content: flex-end;';
          
          var cancelBtn = document.createElement('button');
          cancelBtn.textContent = 'Cancelar';
          cancelBtn.style.cssText = 'padding: 8px 16px; border: 1px solid #d1d5db; background: white; border-radius: 4px; cursor: pointer;';
          
          var applyBtn = document.createElement('button');
          applyBtn.textContent = 'Aplicar';
          applyBtn.style.cssText = 'padding: 8px 16px; border: none; background: #3b82f6; color: white; border-radius: 4px; cursor: pointer;';
          
          function closeModal(){
            document.body.removeChild(modal);
            toolbar.remove();
          }
          
          cancelBtn.onclick = closeModal;
          
          applyBtn.onclick = function(){
            var url = urlInput.value.trim();
            if (!url) return;
            
            // Ensure URL has protocol
            if (!url.match(/^https?:\\/\\//)) {
              url = 'https://' + url;
            }
            
            // Create hyperlink
            var link = document.createElement('a');
            link.href = url;
            link.textContent = selectedText;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            
            // Preserve original styling - don't override colors or decoration
            // Get computed styles from the original span
            var computedStyle = window.getComputedStyle(span);
            link.style.color = computedStyle.color || 'inherit';
            link.style.textDecoration = computedStyle.textDecoration || 'inherit';
            link.style.fontFamily = computedStyle.fontFamily || 'inherit';
            link.style.fontSize = computedStyle.fontSize || 'inherit';
            link.style.fontWeight = computedStyle.fontWeight || 'inherit';
            link.style.fontStyle = computedStyle.fontStyle || 'inherit';
            
            // Only add subtle underline to indicate it's a link, but preserve other styles
            if (computedStyle.textDecoration === 'none' || !computedStyle.textDecoration) {
              link.style.textDecoration = 'underline';
              link.style.textDecorationColor = 'currentColor';
              link.style.textDecorationThickness = '1px';
            }
            
            // Replace span content with link
            span.innerHTML = '';
            span.appendChild(link);
            
            // Update state with hyperlink
            var selector = getSelector(span);
            
            // Check if there's already a text edit for this element
            var existingEdit = state.get(key);
            var actualOldText = oldText;
            
            // If there was a previous text edit, preserve it by creating a separate hyperlink entry
            if (existingEdit && existingEdit.type === 'text-edit' && existingEdit.oldText !== existingEdit.newText) {
              // Create a new key for the hyperlink to preserve the text edit
              var hyperlinkKey = key + '_hyperlink';
              state.set(hyperlinkKey, { 
                key: hyperlinkKey, 
                selector: selector, 
                oldText: existingEdit.newText, // Use the edited text as old text for hyperlink
                newText: selectedText,
                type: 'hyperlink',
                url: url
              });
            } else {
              // No previous text edit, just add hyperlink normally
              state.set(key, { 
                key: key, 
                selector: selector, 
                oldText: actualOldText, 
                newText: selectedText,
                type: 'hyperlink',
                url: url
              });
            }
            
            try { parent_post({ type:'inline-edits' }); } catch(e){}
            closeModal();
          };
          
          // ESC key to close
          modal.onkeydown = function(e){
            if (e.key === 'Escape') closeModal();
          };
          
          modalContent.appendChild(title);
          modalContent.appendChild(urlInput);
          buttonContainer.appendChild(cancelBtn);
          buttonContainer.appendChild(applyBtn);
          modalContent.appendChild(buttonContainer);
          modal.appendChild(modalContent);
          document.body.appendChild(modal);
          
          urlInput.focus();
        };
        
        toolbar.appendChild(linkBtn);
        document.body.appendChild(toolbar);
        
        // Close toolbar when clicking outside
        setTimeout(function(){
          function closeOnClickOutside(e){
            if (!toolbar.contains(e.target) && e.target !== span) {
              toolbar.remove();
              document.removeEventListener('click', closeOnClickOutside);
            }
          }
          document.addEventListener('click', closeOnClickOutside);
        }, 100);
      }
      
      function stopClick(e){ try{ e.preventDefault(); e.stopImmediatePropagation(); e.stopPropagation(); }catch(_){} }
      span.addEventListener('input', onInput);
      span.addEventListener('click', showToolbar);
      span.addEventListener('dblclick', stopClick);

      teardownFns.push(function(){ try{ span.removeEventListener('input', onInput); span.removeEventListener('click', showToolbar); span.removeEventListener('dblclick', stopClick);}catch(e){}; try{ var t=document.createTextNode(span.textContent||''); parent.replaceChild(t, span); }catch(e){} });
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
  function parent_post(msg){ 
    console.log('DEBUG: Enviando mensagem para parent:', msg);
    console.log('DEBUG: Edições no state:', Array.from(state.values()));
    try { 
      parent.postMessage({ ...msg, edits: Array.from(state.values()) }, '*'); 
    } catch(e){
      console.log('DEBUG: Erro ao enviar mensagem:', e);
    } 
  }
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
