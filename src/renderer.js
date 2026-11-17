const $=id=>document.getElementById(id);
const labels={permission:'Excel permission needed',paused:'Privacy, by your side.',waiting:'Waiting for Excel',limited:'A closer look is needed.',clear:'Looking clear.',warn:'Sensitive data found.',risk:'Credentials need attention.'};
const pills={permission:'Permission needed',paused:'Paused',waiting:'Connecting',limited:'Review needed',clear:'No matches',warn:'Review needed',risk:'High risk'};
function setRunning(value){$('stop').disabled=!value;$('start-label').textContent=value?'Reconnect':'Start monitoring';}
function setTheme(theme){document.documentElement.dataset.theme=theme;$('theme').setAttribute('aria-label',theme==='dark'?'Switch to light mode':'Switch to dark mode');try{localStorage.setItem('guard-theme',theme);}catch{}}
try{setTheme(localStorage.getItem('guard-theme')==='dark'?'dark':'light');}catch{setTheme('light');}
$('theme').onclick=()=>setTheme(document.documentElement.dataset.theme==='dark'?'light':'dark');
function render(data){
 const status=Object.hasOwn(labels,data.status)?data.status:'limited';
 if(['paused','permission'].includes(status))setRunning(false);
 $('status').dataset.state=status;$('heading').textContent=labels[status];$('state-label').textContent=pills[status];
 $('message').textContent=data.reason||`${data.sheet} · ${data.scanned} populated cells inspected. ${data.count?'Review the findings below.':'No matches in the inspected values.'}`;
 const inspected=['clear','warn','risk'].includes(status);
 $('cell-count').textContent=inspected?String(data.scanned):'—';$('finding-count').textContent=inspected?String(data.count):'—';
 $('results-count').textContent=inspected?(data.items?.length?`${data.items.length} cells to review`:'Nothing to review'):'Awaiting scan';
 $('checked-time').textContent=inspected&&data.checkedAt?`Checked ${new Date(data.checkedAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}`:(status==='paused'?'Monitoring paused':'Awaiting inspection');
 $('findings').replaceChildren();$('empty-state').hidden=!!data.items?.length;
 $('empty-title').textContent=status==='clear'?'No sensitive values detected.':'A little clarity. A lot more privacy.';
 $('empty-message').textContent=status==='clear'?'This applies to inspected values only. Keep reviewing before sharing.':'Cell references and masked suggestions will appear here after a scan.';
 for(const item of data.items||[]){
  const card=document.createElement('article');card.className='glass finding';
  const top=document.createElement('div');top.className='finding-top';
  const ref=document.createElement('span');ref.className='cell-ref';ref.textContent=item.cell;
  const title=document.createElement('h3');title.textContent=item.categories.join(' · ').replaceAll('_',' ');top.append(ref,title);
  const label=document.createElement('label');label.textContent='SUGGESTED MASKED VALUE';
  const preview=document.createElement('textarea');preview.readOnly=true;preview.value=item.preview;preview.setAttribute('aria-label',`Masked preview for ${item.cell}`);
  const bottom=document.createElement('div');bottom.className='finding-bottom';
  const hint=document.createElement('small');hint.textContent='Review before updating Excel.';
  const copy=document.createElement('button');copy.className='copy-button';copy.textContent='Copy value';copy.setAttribute('aria-label',`Copy masked value for ${item.cell}`);
  copy.onclick=async()=>{try{await navigator.clipboard.writeText(preview.value);copy.textContent='Copied';}catch{preview.focus();preview.select();copy.textContent='Select & copy';}setTimeout(()=>{copy.textContent='Copy value';},1800);};
  bottom.append(hint,copy);card.append(top,label,preview,bottom);$('findings').append(card);
 }
 if((data.items||[]).length===50){const note=document.createElement('p');note.className='overflow-note';note.textContent='Showing the first 50 affected cells. Review the remaining cells separately.';$('findings').append(note);}
}
if(window.guard){
 $('start').onclick=async()=>{try{await window.guard.start();setRunning(true);}catch{setRunning(false);render({status:'waiting',reason:'Could not start monitoring. Try again.'});}};
 $('stop').onclick=async()=>{await window.guard.stop();setRunning(false);};
 $('close').onclick=()=>window.guard.close();window.guard.onUpdate(render);
}else{
 $('start').disabled=true;$('stop').disabled=true;$('close').disabled=true;
 $('message').textContent='Open the desktop app to connect to Microsoft Excel. This browser view is a design preview.';
}
