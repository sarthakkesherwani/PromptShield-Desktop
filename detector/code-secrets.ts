import model from './code-secret-weights.json';
import type { ModelSpan } from './detector';

// Restrict inference to literal assignments. Quoted strings work in source code;
// unquoted values must occupy a complete dotenv-style assignment line.
const assignments = /(?:["']?\b([A-Za-z_][\w]*)["']?)[ \t]*[:=][ \t]*(?:"([^"\r\n]+)"|'([^'\r\n]+)'|([A-Za-z0-9_+./=-]+)(?=[ \t]*(?:#.*)?$))/gm;
export function detectCodeSecrets(text: string): ModelSpan[] {
  const spans: ModelSpan[] = [];
  for (const match of text.matchAll(assignments)) {
    const value = match[2] ?? match[3] ?? match[4];
    if (!value || value.length < 12 || /^(?:process\.env\.|import\.meta\.env\.|\$|\[|<|your[_-]|replace[_-]|example[_-]|placeholder)/i.test(value)) continue;
    if (match[4] && !/^(?:\s*export\s+)?\s*$/.test(text.slice(text.lastIndexOf('\n', match.index! - 1) + 1, match.index!))) continue;
    const words = match[1].replace(/([a-z0-9])([A-Z])/g,'$1_$2').toLowerCase().split('_');
    const features = [
      words.some(w => ['api','access','auth','client','private','signing','service','deployment','secret'].includes(w)),
      words.some(w => ['key','token','secret','credential','password'].includes(w)),
      value.length >= 12, value.length >= 20, /\d/.test(value), /[A-Z]/.test(value) && /[a-z]/.test(value),
    ];
    const score = features.reduce((sum,on,i) => sum + (on ? model.weights[i] : 0), model.bias);
    const confidence = 1 / (1 + Math.exp(-score));
    if (confidence < .85) continue;
    const start = match.index! + match[0].lastIndexOf(value);
    spans.push({start, end:start+value.length, category:'api_key', confidence});
  }
  return spans;
}
