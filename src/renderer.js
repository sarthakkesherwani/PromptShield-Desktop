const $=id=>document.getElementById(id);
const labels={permission:'Excel permission needed',paused:'Monitoring paused',waiting:'Waiting for Excel',limited:'Review needed',clear:'No risk detected',warn:'Sensitive data found',risk:'Credentials at risk'};
function render(data){
 $('status').dataset.state=data.status;
 $('heading').textContent=labels[data.status]||'Review needed';
 $('message').textContent=data.reason||`${data.sheet} · ${data.scanned} populated cells checked${data.count?' · '+data.count+' findings':''}`;
 $('findings').replaceChildren();
 for(const item of data.items||[]){
  const card=document.createElement('article');
  const title=document.createElement('h2');title.textContent=`${item.cell} · ${item.categories.join(', ').replaceAll('_',' ')}`;
  const label=document.createElement('label');label.textContent='Suggested masked value';
  const preview=document.createElement('textarea');preview.readOnly=true;preview.value=item.preview;preview.setAttribute('aria-label',`Masked preview for ${item.cell}`);
  const hint=document.createElement('small');hint.textContent='Select the preview to copy it. Review before pasting into Excel.';
  card.append(title,label,preview,hint);$('findings').append(card);
 }
 if((data.items||[]).length===50){const note=document.createElement('p');note.textContent='Showing the first 50 affected cells. Review the remaining cells separately.';$('findings').append(note);}
}
$('start').onclick=()=>window.guard.start();
$('stop').onclick=()=>window.guard.stop();
$('close').onclick=()=>window.guard.close();
window.guard.onUpdate(render);

