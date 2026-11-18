const $=id=>document.getElementById(id);
const launchRoot = document.documentElement;
function startEntrance() {
 if (document.hidden) return;
 document.removeEventListener('visibilitychange', startEntrance);
 if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
  delete launchRoot.dataset.launch;
 } else {
  launchRoot.dataset.launch = 'playing';
  window.setTimeout(() => delete launchRoot.dataset.launch, 850);
 }
}
document.addEventListener('visibilitychange', startEntrance);
startEntrance();

const categoryLabels={password:'Password',otp:'OTP',api_key:'API key',access_token:'Access token',private_key:'Private key',connection_string:'Connection string',secret:'Secret',credential:'Credential',email:'Email'};
const labels={permission:'Spreadsheet access needed',paused:'Review your sheet',waiting:'Waiting for Excel',limited:'A closer look is needed.',clear:'No sensitive values detected.',warn:'Sensitive data found.',risk:'Credentials need attention.'};
const sourceNames={excel:'Excel',numbers:'Numbers'};
try{const saved=localStorage.getItem('guard-source');$('source').value=(saved==='numbers'&&window.guard?.platform==='darwin')?'numbers':saved==='excel'?'excel':window.guard?.platform==='darwin'?'numbers':'excel';}catch{}
const sourceName=()=>sourceNames[$('source').value]||'Excel';
const pills={permission:'Permission needed',paused:'Paused',waiting:'Connecting',limited:'Review needed',clear:'No matches',warn:'Review needed',risk:'High risk'};
let monitoring = false;
let connectionBusy = false;
let bulkRequest = false;
let bulkBusy = false;
let bulkEligible = false;
let cellAction = false;
let cancellingBatch = false;

function syncControls() {
 const busy = connectionBusy || bulkBusy || bulkRequest || cellAction;
 $('start').disabled = busy;
 $('source').disabled = busy;
 $('stop').disabled = !monitoring || busy;
 $('bulk-review').disabled = !bulkEligible || busy;
 $('bulk-apply').disabled = busy;
 $('bulk-cancel').disabled = bulkBusy ? cancellingBatch : bulkRequest;
 $('bulk-undo').disabled = busy;
 for (const button of $('findings').querySelectorAll('.locate-button')) {
  button.disabled = busy || button.dataset.applied === 'true';
 }
}

function setRunning(value) {
 monitoring = value;
 $('start-label').textContent = value ? 'Reconnect' : 'Start monitoring';
}
document.documentElement.dataset.platform = window.guard?.platform || 'preview';
let renderedFindingsKey, activeRevision, bulkPlanId;
const findingCards = new Map();
const overflowNote = document.createElement('p');
overflowNote.className = 'overflow-note';

async function reviewFinding(button, item, apply) {
 if (button.disabled) return;
 cellAction = true;
 syncControls();
 if (apply) button.textContent = 'Applying…';
 try {
  const action = apply ? window.guard.applyCell : window.guard.reviewCell;
  const result = await action(item.id, activeRevision);
  $('notice-text').textContent = result.reason;
  $('inline-settings').hidden = result.status !== 'accessibility';
  if (apply) {
   button.dataset.applied = String(result.status === 'applied');
   button.textContent = result.status === 'applied' ? 'Applied ✓' : 'Try again';
  }
 } catch {
  $('notice-text').textContent = apply
   ? 'Could not confirm the mask. Review the cell and try again.'
   : 'Could not locate the cell. Start a fresh scan.';
  $('inline-settings').hidden = true;
  if (apply) button.textContent = 'Try again';
 } finally {
  $('notice').hidden = false;
  cellAction = false;
  syncControls();
 }
}
function render(data){
 activeRevision=data.revision;bulkEligible=data.source==='numbers'&&data.count>0;$('bulk-actions').hidden=data.source!=='numbers';
 if(typeof data.monitoring==='boolean')setRunning(data.monitoring);
 const status=Object.hasOwn(labels,data.status)?data.status:'limited';
 if(['paused','permission'].includes(status))setRunning(false);
 syncControls();
 $('status').dataset.state=status;$('heading').textContent=status==='waiting'?`Waiting for ${sourceName()}`:labels[status];$('state-label').textContent=pills[status];
 $('message').textContent=data.reason||`${data.sheet} · ${data.scanned} populated cells inspected. ${data.count?'Review the findings below.':'No matches in the inspected values.'}`;
 const inspected=['clear','warn','risk'].includes(status);
 document.querySelector('.metrics').hidden = !inspected;
 document.querySelector('.results-section').hidden = !inspected;
 $('cell-count').textContent=inspected?String(data.scanned):'—';$('finding-count').textContent=inspected?String(data.count):'—';
 $('results-count').textContent=inspected?(data.items?.length?`${data.affectedCells} affected ${data.affectedCells===1?'cell':'cells'}`:'Nothing to review'):'Awaiting scan';
 $('checked-time').textContent=inspected&&data.checkedAt?`Checked ${new Date(data.checkedAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}`:(status==='paused'?'Monitoring paused':'Awaiting inspection');
 const findingsKey=JSON.stringify([status,data.source,data.affectedCells,data.items||[]]);if(findingsKey===renderedFindingsKey)return;renderedFindingsKey=findingsKey;
 $('empty-state').hidden=!!data.items?.length;
 $('empty-title').textContent=status==='clear'?'No findings on this sheet.':'Your findings will appear here.';
 $('empty-message').textContent=status==='clear'?'This applies to inspected values only. Keep reviewing before sharing.':'Cell references and masked suggestions will appear here after a scan.';
 const findings = $('findings');
 const entries = (data.items || []).map(item => [JSON.stringify([data.source, item]), item]);
 const currentKeys = new Set(entries.map(([key]) => key));
 for (const [key, card] of findingCards) {
  if (!currentKeys.has(key)) {
   card.remove();
   findingCards.delete(key);
  }
 }
 for (const [index, [key, item]] of entries.entries()) {
  let card = findingCards.get(key);
  if (!card) {
   card = createFindingCard(item, data.source);
   findingCards.set(key, card);
  }
  const next = findings.children[index];
  if (card !== next) {
   if (card.parentElement === findings && findings.moveBefore) findings.moveBefore(card, next || null);
   else findings.insertBefore(card, next || null);
  }
 }
 if (entries.length < data.affectedCells) {
  overflowNote.textContent = `Showing ${entries.length} of ${data.affectedCells} affected cells.`
   + (data.source === 'numbers' ? ' Use Mask all to review every eligible cell.' : '');
  if (findings.lastElementChild !== overflowNote) findings.append(overflowNote);
 } else {
  overflowNote.remove();
 }
 syncControls();
}

function createFindingCard(item, source) {
  const card=document.createElement('article');card.className='glass finding';
  const top=document.createElement('div');top.className='finding-top';
  const ref=document.createElement('span');ref.className='cell-ref';ref.textContent=item.cell;
  const title=document.createElement('h3');title.textContent=item.categories.map(category=>categoryLabels[category]||category.replaceAll('_',' ')).join(' · ');top.append(ref,title);
  const label=document.createElement('label');label.textContent='SUGGESTED MASKED VALUE';
  const preview=document.createElement('textarea');preview.readOnly=true;preview.value=item.preview;preview.setAttribute('aria-label',`Masked preview for ${item.cell}`);
  const bottom=document.createElement('div');bottom.className='finding-bottom';
  const hint=document.createElement('small');hint.textContent=item.truncated?'Preview shortened. Review the full cell in '+sourceName()+'.':'Review before pasting.';
  const copy=document.createElement('button');copy.className='copy-button';copy.textContent='Copy value';copy.disabled=!!item.truncated;copy.setAttribute('aria-label',`Copy masked value for ${item.cell}`);
  copy.onclick=async()=>{try{await navigator.clipboard.writeText(preview.value);copy.textContent='Copied';}catch{preview.focus();preview.select();copy.textContent='Select & copy';}setTimeout(()=>{copy.textContent='Copy value';},1800);};
  bottom.append(hint);
  if (source === 'numbers' && window.guard?.reviewCell) {
   const locate = document.createElement('button');
   locate.className = 'locate-button';
   locate.textContent = 'Show cell';
   locate.setAttribute('aria-label', `Show ${item.cell} in Numbers`);
   locate.onclick = () => reviewFinding(locate, item, false);
   bottom.append(locate);
  }
  if (source === 'numbers' && item.canApply && window.guard?.applyCell) {
   const apply = document.createElement('button');
   apply.className = 'locate-button apply-button glass-button';
   apply.textContent = 'Apply mask';
   apply.setAttribute('aria-label', `Apply mask to ${item.cell}`);
   hint.hidden = true;
   apply.onclick = () => reviewFinding(apply, item, true);
   bottom.append(apply);
  }
  bottom.append(copy);
  card.append(top,label,preview,bottom);
  return card;
}

function showBulkState(data){
 bulkBusy = data.phase === 'running';
 if (!bulkBusy) cancellingBatch = false;
 const progress = $('bulk-meter');
 progress.hidden = !bulkBusy;
 if (bulkBusy) {
  progress.max = Math.max(1, data.total);
  progress.value = data.processed;
 }
 syncControls();
 if(data.phase==='idle'){bulkPlanId=null;$('bulk-panel').hidden=true;$('bulk-undo').hidden=true;return;}
 $('bulk-actions').hidden=false;$('bulk-panel').hidden=false;
 if (!bulkBusy) bulkPlanId = null;
 if(bulkBusy){$('bulk-title').textContent=data.action==='undo'?'Restoring cells…':'Masking this sheet…';$('bulk-apply').hidden=true;$('bulk-cancel').hidden=false;if(!$('bulk-cancel').disabled)$('bulk-cancel').textContent='Cancel remaining';$('bulk-progress').textContent=`${data.processed} of ${data.total} cells checked · ${data.applied} applied · ${data.skipped} skipped`;}
 else{$('bulk-title').textContent=data.status==='partial'?'Batch interrupted':data.status==='done'?'Batch complete':'Batch unavailable';$('bulk-summary').textContent=data.reason||'';$('bulk-samples').replaceChildren();$('bulk-progress').textContent='';$('bulk-apply').hidden=true;$('bulk-cancel').hidden=true;$('bulk-undo').hidden=!data.canUndo;}
}
$('bulk-review').onclick=async()=>{
 if ($('bulk-review').disabled) return;
 bulkRequest = true;
 syncControls();
 try{const plan=await window.guard.prepareBulk();if(plan.status!=='ready'){showBulkState({phase:'done',reason:plan.reason});return;}
  bulkPlanId=plan.id;$('bulk-panel').hidden=false;$('bulk-title').textContent=`Mask ${plan.cells} cells on ${plan.sheet}?`;
  const categories=Object.entries(plan.categories).map(([key,count])=>`${categoryLabels[key]||key}: ${count}`).join(' · ');
  $('bulk-summary').textContent=`${categories}. ${plan.ineligible} incomplete suggestions excluded. Values on this sheet will be replaced. You can undo the last batch in this session.`;
  $('bulk-samples').replaceChildren();for(const sample of plan.samples){const row=document.createElement('p');row.textContent=sample.cell+' → '+sample.replacement;$('bulk-samples').append(row);}
  $('bulk-progress').textContent='Changed cells and formulas will be skipped.';$('bulk-apply').hidden=plan.cells===0;$('bulk-apply').textContent=`Apply ${plan.cells} masks`;$('bulk-cancel').hidden=false;$('bulk-cancel').textContent='Keep reviewing';
 }catch{showBulkState({phase:'done',reason:'Could not prepare the sheet. Run a fresh scan.'});}finally{bulkRequest=false;syncControls();}
};
async function finishBatch(button, action, failureMessage) {
 if (button.disabled) return;
 bulkRequest = true;
 syncControls();
 try {
  const result = await action();
  if (!['done','partial'].includes(result.status)) {
   showBulkState({phase:'done', reason:result.reason, canUndo:result.canUndo});
  }
 } catch {
  showBulkState({phase:'done', reason:failureMessage, canUndo:!$('bulk-undo').hidden});
 } finally {
  bulkRequest = false;
  syncControls();
 }
}

$('bulk-apply').onclick = () => {
 if (!bulkPlanId) return;
 return finishBatch($('bulk-apply'), () => window.guard.applyBulk(bulkPlanId), 'Could not confirm the batch. Scan the sheet again.');
};
$('bulk-undo').onclick = () => finishBatch($('bulk-undo'), () => window.guard.undoBulk(), 'Could not confirm undo. Check the sheet before retrying.');
$('bulk-cancel').onclick = async () => {
 const cancel = $('bulk-cancel');
 const running = bulkBusy;
 if (running) cancellingBatch = true;
 else bulkRequest = true;
 syncControls();
 if (running) cancel.textContent = 'Finishing current group…';
 try {
  await window.guard.cancelBulk();
  if (!running) {
   $('bulk-panel').hidden = true;
   bulkPlanId = null;
  }
 } catch {
  $('bulk-progress').textContent = 'Could not cancel. Try again.';
  if (running && bulkBusy) cancel.textContent = 'Cancel remaining';
  cancellingBatch = false;
 } finally {
  if (!running) bulkRequest = false;
  syncControls();
 }
};
if(window.guard){
 window.guard.onBulkUpdate?.(showBulkState);
 $('inline-controls').hidden=$('source').value!=='numbers';
 if(window.guard.onInlineStatus)window.guard.onInlineStatus(result=>{$('notice').hidden=false;$('notice-text').textContent=result.reason;$('inline-settings').hidden=result.status!=='accessibility';});
 $('inline-enabled').onchange=()=>window.guard.setInlineHints?.($('inline-enabled').checked);
 if(window.guard.platform!=='darwin')$('source').querySelector('[value="numbers"]').disabled=true;
 async function changeConnection(action, error) {
  connectionBusy = true;
  $('notice').hidden = true;
  syncControls();
  try {
   const result = await action();
   if (result?.status === 'busy') {
    $('notice-text').textContent = result.reason;
    $('inline-settings').hidden = true;
    $('notice').hidden = false;
   }
  } catch {
   render({status:'waiting', reason:error});
  } finally {
   connectionBusy = false;
   syncControls();
  }
 }
 $('source').onchange = () => {
  try { localStorage.setItem('guard-source', $('source').value); } catch {}
  $('inline-controls').hidden = $('source').value !== 'numbers';
  return changeConnection(async () => {
   const result = await window.guard.stop();
   if (result?.status === 'busy') return result;
   render({status:'paused',reason:`Open ${sourceName()}, then start monitoring.`});
  }, 'Could not change the connection. Try again.');
 };
 $('start').onclick = () => changeConnection(() => window.guard.start($('source').value), 'Could not start monitoring. Try again.');
 $('stop').onclick = () => changeConnection(() => window.guard.stop(), 'Could not pause monitoring. Try again.');
 $('inline-settings').onclick=()=>window.guard.openInlineSettings();
 $('close').onclick=()=>window.guard.close();window.guard.onUpdate(render);
}else{
 $('start').disabled=true;$('stop').disabled=true;$('close').disabled=true;
 $('message').textContent='Open the desktop app to connect to Excel or Apple Numbers. This browser view is a design preview.';
}


const sampleDialog = $('sample-dialog');
let sampleMasked = false;
let sampleRequest = 0;
async function renderSample(masked) {
 const toggle = $('sample-toggle');
 const request = ++sampleRequest;
 toggle.disabled = true;
 try {
  const sample = await window.guard.reviewSample(masked);
  if (request !== sampleRequest || !sampleDialog.open) return;
  const rows = [];
  for (let i = 2; i < sample.cells.length; i += 2) {
   const row = document.createElement('tr');
   row.insertCell().textContent = sample.cells[i];
   row.insertCell().textContent = sample.cells[i + 1];
   rows.push(row);
  }
  $('sample-rows').replaceChildren(...rows);
  $('sample-result').textContent = masked
   ? `Rescan: ${sample.count} findings in ${sample.scanned} cells. Both orders retain the same contact label.`
   : `Scan: ${sample.count} findings in ${sample.scanned} cells. The same email appears in two orders.`;
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
   for (const cell of $('sample-rows').querySelectorAll('td:first-child')) {
    cell.animate([{opacity:0.55, transform:'translateY(3px)'}, {opacity:1, transform:'translateY(0)'}], {duration:200, easing:'ease-out'});
   }
  }
  sampleMasked = masked;
  toggle.textContent = masked ? 'Restore sample' : 'Mask sample';
 } catch {
  if (request !== sampleRequest || !sampleDialog.open) return;
  $('sample-result').textContent = 'Could not scan the sample. Close and try again.';
 } finally {
  if (request === sampleRequest) toggle.disabled = false;
 }
}
$('sample-open').hidden = !window.guard?.reviewSample;
$('sample-open').onclick = () => {
 $('sample-rows').replaceChildren();
 $('sample-result').textContent = 'Scanning sample…';
 $('sample-toggle').textContent = 'Mask sample';
 sampleMasked = false;
 sampleDialog.showModal();
 renderSample(false);
};
$('sample-toggle').onclick = () => renderSample(!sampleMasked);
