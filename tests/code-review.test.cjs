const test=require('node:test'),assert=require('node:assert/strict');
const {reviewCode}=require('../src/code-review.cjs');
test('desktop snippet and dotenv review masks only literal credentials',()=>{
 const value='Demo7Axtificial9Value42';
 for(const line of [`const signingKey = "${value}";`,`export DEPLOYMENT_CREDENTIAL=${value}`]){
  const result=reviewCode(line);assert.equal(result.count,1);assert.match(result.masked,/\[[A-Z_]+_1\]/);assert.equal(result.masked.replace(/\[[A-Z_]+_1\]/,value),line);
 }
 const safe='const apiKey = process.env.API_KEY;\nAPI_KEY=${VENDOR_TOKEN}';
 assert.deepEqual(reviewCode(safe),{count:0,masked:safe});
 assert.throws(()=>reviewCode('a'.repeat(32769)));
});
