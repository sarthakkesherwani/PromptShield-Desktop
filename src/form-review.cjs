const {execFile}=require('node:child_process');
const fs=require('node:fs'),path=require('node:path');
const browsers={chrome:'Google Chrome',safari:'Safari'};
function classifyField(field,origin,scholarship){
 const text=[field.label,field.name,field.autocomplete].join(' ').replace(/([a-z])([A-Z])/g,'$1 $2').replace(/[_-]+/g,' ').toLowerCase();
 const advice=(status,reason)=>({label:field.label,status,reason});
 if(/upi\s*(?:pin|password)|atm\s*pin|cvv|cvc|card security code|cc csc|net\s*banking password|bank password|private key|seed phrase|यूपीआई पिन/.test(text))
   return advice('Stop','Keep this secret out of application forms. A UPI PIN authorizes a payment.');
 if(!origin.startsWith('https://') || !field.destination?.startsWith('https://'))
   return advice('Stop','The page or its declared form destination lacks HTTPS.');
 if(field.destination!==origin)
   return advice('Check first','The form declares a different destination. Verify the provider and recipient before entering details.');
 if(/otp|one time|verification code|सत्यापन कोड/.test(text)||field.type==='password'||/password|पासवर्ड/.test(text))
   return advice('Check first','Use only the portal’s own sign-in or verification step that you initiated. Read the purpose of any OTP.');
 if(/aadhaar|aadhar|आधार|account|खाता|ifsc|bank|income|आय प्रमाण|identity|certificate|document|date of birth|\bdob\b|passport|\bpan\b|card number/.test(text)||field.type==='file')
   return advice('Check first','Check the scheme or service instructions for this exact field, purpose and stage before sharing.');
 if(scholarship && /\b(name|school|college|course|class|grade|semester|marks|institution|email|mobile|phone)\b|नाम|विद्यालय|कॉलेज|कक्षा|मोबाइल/.test(text))
   return advice('Fits the purpose','Common for scholarship applications. Confirm the portal and share only what this scheme requires.');
 return advice('Check first','The label alone does not establish why this information is needed.');
}
function reviewPage(page,scholarship){
 const url=new URL(page.origin);
 if(!['https:','http:'].includes(url.protocol)||!Array.isArray(page.fields))throw Error('Unsupported page');
 const listed=url.protocol==='https:'&&url.hostname==='scholarships.gov.in'&&!url.port;
 return {origin:url.origin,notice:listed?'This address matches the National Scholarship Portal. Check the scheme instructions for required fields.':'Verify this exact address against the link published by the institution or scheme owner.',
 fields:page.fields.slice(0,100).map(f=>classifyField(f,url.origin,scholarship)),partial:!!(page.truncated||page.embedded)};
}
function inspectTab(browser,scholarship){
 if(process.platform!=='darwin'||!Object.hasOwn(browsers,browser))throw Error('Unsupported browser');
 const target=browsers[browser],js=fs.readFileSync(path.join(__dirname,'read-form-fields.js'),'utf8');
 const command=browser==='chrome'?'execute active tab of front window javascript probe':'do JavaScript probe in current tab of front window';
 const program='on run argv\nset probe to item 1 of argv\nif application "'+target+'" is not running then error "Browser closed"\ntell application "'+target+'" to '+command+'\nend run';
 return new Promise((resolve,reject)=>execFile('/usr/bin/osascript',['-e',program,js],{timeout:10000,maxBuffer:256*1024},(error,out)=>{
   if(error)return reject(Error('Open the form in the selected browser and allow JavaScript from Apple Events and macOS Automation access.'));
   try{resolve(reviewPage(JSON.parse(out),scholarship===true));}catch{reject(Error('Could not read fields on this tab. Open a regular web form.'));}
 }));
}
module.exports={inspectTab,reviewPage};
