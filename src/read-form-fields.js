// Runs only when the user requests a review of the active browser tab.
(() => {
  const clean = text => String(text || '').replace(/\s+/g, ' ').trim().slice(0, 120);
  const origin = location.origin;
  if (!['http:', 'https:'].includes(location.protocol)) throw new Error('Open a website first.');
  const fields = [];
  let truncated = false;
  for (const field of document.querySelectorAll('input, select, textarea')) {
    if (field.matches('[type=hidden],[type=submit],[type=reset],[type=button],[type=image]') ||
        !field.getClientRects().length || getComputedStyle(field).visibility === 'hidden') continue;
    if (fields.length === 100) { truncated = true; break; }
    // Skip editable descendants and form values, including textarea default text.
    function labelText(node) {
      if (!node || node.matches('input,select,textarea,[contenteditable]')) return '';
      const copy = node.cloneNode(true);
      copy.querySelectorAll('input,select,textarea,button,script,style,[contenteditable]').forEach(n => n.remove());
      return clean(copy.textContent);
    }
    const ref = (field.getAttribute('aria-labelledby') || '').split(/\s+/).filter(Boolean)
      .map(id => labelText(document.getElementById(id))).join(' ');
    const label = clean(field.getAttribute('aria-label') || ref || Array.from(field.labels || []).map(labelText).join(' ') || field.placeholder || field.name || field.id || 'Unlabelled field');
    let destination;
    try { destination = field.form ? new URL(field.form.action || location.href, document.baseURI).origin : origin; }
    catch { destination = 'unknown'; }
    fields.push({label, name:clean(field.name), type:clean(field.type), autocomplete:clean(field.autocomplete), destination});
  }
  return JSON.stringify({origin, fields, truncated, embedded:!!document.querySelector('iframe')});
})()
