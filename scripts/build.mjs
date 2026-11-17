import {build} from 'esbuild';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
await build({entryPoints:['detector/engine.ts'],outfile:'detector-bundle.cjs',bundle:true,platform:'node',format:'cjs',target:'node22'});
if(process.platform==='darwin'){
 fs.mkdirSync('native',{recursive:true});
 for(const arch of ['arm64','x86_64'])execFileSync('/usr/bin/xcrun',['clang++','src/cell-anchor.mm','-arch',arch,'-mmacosx-version-min=11.0','-std=c++17','-fobjc-arc','-dynamiclib','-undefined','dynamic_lookup','-framework','Cocoa','-framework','ApplicationServices','-Ivendor/node-api','-o',`native/cell-anchor-${arch}.node`],{stdio:'inherit'});
 execFileSync('/usr/bin/lipo',['-create','native/cell-anchor-arm64.node','native/cell-anchor-x86_64.node','-output','native/cell-anchor.node'],{stdio:'inherit'});
}
