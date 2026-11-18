// Share one pointer listener across the dashboard and dynamically created findings.
(() => {
 const enabled = matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)');
 let current;
 let frame = 0;
 let x = 0;
 let y = 0;

 function reset() {
  cancelAnimationFrame(frame);
  frame = 0;
  current?.style.removeProperty('--glass-x');
  current?.style.removeProperty('--glass-y');
  current = undefined;
 }

 function paint() {
  frame = 0;
  if (!current?.isConnected || current.disabled) return reset();
  const rect = current.getBoundingClientRect();
  current.style.setProperty('--glass-x', (x - rect.left) + 'px');
  current.style.setProperty('--glass-y', (y - rect.top) + 'px');
 }

 document.addEventListener('pointermove', event => {
  const button = enabled.matches && event.target.closest('button.glass-button:enabled');
  if (current && button !== current) reset();
  if (!button) return;
  current = button;
  x = event.clientX;
  y = event.clientY;
  if (!frame) frame = requestAnimationFrame(paint);
 }, {passive:true});
 document.addEventListener('pointerout', event => {
  if (current && !current.contains(event.relatedTarget)) reset();
 });
 window.addEventListener('blur', reset);
 enabled.addEventListener('change', reset);
})();
