function resolveSource(platform,source='excel') {
 if(source!=='excel'&&source!=='numbers')throw new Error('Choose Microsoft Excel or Apple Numbers.');
 if(!['darwin','win32'].includes(platform))throw new Error('Live monitoring requires macOS or Windows.');
 if(source==='numbers'&&platform!=='darwin')throw new Error('Apple Numbers monitoring is available on macOS only.');
 return {source,label:source==='numbers'?'Numbers':'Excel',script:source==='numbers'?'numbers-snapshot-mac.js':'excel-snapshot-mac.js'};
}
module.exports={resolveSource};
