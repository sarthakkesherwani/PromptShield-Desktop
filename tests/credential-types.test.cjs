const test=require('node:test'),assert=require('node:assert/strict');
const {getEngine,Sanitizer}=require('../detector-bundle.cjs');
const {scanSnapshot}=require('../src/scan.cjs');
const headers=[
 ['Password','Quartz#999','password','PASSWORD'],['Pwd','ab','password','PASSWORD'],
 ['Login Password','two word passphrase','password','PASSWORD'],['ADMIN_PASSWORD','1234','password','PASSWORD'],
 ['Pass\u200bword','DemoOnly123!','password','PASSWORD'],['Passphrase','correct horse battery staple','password','PASSWORD'],
 ['OTP','123456','otp','OTP'],['One-time password','4321','otp','OTP'],['Verification Code','246810','otp','OTP'],
 ['API Key','demo_key_1234567890','api_key','API_KEY'],['api_key','demo_key_1234567890','api_key','API_KEY'],
 ['Access Token','demo_access_1234567890','access_token','ACCESS_TOKEN'],['Client Secret','demo_secret_123','secret','SECRET'],
];
for(const [header,value,category,token] of headers)test(`spreadsheet ${header} produces ${category}, not an umbrella label`,()=>{
 const result=scanSnapshot({status:'snapshot',sheet:'Demo',cells:[{row:1,column:2,text:header},{row:2,column:2,text:value}]});
 const item=result.items.find(x=>x.cell==='B2');assert.ok(item);assert.equal(result.status,'risk');assert.deepEqual(item.categories,[category]);assert.equal(item.preview,`[${token}_1]`);assert.ok(!JSON.stringify(result).includes(value));
});
const phrases=[
 ['password=Quartz#999','password','PASSWORD'],
 ['My password is "correct horse battery staple"','password','PASSWORD'],
 ['mera password Quartz#999 hai','password','PASSWORD'],
 ['mera password hai Quartz#999','password','PASSWORD'],
 ['OTP: 123456','otp','OTP'],
 ['api_key=sk-demo_abcdefghijklmnop123456','api_key','API_KEY'],
 ['Authorization: Bearer sampleToken1234567890','access_token','ACCESS_TOKEN'],
 ['postgresql://demo:fakepass@localhost/training','connection_string','CONNECTION_STRING'],
 ['-----BEGIN PRIVATE KEY-----\nSYNTHETIC-NOT-A-REAL-KEY\n-----END PRIVATE KEY-----','private_key','PRIVATE_KEY'],
];
for(const [text,category,token] of phrases)test(`context classifies ${text.slice(0,30)} as ${category}`,()=>{
 const engine=getEngine(),findings=engine.scanTextSegment(text,'test','Demo',{});assert.equal(findings.length,1);assert.equal(findings[0].category,category);assert.equal(findings[0].is_blocking,true);
 const clean=Sanitizer.sanitizePrompt(text,findings,engine);assert.ok(clean.sanitized_content.includes(`[${token}_1]`));assert.ok(!clean.sanitized_content.includes(findings[0].matched_value));assert.equal(clean.re_scan_findings.length,0);
 if(text.includes('correct horse'))assert.equal(clean.sanitized_content,'My password is "[PASSWORD_1]"');
});
for(const text of ['My password is strong','Please reset your password tomorrow','Server IP is 192.168.1.1','The meeting is on 2026-11-18'])test(`benign text is not turned into a secret: ${text}`,()=>assert.equal(getEngine().scanTextSegment(text,'test','Demo',{}).length,0));
for(const value of ['[PASSWORD_1]','${DEMO_SECRET}','process.env.DEMO_PASSWORD','***','not set'])test(`already-redacted or unset password stays clear: ${value}`,()=>{
 const result=scanSnapshot({status:'snapshot',sheet:'Demo',cells:[{row:1,column:1,text:'Password'},{row:2,column:1,text:value}]});assert.equal(result.status,'clear');
});
test('password column context masks the whole value even if it looks like an email',()=>{const result=scanSnapshot({status:'snapshot',sheet:'Demo',cells:[{row:1,column:1,text:'Password'},{row:2,column:1,text:'demo@example.com'}]});assert.equal(result.status,'risk');assert.deepEqual(result.items[0].categories,['password']);assert.equal(result.items[0].preview,'[PASSWORD_1]');});
test('one prompt keeps password, email and API key categories distinct',()=>{const e=getEngine();const text='password=Quartz#999 email=demo@example.com api_key=sk-demo_abcdefghijklmnop123456';const f=e.scanTextSegment(text,'test','Demo',{});assert.deepEqual(f.map(x=>x.category),['password','email','api_key']);const clean=Sanitizer.sanitizePrompt(text,f,e);assert.ok(clean.sanitized_content.includes('[PASSWORD_1]'));assert.ok(clean.sanitized_content.includes('[EMAIL_1]'));assert.ok(clean.sanitized_content.includes('[API_KEY_1]'));assert.equal(clean.re_scan_findings.length,0);});

test('unknown headers do not inherit a credential type from object prototypes',()=>{const result=scanSnapshot({status:'snapshot',sheet:'Demo',cells:[{row:1,column:1,text:'constructor'},{row:2,column:1,text:'Blue ink'}]});assert.equal(result.status,'clear');});
