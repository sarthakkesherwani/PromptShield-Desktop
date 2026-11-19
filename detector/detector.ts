import model from './context-model.json';

export type ModelSpan = { start: number; end: number; category: string; confidence: number };
function features(tokens: string[], i: number): string[] {
  const out: string[] = [];
  for (let offset = -4; offset <= 4; offset++) {
    const w = tokens[i + offset] ?? '<edge>';
    const alpha = /^[A-Za-z]+$/.test(w);
    const shape = /^\d+$/.test(w) ? 'number' : alpha && w === w.toUpperCase() ? 'upper' : /^[A-Z][a-z]*$/.test(w) ? 'title' : alpha && w === w.toLowerCase() ? 'lower' : 'mixed';
    out.push(`w${offset}=${w.toLowerCase()}`, `s${offset}=${shape}`);
  }
  const w = tokens[i];
  out.push(`length=${Math.min(Math.floor(w.length / 4), 8)}`, `digit=${/\d/.test(w) ? 'True' : 'False'}`, `symbol=${/[^A-Za-z0-9]/.test(w) ? 'True' : 'False'}`);
  for (const n of [2, 3]) out.push(`prefix${n}=${w.slice(0,n).toLowerCase()}`, `suffix${n}=${w.slice(-n).toLowerCase()}`);
  return out;
}
const weights = model.weights as Record<string, number[][]>;
export const detectorInfo = { name: 'PromptShield Context', version: model.version, trainingTokens: model.training_tokens };
/** Exact offsets refer to original text. No prompt logging, persistence, or network calls. */
export function detectContext(text: string): ModelSpan[] {
  const tokens = [...text.matchAll(/[A-Za-z0-9_@+/#$%*-]+|[^\s]/g)];
  const words = tokens.map(t => t[0]);
  const placeholders = [...text.matchAll(/\[[A-Z_]+_\d+\]|\$\{[A-Za-z_][A-Za-z0-9_]*\}/g)].map(m => [m.index!, m.index! + m[0].length]);
  const result: ModelSpan[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const start = tokens[i].index!;
    if (placeholders.some(([a,b]) => start >= a && start < b) || !/[A-Za-z0-9]/.test(words[i])) continue;
    const scores = [...model.bias];
    for (const f of features(words, i)) for (const [label, value] of weights[f] ?? []) scores[label] += value;
    const max = Math.max(...scores);
    const exp = scores.map(s => Math.exp(s - max));
    const sum = exp.reduce((a,b) => a+b,0);
    const winner = scores.indexOf(max);
    const category = model.classes[winner];
    const confidence = exp[winner] / sum;
    if (category === 'O' || confidence < model.threshold) continue;
    // Dates and network addresses alone are not credentials; explicit secret context still wins.
    if (category === 'api_key' && /^(?:\d{4}-\d{1,2}-\d{1,2}|\d{1,3}(?:\.\d{1,3}){3})$/.test(words[i]) &&
        !/password|passphrase|secret|token|credential|login code/i.test(words.slice(Math.max(0,i-4),i).join(' '))) continue;
    const end = start + words[i].length;
    const prev = result.at(-1);
    if (prev && prev.category === category && /^\s*$/.test(text.slice(prev.end, start))) {
      prev.end = end; prev.confidence = Math.min(prev.confidence, confidence);
    } else result.push({ start, end, category, confidence });
  }
  return result;
}
