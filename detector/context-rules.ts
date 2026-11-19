/** High-precision context rules complement the learned classifier. Never label them ML. */
export const contextRules: Record<string, RegExp[]> = {
  api_key: [
    /\bgithub_pat_[A-Za-z0-9_]{22,}\b/g,
    /\bnpm_[A-Za-z0-9]{36}\b/g,
    /\b(?:password|passwd|pwd|passphrase|api[_ -]?key|api[_ -]?token|secret[_ -]?key|client[_ -]?secret|access[_ -]?token|auth[_ -]?token)\s*(?:is|hai|h|tha)\s*(?:"(?<double>[^"\r\n]+)"|'(?<single>[^'\r\n]+)')/gi,
    /\bauthorization\s*:\s*Bearer\s+(?<value>[A-Z0-9._~+/-]{8,}=*)/gi,
    /\b(?:otp|one[- ]time password|verification code|security pin)\s*(?:is|hai|[:=])\s*["']?(?<value>\d{4,8})\b/gi,
    /["']?\b(?:password|passwd|pwd|api[_ -]?key|secret[_ -]?key|access[_ -]?token|auth[_ -]?token|client[_ -]?secret|passphrase)["']?\s*[:=]\s*(?:"(?<double>[^"\r\n]{3,})"|'(?<single>[^'\r\n]{3,})'|(?<bare>[^\s'",;}{]{3,}))/gi,
    /\b(?:mera|meri|my|the|admin|database|login|production)\s+(?:password|passphrase|secret|token|login code)\s+(?:is|hai|h|tha)\s+["']?(?<value>[^\s'",;}{]{3,})/gi,
    /\b(?:mera|meri)\s+(?:password|passphrase|secret|token)\s+["']?(?<value>[^\s'",;}{]{3,})(?=\s+(?:hai|h|tha)\b)/gi,
    /-----BEGIN (?<keytype>(?:[A-Z]+ )*PRIVATE KEY)-----[\s\S]*?-----END \k<keytype>-----/g,
  ],
  email: [ /\b[A-Z0-9._%+-]+\s*(?:\[at\]|\(at\))\s*[A-Z0-9-]+(?:\s*(?:\[dot\]|\(dot\))\s*[A-Z0-9-]+)+\b/gi ],
  gov_id: [ /\b(?:aadhaar|aadhar)\s*(?:number|no\.?|id)?\s*[:=]?\s*(?<value>[2-9]\d{3}[ -]\d{4}[ -]\d{4})\b/gi, /\b(?:aadhaar|aadhar)\s*(?:number|no\.?|id)?\s*[:=]?\s*(?<value>[2-9]\d{11})\b/gi ],
  account_id: [
    /\b(?:bank account|account number|account no\.?|a\/c)\s*[:=]?\s*(?<value>\d{9,18})\b/gi,
    /\b(?:upi|vpa)\s*(?:id)?\s*[:=]?\s*(?<value>[A-Z0-9._-]{2,}@[A-Z][A-Z0-9]{1,})\b/gi,
  ],
};
export function contextualMatches(text: string, category: string) {
  const result: { start: number; end: number; value: string }[] = [];
  for (const regex of contextRules[category] ?? []) {
    regex.lastIndex = 0;
    for (const m of text.matchAll(regex)) {
      const value = m.groups?.value ?? m.groups?.double ?? m.groups?.single ?? m.groups?.bare ?? m[0];
      if (category === 'api_key' && m.groups?.value && /^(?:very|strong|secure|weak|forgotten|unknown|unavailable|not|kya)[.!]?$/i.test(value)) continue;
      const start = m.index! + (value === m[0] ? 0 : m[0].lastIndexOf(value));
      // These are redaction placeholders or environment references, not concrete credentials.
      if (/^\[[A-Z_]+_\d+\]$|^\$\{[^}]+\}$|^(?:process\.env\.|import\.meta\.env\.|os\.getenv\(|os\.environ(?:\[|\.get\()|\$[A-Za-z_{]|<|your[_-]|replace[_-]|example[_-])/.test(value)) continue;
      result.push({ start, end: start + value.length, value });
    }
  }
  return result;
}

