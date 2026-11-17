const $=id=>document.getElementById(id);
const labels={password:'Password',otp:'OTP',api_key:'API key',access_token:'Access token',private_key:'Private key',connection_string:'Connection string',secret:'Secret',credential:'Credential',email:'Email'};
window.guard.onHint(data=>{document.documentElement.dataset.theme=data.theme||'dark';$('hint-cell').textContent=data.cell;$('hint-category').textContent=data.categories.map(category=>labels[category]||category.replaceAll('_',' ')).join(' · ');$('hint-original').textContent=data.original;$('hint-original').title=data.original;$('hint-token').textContent=data.preview.replace(/^\[([^\]]+)\]$/,'$1');$('hint-preview').value=data.preview;});
$('dismiss-hint').onclick=()=>window.guard.dismissHint();
$('hint-copy').onclick=async()=>{try{await navigator.clipboard.writeText($('hint-preview').value);$('hint-copy').textContent='Copied';}catch{$('hint-preview').focus();$('hint-preview').select();$('hint-copy').textContent='Select & copy';}};
