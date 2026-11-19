import { normalizeForDetection } from './normalize';
import { contextualMatches } from './context-rules';
import { detectCodeSecrets } from './code-secrets';
import { detectContext } from './detector';
import { classifyCredential, credentialCategoryForHeader, isRedactedCredential } from './credential-types';
/**
 * PromptShield AI — Core Detection Engine, Policy Store, Risk Scoring & Sanitizer
 * Pure TypeScript — zero Python dependency.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export interface Finding {
  id: string;
  rule_id: string;
  rule_name: string;
  category: string;
  severity: string;
  policy_action: string;
  weight: number;
  location: string;
  location_type: string;
  location_meta: Record<string, any>;
  matched_value: string;
  placeholder?: string;
  detection_source?: 'rule' | 'model';
  confidence?: number;
  explanation: string;
  is_blocking?: boolean;
}

export interface PolicyRule {
  id: string;
  name: string;
  category: string;
  description: string;
  severity: string;
  policy_action: string;
  enabled: boolean;
  weight: number;
  config: { pattern?: string; patterns?: string[]; keywords?: string[] };
}

export interface PolicySettings {
  allow_threshold: number;
  warn_threshold: number;
  block_threshold: number;
  strict_blocking_override: boolean;
}

export interface AuditRecord {
  id: string;
  timestamp: string;
  source_type: string;
  safe_source_label: string;
  finding_counts: Record<string, number>;
  total_findings: number;
  risk_score: number;
  policy_decision: string;
  action_taken: string;
  incomplete_scan: boolean;
  notes?: string;
}

export interface PolicyEval {
  risk_score: number;
  policy_decision: string;
  decision_summary: string;
  blocking_reasons: string[];
  score_breakdown: { category: string; count: number; base_weight: number; severity: string; multiplier: number; points_added: number }[];
  formula_explanation: string;
  category_counts: Record<string, number>;
  total_findings: number;
}

export interface ScanResult extends PolicyEval {
  source_type: string;
  safe_source_label: string;
  filename?: string;
  raw_text: string;
  findings: Finding[];
  is_incomplete: boolean;
  coverage_notes: string;
  unsupported_elements: string[];
  page_texts?: { page: number; text: string }[];
  sheet_data?: Record<string, any>;
  csv_rows?: string[][];
  csv_delimiter?: string;
}

export interface AutoFixResult {
  original_content: string;
  sanitized_content: string;
  placeholder_map: Record<string, string>;
  diff_highlights?: { original: string; replacement: string }[];
  re_scan_findings: Finding[];
  re_scan_risk_score: number;
  re_scan_policy_decision: string;
  re_scan_summary: string;
  can_proceed?: boolean;
  export_note?: string;
}

// ─── Default Policy Rules ───────────────────────────────────────────────────

const DEFAULT_RULES: PolicyRule[] = [
  ...[
    ['person_name', 'Personal Names', 15], ['address', 'Home & Delivery Addresses', 25],
    ['health_info', 'Private Health Information', 30], ['financial_info', 'Personal Financial Information', 30],
  ].map(([category, name, weight]) => ({
    id: `rule_${category}`, name: String(name), category: String(category),
    description: 'Detected by the local trained context model. Review model findings before sharing.',
    severity: 'high', policy_action: 'warn', enabled: true, weight: Number(weight), config: {},
  })),
  {
    id: 'rule_email', name: 'Email Address Detection', category: 'email',
    description: 'Flags personal and corporate email addresses.',
    severity: 'medium', policy_action: 'warn', enabled: true, weight: 15,
    config: { pattern: '\\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}\\b' }
  },
  {
    id: 'rule_phone', name: 'Phone Number Detection', category: 'phone',
    description: 'Flags national and international phone numbers (with date & IP false-positive filtering).',
    severity: 'medium', policy_action: 'warn', enabled: true, weight: 15,
    config: { pattern: '(?:\\+?\\d{1,3}[-.\\s]?)?(?:\\(?\\d{2,5}\\)?[-.\\s]?)?\\d{3,5}[-.\\s]?\\d{4,5}\\b' }
  },
  {
    id: 'rule_account_id', name: 'Customer / Account ID Pattern', category: 'account_id',
    description: 'Flags account identifiers (e.g. ACC-12345, ACCT-9999, CUST-12345).',
    severity: 'high', policy_action: 'warn', enabled: true, weight: 25,
    config: { pattern: '\\b(ACC-\\d{4,8}|ACCT-[A-Z0-9-]{4,12}|CUST-[A-Z0-9-]{4,10}|USR-\\d{4,8}|EMP-\\d{4,8})\\b' }
  },
  {
    id: 'rule_gov_id', name: 'Government & Tax IDs (PAN / Aadhaar / SSN / IFSC)', category: 'gov_id',
    description: 'Flags sensitive national IDs such as Aadhaar, PAN, SSN, and bank IFSC codes.',
    severity: 'high', policy_action: 'warn', enabled: true, weight: 30,
    config: {
      patterns: [
        '\\b\\d{3}-\\d{2}-\\d{4}\\b',
        '\\b[A-Z]{5}\\d{4}[A-Z]\\b',
        '\\b[2-9]\\d{3}[\\s-]\\d{4}[\\s-]\\d{4}\\b',
        '\\b[A-Z]{4}0[A-Z0-9]{6}\\b',
      ]
    }
  },
  {
    id: 'rule_credit_card', name: 'Payment Card Numbers (Luhn-Verified)', category: 'credit_card',
    description: 'Blocks Luhn-validated credit and debit card numbers.',
    severity: 'critical', policy_action: 'block', enabled: true, weight: 40,
    config: { pattern: '\\b(?:\\d[ -]?){13,19}\\b' }
  },
  {
    id: 'rule_api_key', name: 'API Keys, Passwords & Secrets', category: 'api_key',
    description: 'Blocks API keys, JWTs, private key headers, DB credentials, and inline secrets.',
    severity: 'critical', policy_action: 'block', enabled: true, weight: 40,
    config: {
      patterns: [
        '\\b(sk-[a-zA-Z0-9_-]{16,})\\b',
        '\\b(sk_(?:live|test)_[a-zA-Z0-9_-]{12,})\\b',
        '\\b(pk_(?:live|test)_[a-zA-Z0-9_-]{12,})\\b',
        '\\b(AKIA[0-9A-Z]{16})\\b',
        '\\b(gh[pousr]_[a-zA-Z0-9]{30,})\\b',
        '\\b(AIza[0-9A-Za-z_-]{35})\\b',
        '\\bBearer\\s+[a-zA-Z0-9_\\-.]{25,}\\b',
        '\\bxox[baprs]-[0-9a-zA-Z-]{10,}\\b',
        '\\beyJ[A-Za-z0-9_-]{10,}\\.[A-Za-z0-9_-]{10,}\\.[A-Za-z0-9_-]{10,}\\b',
        '-----BEGIN [A-Z ]*PRIVATE KEY-----',
        '(?:postgres|postgresql|mysql|mongodb(?:\\+srv)?|redis):\\/\\/[^:\\s]+:[^@\\s]+@[^\\s"\'<>]+',
      ]
    }
  },
  {
    id: 'rule_confidential_keywords', name: 'Confidential & Restrictive Keywords', category: 'confidential_keyword',
    description: 'Blocks confidential / internal-only terms.',
    severity: 'high', policy_action: 'block', enabled: true, weight: 35,
    config: {
      keywords: [
        'confidential', 'internal only', 'secret quotation',
        'strictly confidential', 'proprietary information',
        'do not distribute', 'restricted distribution', 'nda protected',
        'for internal use only'
      ]
    }
  }
];

const DEFAULT_SETTINGS: PolicySettings = {
  allow_threshold: 10,
  warn_threshold: 11,
  block_threshold: 70,
  strict_blocking_override: true,
};

// ─── In-Memory Policy Store ─────────────────────────────────────────────────

export class PolicyStore {
  rules: PolicyRule[];
  settings: PolicySettings;
  auditLogs: AuditRecord[] = [];

  constructor() {
    this.rules = JSON.parse(JSON.stringify(DEFAULT_RULES));
    this.settings = { ...DEFAULT_SETTINGS };
  }

  restoreLocalState() {
    try {
      const saved = JSON.parse(localStorage.getItem('promptshield.preferences.v1') || 'null');
      if (saved && Array.isArray(saved.rules) && saved.rules.every((r: any) => typeof r.id === 'string' && r.config && typeof r.enabled === 'boolean')) {
        this.rules = DEFAULT_RULES.map(def => saved.rules.find((r: PolicyRule) => r.id === def.id) ?? JSON.parse(JSON.stringify(def)));
        // Old built-in assignment regex masked the label too. Preserve custom patterns while retiring that default.
        const secrets = this.rules.find(r => r.id === 'rule_api_key');
        if (secrets?.config.patterns) secrets.config.patterns = secrets.config.patterns.filter(p => !p.startsWith('\\b(?:password|passwd|pwd|api_key|apikey|secret_key|access_token|auth_token|client_secret)'));
        this.settings = { ...DEFAULT_SETTINGS, ...saved.settings };
      }
      const logs = JSON.parse(localStorage.getItem('promptshield.audit.v1') || '[]');
      if (Array.isArray(logs)) this.auditLogs = logs.slice(0, 500).filter((l: any) => l && typeof l.id === 'string' && typeof l.risk_score === 'number');
    } catch { /* Restricted or full storage leaves the scanner usable in memory. */ }
  }

  persistLocalState() {
    try {
      localStorage.setItem('promptshield.preferences.v1', JSON.stringify({ rules: this.rules, settings: this.settings }));
      const logs = this.auditLogs.map(l => ({
        id: l.id, timestamp: l.timestamp, source_type: l.source_type,
        safe_source_label: l.source_type + ' scan', finding_counts: l.finding_counts,
        total_findings: l.total_findings, risk_score: l.risk_score,
        policy_decision: l.policy_decision, action_taken: l.action_taken,
        incomplete_scan: l.incomplete_scan,
      }));
      localStorage.setItem('promptshield.audit.v1', JSON.stringify(logs));
    } catch { /* Storage may be disabled; active-session state still works. */ }
  }

  getRules(): PolicyRule[] { return this.rules; }

  updateRule(ruleId: string, updates: Partial<PolicyRule & { config?: any }>) {
    const rule = this.rules.find(r => r.id === ruleId);
    if (!rule) return;
    if (updates.name !== undefined) rule.name = updates.name;
    if (updates.description !== undefined) rule.description = updates.description;
    if (updates.severity !== undefined) rule.severity = updates.severity;
    if (updates.policy_action !== undefined) rule.policy_action = updates.policy_action;
    if (updates.enabled !== undefined) rule.enabled = updates.enabled;
    if (updates.weight !== undefined) rule.weight = updates.weight;
    if (updates.config !== undefined) rule.config = updates.config;
  }

  getSettings(): PolicySettings { return { ...this.settings }; }

  updateSettings(updates: Partial<PolicySettings>) {
    Object.assign(this.settings, updates);
  }

  resetToDefaults() {
    this.rules = JSON.parse(JSON.stringify(DEFAULT_RULES));
    this.settings = { ...DEFAULT_SETTINGS };
  }

  addAuditLog(entry: Omit<AuditRecord, 'id' | 'timestamp'>): string {
    const id = `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.auditLogs.unshift({ id, timestamp: new Date().toISOString(), ...entry });
    if (this.auditLogs.length > 500) this.auditLogs.length = 500;
    return id;
  }

  getAuditLogs(limit = 100): AuditRecord[] { return this.auditLogs.slice(0, limit); }

  getAuditStats() {
    const logs = this.auditLogs;
    const total = logs.length;
    const avgScore = total ? Math.round(logs.reduce((s, l) => s + l.risk_score, 0) / total * 10) / 10 : 0;
    const decisions = { allow: 0, warn: 0, block: 0 } as Record<string, number>;
    const sources: Record<string, number> = {};
    const actions: Record<string, number> = {};
    for (const l of logs) {
      decisions[l.policy_decision] = (decisions[l.policy_decision] || 0) + 1;
      sources[l.source_type] = (sources[l.source_type] || 0) + 1;
      actions[l.action_taken] = (actions[l.action_taken] || 0) + 1;
    }
    return { total_scans: total, avg_risk_score: avgScore, decisions, sources, actions };
  }

  clearAuditLogs() { this.auditLogs = []; }
}

export const store = new PolicyStore();

// ─── Detection Engine ───────────────────────────────────────────────────────

interface CompiledRule {
  id: string; name: string; category: string; severity: string;
  policy_action: string; weight: number; regexes: RegExp[];
}

function isValidLuhn(digits: string): boolean {
  if (digits.length < 13 || digits.length > 19 || /^(\d)\1+$/.test(digits)) return false;
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = parseInt(digits[i], 10);
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

function isDateOrIp(val: string): boolean {
  const t = val.trim();
  if (/^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}$/.test(t)) return true;
  if (/^\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}$/.test(t)) return true;
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(t)) return true;
  return false;
}

let findingSeq = 0;

export class DetectionEngine {
  compiled: CompiledRule[];
  settings: PolicySettings;

  constructor(rules: PolicyRule[], settings: PolicySettings) {
    this.settings = settings;
    this.compiled = [];
    for (const r of rules) {
      if (!r.enabled) continue;
      const entry: CompiledRule = {
        id: r.id, name: r.name, category: r.category,
        severity: r.severity, policy_action: r.policy_action,
        weight: r.weight, regexes: []
      };
      try {
        if (r.config.pattern) entry.regexes.push(new RegExp(r.config.pattern, 'gi'));
        if (r.config.patterns) for (const p of r.config.patterns) entry.regexes.push(new RegExp(p, 'gi'));
        if (r.config.keywords) for (const kw of r.config.keywords) {
          const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          entry.regexes.push(new RegExp(`\\b${escaped}\\b`, 'gi'));
        }
      } catch { /* skip bad regex */ }
      this.compiled.push(entry);
    }
  }

  scanTextSegment(text: string, locationType: string, locationLabel: string, locationMeta: Record<string, any>): Finding[] {
    if (!text) return [];
    if (/^[\x00-\x7F]*$/.test(text)) return this.scanNormalizedText(text, locationType, locationLabel, locationMeta);
    const normalized = normalizeForDetection(text);
    return this.scanNormalizedText(normalized.text, locationType, locationLabel, locationMeta).map(f => {
      const start = normalized.starts[f.location_meta.start];
      const end = normalized.ends[f.location_meta.end - 1];
      const originalValue = text.slice(start, end);
      return { ...f, matched_value: originalValue,
        location_meta: { ...f.location_meta, start, end },
        explanation: f.explanation + (originalValue !== f.matched_value ? ' Unicode normalization exposed an obfuscated value.' : ''),
      };
    });
  }

  private scanNormalizedText(text: string, locationType: string, locationLabel: string, locationMeta: Record<string, any>): Finding[] {
    if (!text) return [];
    const findings: Finding[] = [];
    const sevRank: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
    const headerType = credentialCategoryForHeader(locationMeta.columnHeader);
    const credentialRule = this.compiled.find(r => r.id === 'rule_api_key' && r.category === 'api_key');
    const trimmed = text.trim();
    if (headerType && credentialRule && trimmed && !isRedactedCredential(trimmed)) {
      const start = text.indexOf(trimmed);
      findings.push({
        id: `f_${++findingSeq}_header_${start}`, rule_id: credentialRule.id, rule_name: credentialRule.name,
        category: headerType, severity: credentialRule.severity, policy_action: credentialRule.policy_action,
        weight: credentialRule.weight, location: locationLabel, location_type: locationType,
        location_meta: {...locationMeta,start,end:start+trimmed.length}, matched_value: trimmed,
        detection_source:'rule', explanation:`Column header identifies this value as ${headerType.replaceAll('_',' ')}.`,
        is_blocking:credentialRule.policy_action==='block',
      });
    }

    for (const rule of this.compiled) {
      for (const span of contextualMatches(text, rule.category)) {
        findings.push({
          id: `f_${++findingSeq}_context_${span.start}`, rule_id: rule.id, rule_name: rule.name,
          category: rule.category, severity: rule.severity, policy_action: rule.policy_action,
          weight: rule.weight, location: locationLabel, location_type: locationType,
          location_meta: { ...locationMeta, start: span.start, end: span.end },
          matched_value: span.value, detection_source: 'rule',
          explanation: `Context rule: ${rule.name}. Only the detected value is selected.`,
          is_blocking: rule.policy_action === 'block',
        });
      }
      for (const regex of rule.regexes) {
        regex.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = regex.exec(text)) !== null) {
          if (!m[0].length) { regex.lastIndex++; continue; }
          const val = m[0];
          if (rule.category === 'phone') {
            if (isDateOrIp(val)) continue;
            const digits = val.replace(/\D/g, '');
            const hasSeparators = /[+\-()\s]/.test(val);
            if (digits.length < 7 || digits.length > 15) continue;
            if (!hasSeparators && digits.length < 10) continue;
            if (isValidLuhn(digits)) continue;
          }
          if (rule.category === 'credit_card') {
            const digits = val.replace(/\D/g, '');
            if (!isValidLuhn(digits)) continue;
          }
          findings.push({
            id: `f_${++findingSeq}_${rule.category}_${m.index}`,
            rule_id: rule.id, rule_name: rule.name,
            category: rule.category, severity: rule.severity,
            policy_action: rule.policy_action, weight: rule.weight,
            location: locationLabel,
            location_type: locationType,
            location_meta: { ...locationMeta, start: m.index, end: m.index + val.length },
            matched_value: val, detection_source: 'rule',
            explanation: `Rule match: ${rule.name} detected ${rule.category} pattern.`,
            is_blocking: rule.policy_action === 'block'
          });
        }
      }
    }

    for (const span of [...detectCodeSecrets(text), ...detectContext(text)]) {
      const rule = this.compiled.find(r => r.category === span.category);
      if (!rule) continue;
      // Deterministic verified matches take priority over contextual predictions.
      if (findings.some(f => Math.max(span.start, f.location_meta.start) < Math.min(span.end, f.location_meta.end))) continue;
      findings.push({
        id: `f_${++findingSeq}_model_${span.start}`, rule_id: rule.id,
        rule_name: rule.name, category: rule.category, severity: rule.severity,
        policy_action: rule.policy_action, weight: rule.weight,
        location: locationLabel, location_type: locationType,
        location_meta: { ...locationMeta, start: span.start, end: span.end },
        matched_value: text.slice(span.start, span.end), detection_source: 'model', confidence: span.confidence,
        explanation: `Local trained context model: ${Math.round(span.confidence * 100)}% model confidence. Review before sharing.`,
        is_blocking: rule.policy_action === 'block',
      });
    }

    // Deduplicate overlapping spans (keep higher severity)
    findings.sort((a, b) => (sevRank[b.severity] || 0) - (sevRank[a.severity] || 0) || (b.location_meta.end - b.location_meta.start) - (a.location_meta.end - a.location_meta.start));
    const deduped: Finding[] = [];
    for (const f of findings) {
      const overlap = deduped.some(d =>
        d.location === f.location &&
        Math.max(f.location_meta.start, d.location_meta.start) < Math.min(f.location_meta.end, d.location_meta.end)
      );
      if (!overlap) deduped.push(f);
    }
    return deduped.sort((a,b) => a.location_meta.start - b.location_meta.start).map(f => {
      if(f.category!=='api_key')return f;
      const category=classifyCredential(text,f.location_meta.start,f.location_meta.end,headerType);
      return {...f,category,explanation:`${f.explanation} Classified as ${category.replaceAll('_',' ')} from the value and its label.`};
    });
  }

  evaluatePolicyAndScore(findings: Finding[], isIncomplete = false): PolicyEval {
    const mults: Record<string, number> = { low: 0.5, medium: 1, high: 1.4, critical: 2 };
    const catCounts: Record<string, number> = {};
    const byCat: Record<string, Finding[]> = {};
    const blockingReasons: string[] = [];

    for (const f of findings) {
      catCounts[f.category] = (catCounts[f.category] || 0) + 1;
      (byCat[f.category] ??= []).push(f);
      if (f.policy_action === 'block') {
        const msg = `Blocking rule '${f.rule_name}' triggered by ${f.category} at ${f.location}.`;
        if (!blockingReasons.includes(msg)) blockingReasons.push(msg);
      }
    }

    let raw = 0;
    const breakdown: PolicyEval['score_breakdown'] = [];
    for (const [cat, items] of Object.entries(byCat)) {
      const w = items[0].weight;
      const sev = items[0].severity;
      const mult = mults[sev] || 1;
      const pts = Math.round(w * mult + (items.length - 1) * w * 0.25);
      raw += pts;
      breakdown.push({ category: cat, count: items.length, base_weight: w, severity: sev, multiplier: mult, points_added: pts });
    }
    const score = Math.min(100, Math.max(0, raw));
    const { allow_threshold: at, warn_threshold: wt, block_threshold: bt, strict_blocking_override: strict } = this.settings;

    let decision: string, summary: string;
    if (blockingReasons.length > 0 && strict) {
      decision = 'block';
      summary = `Blocked by policy rule: ${blockingReasons.length} blocking violation(s). Low score cannot override blocking rules.`;
    } else if (score >= bt) {
      decision = 'block';
      summary = `Blocked by risk threshold: score ${score} >= ${bt}.`;
    } else if (findings.length > 0 || score >= wt) {
      decision = 'warn';
      summary = `Warning: ${findings.length} sensitive item(s) found. Review and masking required.`;
    } else {
      decision = 'allow';
      summary = 'Allowed: No sensitive items detected.';
    }
    if (isIncomplete) {
      if (decision === 'allow') decision = 'warn';
      summary += ' (Incomplete scan: some content could not be inspected.)';
    }

    const bStr = breakdown.map(b => `${b.category}: +${b.points_added}pts`).join(', ') || '0pts';
    const formula = `Risk Score: ${score}/100. Weights: ${bStr}. Thresholds: 0-${at} Allow, ${wt}-${bt - 1} Warn, >=${bt} Block. Strict blocking: ${strict ? 'ON' : 'OFF'}.`;

    return { risk_score: score, policy_decision: decision, decision_summary: summary, blocking_reasons: blockingReasons, score_breakdown: breakdown, formula_explanation: formula, category_counts: catCounts, total_findings: findings.length };
  }
}

export function getEngine(): DetectionEngine {
  return new DetectionEngine(store.getRules(), store.getSettings());
}

// ─── Sanitizer ──────────────────────────────────────────────────────────────

const PLACEHOLDER_PREFIXES: Record<string, string> = {
  person_name: 'PERSON', address: 'ADDRESS', health_info: 'HEALTH', financial_info: 'FINANCIAL',
  email: 'EMAIL', phone: 'PHONE', account_id: 'ACCOUNT',
  gov_id: 'GOV_ID', credit_card: 'CARD',
  password:'PASSWORD', otp:'OTP', access_token:'ACCESS_TOKEN', private_key:'PRIVATE_KEY', connection_string:'CONNECTION_STRING', secret:'SECRET', credential:'CREDENTIAL',
  api_key: 'API_KEY', confidential_keyword: 'CONFIDENTIAL',
};

export class Sanitizer {
  static generatePlaceholderMap(findings: Finding[]): Record<string, string> {
    const counters: Record<string, number> = {};
    const map: Record<string, string> = {};
    for (const f of findings) {
      const val = f.matched_value;
      if (!val || map[val]) continue;
      const prefix = PLACEHOLDER_PREFIXES[f.category] || 'REDACTED';
      counters[prefix] = (counters[prefix] || 0) + 1;
      map[val] = `[${prefix}_${counters[prefix]}]`;
    }
    // Set placeholder on each finding
    for (const f of findings) f.placeholder = map[f.matched_value];
    return map;
  }

  static sanitizeText(text: string, map: Record<string, string>): string {
    if (!text) return text;
    let out = text;
    const sorted = Object.entries(map).sort((a, b) => b[0].length - a[0].length);
    for (const [orig, ph] of sorted) {
      out = out.split(orig).join(ph);
    }
    return out;
  }

  static sanitizePrompt(text: string, findings: Finding[], engine: DetectionEngine): AutoFixResult {
    const map = this.generatePlaceholderMap(findings);
    const sanitized = this.sanitizeText(text, map);
    const rescan = engine.scanTextSegment(sanitized, 'prompt', 'Sanitized', { start: 0, end: sanitized.length });
    const reval = engine.evaluatePolicyAndScore(rescan);
    return {
      original_content: text, sanitized_content: sanitized, placeholder_map: map,
      re_scan_findings: rescan, re_scan_risk_score: reval.risk_score,
      re_scan_policy_decision: reval.policy_decision, re_scan_summary: reval.decision_summary,
    };
  }

  static sanitizeCsv(rows: string[][], findings: Finding[], engine: DetectionEngine, delimiter = ','): AutoFixResult {
    const map = this.generatePlaceholderMap(findings);
    const formatCell = (cell: string) => {
      // Quoting alone does not stop spreadsheet formula execution.
      if (/^[\s]*[=+@-]/.test(cell) || /^[\t\r]/.test(cell)) cell = "'" + cell;
      if (cell.includes(delimiter) || cell.includes('"') || cell.includes('\n') || cell.includes('\r')) {
        return `"${cell.replace(/"/g, '""')}"`;
      }
      return cell;
    };
    const sanRows = rows.map(r => r.map(c => this.sanitizeText(c, map)));
    const origText = rows.map(r => r.map(formatCell).join(delimiter)).join('\n');
    const sanText = sanRows.map(r => r.map(formatCell).join(delimiter)).join('\n');
    const rescan = sanRows.flatMap((row,ri) => row.flatMap((cell,ci) => engine.scanTextSegment(cell, 'csv', `Sanitized Row ${ri+1}, Col ${ci+1}`, {row:ri+1,col:ci+1})));
    const reval = engine.evaluatePolicyAndScore(rescan);
    return {
      original_content: origText, sanitized_content: sanText, placeholder_map: map,
      re_scan_findings: rescan, re_scan_risk_score: reval.risk_score,
      re_scan_policy_decision: reval.policy_decision, re_scan_summary: reval.decision_summary,
    };
  }
}

