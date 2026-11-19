const {test}=require('node:test'),assert=require('node:assert/strict');
const {reviewPage}=require('../src/form-review.cjs');
const site='https://scholarships.gov.in';
const review=(label,origin=site,destination=origin)=>reviewPage({origin,fields:[{label,destination}]},true);
test('scholarship labels distinguish purpose, sensitive identifiers and payment secrets',()=>{
 for(const [label,status] of [['College name','Fits the purpose'],['आधार नंबर','Check first'],['OTP','Check first'],['UPI PIN','Stop'],['CVV','Stop'],['Other','Check first']])assert.equal(review(label).fields[0].status,status);
});
test('lookalike origins, insecure transport and external submissions',()=>{
 assert.match(review('Name',site+'.example.org').notice,/Verify this exact/);
 assert.equal(review('Name','http://example.org').fields[0].status,'Stop');
 assert.equal(review('Name',site,'https://example.org').fields[0].status,'Check first');
});
