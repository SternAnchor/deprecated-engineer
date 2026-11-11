// The Sidewalk — live "does it compile?" chalkboard.
// We hand the source to the JS engine's own parser via the Function
// constructor. That PARSES (compiles) the body but does NOT run it —
// so `while(true){}` or `deleteEverything()` can't hurt anyone. We only
// ever learn: did the engine accept the syntax, or throw a SyntaxError?
(function () {
  const input = document.getElementById('chalkInput');
  const verdict = document.getElementById('chalkVerdict');
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

  evaluate();
})();
