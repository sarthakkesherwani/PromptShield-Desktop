const $=id=>document.getElementById(id);
const categoryLabels={password:'Password',otp:'OTP',api_key:'API key',access_token:'Access token',private_key:'Private key',connection_string:'Connection string',secret:'Secret',credential:'Credential',email:'Email'};
const labels={permission:'Spreadsheet access needed',paused:'Ready to watch your sheet.',waiting:'Waiting for Excel',limited:'A closer look is needed.',clear:'No sensitive values detected.',warn:'Sensitive data found.',risk:'Credentials need attention.'};
const sourceNames={excel:'Excel',numbers:'Numbers'};
const sourceName=()=>sourceNames[$('source').value]||'Excel';
const pills={permission:'Permission needed',paused:'Paused',waiting:'Connecting',limited:'Review needed',clear:'No matches',warn:'Review needed',risk:'High risk'};
function setRunning(value){$('stop').disabled=!value;$('start-label').textContent=value?'Reconnect':'Start monitoring';}
function setTheme(theme){document.documentElement.dataset.theme=theme;if(window.guard?.setTheme)window.guard.setTheme(theme).catch(()=>{});$('theme').setAttribute('aria-label',theme==='dark'?'Switch to light mode':'Switch to dark mode');try{localStorage.setItem('guard-theme',theme);}catch{}}
const systemTheme=()=>window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';
try{const saved=localStorage.getItem('guard-theme');setTheme(saved==='dark'||saved==='light'?saved:systemTheme());}catch{setTheme(systemTheme());}
$('theme').onclick=()=>setTheme(document.documentElement.dataset.theme==='dark'?'light':'dark');
function render(data){
 if(data.refreshing){$('checked-time').textContent='Refreshing…';return;}
 if(typeof data.monitoring==='boolean')setRunning(data.monitoring);
 const status=Object.hasOwn(labels,data.status)?data.status:'limited';
 if(['paused','permission'].includes(status))setRunning(false);
 $('status').dataset.state=status;$('heading').textContent=status==='waiting'?`Waiting for ${sourceName()}`:labels[status];$('state-label').textContent=pills[status];
 $('message').textContent=data.reason||`${data.sheet} · ${data.scanned} populated cells inspected. ${data.count?'Review the findings below.':'No matches in the inspected values.'}`;
 const inspected=['clear','warn','risk'].includes(status);
 $('cell-count').textContent=inspected?String(data.scanned):'—';$('finding-count').textContent=inspected?String(data.count):'—';
 $('results-count').textContent=inspected?(data.items?.length?`${data.items.length} cells to review`:'Nothing to review'):'Awaiting scan';
 $('checked-time').textContent=inspected&&data.checkedAt?`Checked ${new Date(data.checkedAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}`:(status==='paused'?'Monitoring paused':'Awaiting inspection');
 $('findings').replaceChildren();$('empty-state').hidden=!!data.items?.length;
 $('empty-title').textContent=status==='clear'?'No findings on this sheet.':'Your findings will appear here.';
 $('empty-message').textContent=status==='clear'?'This applies to inspected values only. Keep reviewing before sharing.':'Cell references and masked suggestions will appear here after a scan.';
 for(const item of data.items||[]){
  const card=document.createElement('article');card.className='glass finding';
  const top=document.createElement('div');top.className='finding-top';
  const ref=document.createElement('span');ref.className='cell-ref';ref.textContent=item.cell;
  const title=document.createElement('h3');title.textContent=item.categories.map(category=>categoryLabels[category]||category.replaceAll('_',' ')).join(' · ');top.append(ref,title);
  const label=document.createElement('label');label.textContent='SUGGESTED MASKED VALUE';
  const preview=document.createElement('textarea');preview.readOnly=true;preview.value=item.preview;preview.setAttribute('aria-label',`Masked preview for ${item.cell}`);
  const bottom=document.createElement('div');bottom.className='finding-bottom';
  const hint=document.createElement('small');hint.textContent='Review before pasting.';
  const copy=document.createElement('button');copy.className='copy-button';copy.textContent='Copy value';copy.setAttribute('aria-label',`Copy masked value for ${item.cell}`);
  copy.onclick=async()=>{try{await navigator.clipboard.writeText(preview.value);copy.textContent='Copied';}catch{preview.focus();preview.select();copy.textContent='Select & copy';}setTimeout(()=>{copy.textContent='Copy value';},1800);};
  bottom.append(hint);
  if(data.source==='numbers'&&window.guard?.reviewCell){const locate=document.createElement('button');locate.className='locate-button';locate.textContent='Show cell';locate.setAttribute('aria-label',`Show ${item.cell} in Numbers`);locate.onclick=async()=>{locate.disabled=true;try{const result=await window.guard.reviewCell(item.id,data.revision);$('notice').hidden=false;$('notice-text').textContent=result.reason;$('inline-settings').hidden=result.status!=='accessibility';}catch{$('notice').hidden=false;$('notice-text').textContent='Could not locate the cell. Start a fresh scan.';}finally{locate.disabled=false;}};bottom.append(locate);}
  bottom.append(copy);card.append(top,label,preview,bottom);$('findings').append(card);
 }
 if((data.items||[]).length===50){const note=document.createElement('p');note.className='overflow-note';note.textContent='Showing the first 50 affected cells. Review the remaining cells separately.';$('findings').append(note);}
}
if(window.guard){
 $('inline-controls').hidden=$('source').value!=='numbers';
 if(window.guard.onInlineStatus)window.guard.onInlineStatus(result=>{$('notice').hidden=false;$('notice-text').textContent=result.reason;$('inline-settings').hidden=result.status!=='accessibility';});
 $('inline-enabled').onchange=()=>window.guard.setInlineHints?.($('inline-enabled').checked);
 if(window.guard.platform!=='darwin')$('source').querySelector('[value="numbers"]').disabled=true;
 $('source').onchange=async()=>{$('inline-controls').hidden=$('source').value!=='numbers';$('notice').hidden=true;setRunning(false);$('source-label').textContent=sourceName().toUpperCase()+' GUARD';try{await window.guard.stop();render({status:'paused',reason:`Open ${sourceName()}, then start monitoring.`});}catch{render({status:'waiting',reason:'Could not change the connection. Restart the app.'});}};
 $('start').onclick=async()=>{$('notice').hidden=true;$('source').disabled=true;try{await window.guard.start($('source').value);setRunning(true);}catch{setRunning(false);render({status:'waiting',reason:'Could not start monitoring. Try again.'});}finally{$('source').disabled=false;}};
 $('stop').onclick=async()=>{await window.guard.stop();setRunning(false);};
 $('inline-settings').onclick=()=>window.guard.openInlineSettings();
 $('close').onclick=()=>window.guard.close();window.guard.onUpdate(render);
}else{
 $('start').disabled=true;$('stop').disabled=true;$('close').disabled=true;
 $('message').textContent='Open the desktop app to connect to Excel or Apple Numbers. This browser view is a design preview.';
}

