const $=id=>document.getElementById(id);
const labels={password:'Password',otp:'OTP',api_key:'API key',access_token:'Access token',private_key:'Private key',connection_string:'Connection string',secret:'Secret',credential:'Credential',email:'Email'};
window.guard.onHint(data=>{document.documentElement.dataset.theme=data.theme||'dark';document.body.dataset.side=data.side||'right';$('hint-cell').textContent=data.cell+(data.anchored?'':' · Panel suggestion');$('hint-category').textContent=data.categories.map(category=>labels[category]||category.replaceAll('_',' ')).join(' · ');$('hint-original').textContent='Sensitive value';$('hint-token').textContent=data.preview.replace(/^\[([^\]]+)\]$/,'$1');$('hint-preview').value=data.preview;$('hint-action').textContent=data.categories.includes('email')?'Replace this email with a private label before sharing.':'Mask this sensitive value before sharing.';$('hint-apply').disabled=!data.canApply;$('hint-copy').disabled=!!data.truncated;
 if(data.truncated)$('hint-action').textContent='Preview shortened. Review the full cell in Numbers.';
 if(data.applied)showApplied({reason:'Mask applied to this cell. Monitoring continues.'});});
$('dismiss-hint').onclick=()=>window.guard.dismissHint();
$('hint-copy').onclick=async()=>{try{await navigator.clipboard.writeText($('hint-preview').value);$('hint-copy').textContent='Copied ✓';}catch{$('hint-preview').focus();$('hint-preview').select();$('hint-copy').textContent='Select & copy';}};

document.addEventListener('keydown',event=>{if(event.key==='Escape')window.guard.dismissHint();if(event.key==='Enter'&&!event.repeat&&!event.target.closest('button,textarea')&&!$('hint-apply').disabled){event.preventDefault();$('hint-apply').click();}if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='c'&&!window.getSelection()?.toString()){event.preventDefault();$('hint-copy').click();}});

$('hint-apply').onclick=async()=>{
 $('hint-apply').disabled=true;$('hint-apply').textContent='Applying…';
 try{const result=await window.guard.applyHint();$('hint-action').textContent=result.reason;
  if(result.status==='applied'){$('hint-original').textContent='Masked';$('hint-original').title='';$('hint-apply').textContent='Applied ✓';document.body.dataset.applied='true';}
  else{$('hint-apply').textContent='Scan again';}
 }catch{$('hint-action').textContent='Could not confirm the change. Scan this cell again.';$('hint-apply').textContent='Scan again';}
};

window.guard.onHintTheme(theme=>{if(theme==='dark'||theme==='light')document.documentElement.dataset.theme=theme;});

function showApplied(result){$('hint-action').textContent=result.reason;$('hint-original').textContent='Masked';$('hint-original').title='';$('hint-apply').disabled=true;$('hint-apply').textContent='Applied ✓';document.body.dataset.applied='true';}
window.guard.onMaskApplied(showApplied);
