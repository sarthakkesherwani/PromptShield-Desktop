export type CredentialCategory = 'password' | 'otp' | 'api_key' | 'access_token' | 'private_key' | 'connection_string' | 'secret' | 'credential';
const headerTypes: Record<string, CredentialCategory> = {
 password:'password', passwords:'password', pwd:'password', passwd:'password', passphrase:'password',
 'login password':'password', 'user password':'password', 'admin password':'password', 'database password':'password',
 otp:'otp', 'one time password':'otp', 'verification code':'otp', 'security pin':'otp', pin:'otp',
 'api key':'api_key', apikey:'api_key', 'api token':'api_key',
 'access token':'access_token', 'auth token':'access_token', 'authorization token':'access_token', 'bearer token':'access_token', jwt:'access_token',
 'private key':'private_key', 'connection string':'connection_string', 'database url':'connection_string',
 'secret key':'secret', 'client secret':'secret', secret:'secret', credentials:'credential', credential:'credential',
};
export function credentialCategoryForHeader(header: unknown): CredentialCategory | undefined {
 if(typeof header!=='string')return undefined;
 const normalized=header.normalize('NFKC').toLowerCase().replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u2069\uFEFF]/g,'').replace(/[_\-]+/g,' ').replace(/[:*]+$/g,'').replace(/\s+/g,' ').trim();
 return Object.hasOwn(headerTypes,normalized)?headerTypes[normalized]:undefined;
}
export function isRedactedCredential(value:string):boolean {
 return /^\[[A-Z_]+_\d+\]$|^\$\{[^}]+\}$|^process\.env\.[A-Za-z_][A-Za-z0-9_]*$/.test(value) || /^(?:n\/a|not set|none|null|undefined|redacted|masked|\[redacted\]|<redacted>|\*{3,})$/i.test(value);
}
export function classifyCredential(text:string,start:number,end:number,headerType?:CredentialCategory):CredentialCategory {
 if(headerType)return headerType;
 const value=text.slice(start,end);
 if(/-----BEGIN (?:[A-Z]+ )*PRIVATE KEY-----/.test(value))return 'private_key';
 if(/^(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis):\/\//i.test(value))return 'connection_string';
 const before=text.slice(Math.max(0,start-140),start).split(/[\r\n]/).at(-1)||'';
 // The nearest explicit field label owns the value. Broad model output cannot rename it.
 const label=before.match(/\b(one[-_ ]time password|verification code|security pin|otp|password|passwd|pwd|passphrase|login code|api[_ -]?key|api[_ -]?token|secret[_ -]?key|client[_ -]?secret|access[_ -]?token|auth[_ -]?token|bearer|secret|token)["']?\s*(?:(?:[:=]|\bis\b|\bhai\b|\bh\b|\btha\b)\s*)?["']?\s*$/i)?.[1]?.toLowerCase().replace(/[_-]/g,' ').replace(/\s+/g,' ');
 if(label){
  if(/^(?:otp|one time password|verification code|security pin|login code)$/.test(label))return 'otp';
  if(/^(?:password|passwd|pwd|passphrase)$/.test(label))return 'password';
  if(/^(?:api key|api token)$/.test(label))return 'api_key';
  if(/^(?:access token|auth token|token|bearer)$/.test(label))return 'access_token';
  return 'secret';
 }
 if(/^Bearer\s|^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/i.test(value))return 'access_token';
 if(/^(?:sk[-_]|pk_(?:live|test)_|AKIA[0-9A-Z]{16}|gh[pousr]_|github_pat_|npm_|AIza|xox[baprs]-)/.test(value))return 'api_key';
 return 'credential';
}
