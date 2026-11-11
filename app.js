// --- typed intro ---
(function(){
  const phrases = ["man software-engineering", "whoami", "cat /var/log/the_craft", "./remember.sh --years 1996-2026"];
  const el = document.getElementById('typed');
  let p=0,i=0,del=false;
  function tick(){
    const cur=phrases[p];
    el.textContent = cur.slice(0,i);
    if(!del){ i++; if(i>cur.length){ del=true; setTimeout(tick,1400); return; } }
    else { i--; if(i===0){ del=false; p=(p+1)%phrases.length; } }
    setTimeout(tick, del?38:85);
  }
  tick();
})();

// --- timeline ---
const CATS = ["language","editor","vcs","web","infra","build","database","ai"];
const CAT_LABEL = {language:"lang",editor:"editor",vcs:"version ctrl",web:"web",infra:"infra",build:"build/ci",database:"data",ai:"ai"};
const data = (window.TIMELINE||[]).slice().sort((a,b)=>a.year-b.year);
let activeCats = new Set();
let query = "";

document.getElementById('toolcount').textContent = data.length + " tools archived";

// build filter chips
const filtersEl = document.getElementById('filters');
CATS.forEach(c=>{
  const chip=document.createElement('button');
  chip.className='chip'; chip.dataset.cat=c; chip.textContent=CAT_LABEL[c];
  chip.onclick=()=>{ activeCats.has(c)?activeCats.delete(c):activeCats.add(c); chip.classList.toggle('active'); render(); };
  filtersEl.appendChild(chip);
});

const listEl=document.getElementById('timelineList');
const metaEl=document.getElementById('resultMeta');
const emptyEl=document.getElementById('emptyState');
const searchEl=document.getElementById('search');

function esc(s){return s.replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
function hl(text,q){
  if(!q) return esc(text);
  const safe=esc(text); const terms=q.trim().split(/\s+/).filter(Boolean).map(t=>t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'));
  if(!terms.length) return safe;
  return safe.replace(new RegExp('('+terms.join('|')+')','ig'),'<mark>$1</mark>');
}

function match(item){
  if(activeCats.size && !activeCats.has(item.cat)) return false;
  if(!query) return true;
  const hay=(item.name+' '+item.note+' '+item.cat+' '+CAT_LABEL[item.cat]+' '+item.epitaph+' '+item.year).toLowerCase();
  return query.toLowerCase().split(/\s+/).filter(Boolean).every(t=>hay.includes(t));
}

function render(){
  const rows=data.filter(match);
  listEl.innerHTML='';
  if(!rows.length){ emptyEl.hidden=false; metaEl.textContent='0 results'; return; }
  emptyEl.hidden=true;
  const span = rows.length? `${rows[0].year}–${rows[rows.length-1].year}` : '';
  metaEl.textContent = `${rows.length} of ${data.length} tools · ${span}` + (activeCats.size?` · ${[...activeCats].map(c=>CAT_LABEL[c]).join(', ')}`:'') + (query?` · "${query}"`:'');
  const frag=document.createDocumentFragment();
  rows.forEach(item=>{
    const div=document.createElement('div');
    div.className='entry';
    div.innerHTML=`<div class="yr">${item.year}</div>
      <div class="body" style="--catcolor:var(--${item.cat})">
        <div class="name">${hl(item.name,query)} <span class="cat-tag" style="background:var(--${item.cat})">${CAT_LABEL[item.cat]}</span></div>
        <div class="note">${hl(item.note,query)}</div>
        <div class="epitaph">${hl(item.epitaph,query)}</div>
      </div>`;
    frag.appendChild(div);
  });
  listEl.appendChild(frag);
}

let t; searchEl.addEventListener('input',e=>{ clearTimeout(t); t=setTimeout(()=>{query=e.target.value;render();},90); });
document.getElementById('clearBtn').onclick=()=>{ query='';searchEl.value='';activeCats.clear();document.querySelectorAll('.chip').forEach(c=>c.classList.remove('active'));render(); };
render();
