// The Sidewalk — live "does it compile?" chalkboard.
// We hand the source to the JS engine's own parser via the Function
// constructor. That PARSES (compiles) the body but does NOT run it —
// so `while(true){}` or `deleteEverything()` can't hurt anyone. We only
// ever learn: did the engine accept the syntax, or throw a SyntaxError?
(function () {
  const input = document.getElementById('chalkInput');
  const verdict = document.getElementById('chalkVerdict');
  const runBtn = document.getElementById('chalkRun');
  const outBox = document.getElementById('chalkOutput');
  const outBody = document.getElementById('chalkOutBody');
  const outClear = document.getElementById('chalkOutClear');
  if (!input || !verdict) return;

  const SAMPLES = {
    good:
`// clean and compiles
function greet(name) {
  return "hey, " + name;
}
const who = greet("world");`,
    oops:
`// a brace wandered off
function tally(items) {
  let n = 0;
  for (const i of items) {
    n += i;
  // where did the } go?
  return n;
}`,
    typo:
`// one keyword misspelled
cosnt total = 10;
let doubled = total * 2;`
  };

  function compiles(src) {
    try {
      // Parses the source as a function body without executing it.
      new Function(src);
      return { ok: true };
    } catch (err) {
      return { ok: false, err };
    }
  }

  function prettyError(err) {
    let msg = (err && err.message) ? err.message : String(err);
    // Normalize the engine's noise into something human.
    msg = msg.replace(/^Function\(\):\s*/i, '').trim();
    return msg;
  }

  let t;
  function evaluate() {
    const src = input.value;
    if (!src.trim()) {
      verdict.className = 'slab-verdict idle';
      verdict.innerHTML = '<span class="v-mark">—</span> blank slate. the cursor is waiting.';
      return;
    }
    const res = compiles(src);
    if (res.ok) {
      verdict.className = 'slab-verdict ok';
      verdict.innerHTML = '<span class="v-mark">✓</span> it compiles. the lines are straight.';
    } else {
      verdict.className = 'slab-verdict bad';
      verdict.innerHTML =
        '<span class="v-mark">✗</span> doesn\'t compile yet &mdash; ' +
        '<span class="v-msg">' + esc(prettyError(res.err)) + '</span>';
    }
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  // Pretty-printer for runtime values (also stringified into the worker).
  function fmt(v, seen) {
    seen = seen || new Set();
    if (v === null) return 'null';
    if (v === undefined) return 'undefined';
    var t = typeof v;
    if (t === 'string') return v;
    if (t === 'number' || t === 'boolean' || t === 'bigint') return String(v);
    if (t === 'function') return '[Function: ' + (v.name || 'anonymous') + ']';
    if (t === 'symbol') return v.toString();
    if (t === 'object') {
      if (seen.has(v)) return '[Circular]';
      seen.add(v);
      try {
        if (Array.isArray(v)) return '[ ' + v.map(function (x) { return fmtInline(x, seen); }).join(', ') + ' ]';
        if (v instanceof Error) return v.name + ': ' + v.message;
        var keys = Object.keys(v);
        return '{ ' + keys.map(function (k) { return k + ': ' + fmtInline(v[k], seen); }).join(', ') + ' }';
      } catch (e) { return String(v); }
    }
    return String(v);
  }
  function fmtInline(v, seen) {
    if (typeof v === 'string') return '"' + v + '"';
    return fmt(v, seen);
  }

  input.addEventListener('input', () => { clearTimeout(t); t = setTimeout(evaluate, 160); });

  // Tab inserts two spaces instead of leaving the slab.
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const s = input.selectionStart, en = input.selectionEnd;
      input.value = input.value.slice(0, s) + '  ' + input.value.slice(en);
      input.selectionStart = input.selectionEnd = s + 2;
      evaluate();
    }
  });

  document.querySelectorAll('.chalk-sample').forEach(btn => {
    btn.addEventListener('click', () => {
      input.value = SAMPLES[btn.dataset.k] || '';
      input.focus();
      evaluate();
    });
  });

  // --- execution ---
  // We run the snippet inside a Web Worker spun from a blob URL. A worker
  // has no DOM and no access to this page, its own global scope, and —
  // crucially — worker.terminate() can genuinely kill an infinite loop,
  // which a setTimeout watchdog on an iframe cannot. console.* is captured
  // and streamed back over postMessage. It's a toy slab, but an honest one:
  // your code actually runs.
  function run() {
    const src = input.value;
    const chk = compiles(src);
    if (!chk.ok) {
      evaluate();
      showOutput([{ kind: 'error', text: "won't run — it doesn't compile: " + prettyError(chk.err) }]);
      return;
    }

    const lines = [];
    const workerSrc =
      'var fmt=' + fmt.toString() + ';\n' +
      'var fmtInline=' + fmtInline.toString() + ';\n' +
      'function send(kind){return function(){' +
        'var a=[].slice.call(arguments).map(function(x){return fmt(x)});' +
        'self.postMessage({kind:kind,text:a.join(" ")})}}\n' +
      'self.console={log:send("log"),info:send("log"),warn:send("warn"),error:send("error"),debug:send("log")};\n' +
      'try{\n' +
      'var __ret=(0,eval)(' + JSON.stringify(src) + ');\n' +
      'if(__ret!==undefined)self.postMessage({kind:"return",text:"\\u21d2 "+fmt(__ret)});\n' +
      'self.postMessage({kind:"__done"});\n' +
      '}catch(e){self.postMessage({kind:"error",text:(e.name||"Error")+": "+(e.message||String(e))});self.postMessage({kind:"__done"});}';

    let worker, url, done = false, watchdog;
    function finish(extra) {
      if (done) return;
      done = true;
      clearTimeout(watchdog);
      try { worker.terminate(); } catch (e) {}
      try { URL.revokeObjectURL(url); } catch (e) {}
      if (extra) lines.push(extra);
      showOutput(lines);
    }

    try {
      url = URL.createObjectURL(new Blob([workerSrc], { type: 'application/javascript' }));
      worker = new Worker(url);
    } catch (e) {
      showOutput([{ kind: 'error', text: 'could not start the sandbox: ' + (e.message || e) }]);
      return;
    }

    watchdog = setTimeout(() => {
      finish({ kind: 'error', text: 'timed out (>2s) — probably an infinite loop. the sidewalk only has so much room.' });
    }, 2000);

    worker.onmessage = (ev) => {
      const m = ev.data || {};
      if (m.kind === '__done') { finish(); return; }
      lines.push({ kind: m.kind, text: m.text });
    };
    worker.onerror = (ev) => {
      finish({ kind: 'error', text: (ev.message || 'runtime error').replace(/^Uncaught\s*/, '') });
    };
  }

  function showOutput(lines) {
    outBox.hidden = false;
    if (!lines.length) {
      outBody.innerHTML = '<span class="out-dim">(ran clean — no output. silence is a kind of success.)</span>';
      return;
    }
    outBody.innerHTML = lines.map(l =>
      '<span class="out-line out-' + l.kind + '">' + esc(l.text) + '</span>'
    ).join('\n');
  }

  if (runBtn) runBtn.addEventListener('click', run);
  if (outClear) outClear.addEventListener('click', () => { outBox.hidden = true; outBody.textContent = ''; });
  // Cmd/Ctrl+Enter runs, like every good REPL.
  input.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); run(); }
  });

  evaluate();
})();
