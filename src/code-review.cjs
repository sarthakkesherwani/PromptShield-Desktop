const {getEngine,Sanitizer}=require('../detector-bundle.cjs');
const categories=new Set(['api_key','password','otp','access_token','private_key','connection_string','secret','credential']);
function reviewCode(text){
 if(typeof text!=='string'||Buffer.byteLength(text)>32768)throw new Error('Use a snippet up to 32 KB.');
 const engine=getEngine();
 const findings=engine.scanTextSegment(text,'code','Snippet',{}).filter(f=>categories.has(f.category));
 const placeholders=Sanitizer.generatePlaceholderMap(findings);
 let masked=text;
 for(const f of [...findings].sort((a,b)=>b.location_meta.start-a.location_meta.start)){
  const {start,end}=f.location_meta;
  masked=masked.slice(0,start)+placeholders[f.matched_value]+masked.slice(end);
 }
 return {count:findings.length,masked};
}
module.exports={reviewCode};
