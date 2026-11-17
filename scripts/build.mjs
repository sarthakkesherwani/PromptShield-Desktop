import {build} from 'esbuild';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
await build({entryPoints:['detector/engine.ts'],outfile:'detector-bundle.cjs',bundle:true,platform:'node',format:'cjs',target:'node22'});
if(process.platform==='darwin'){
 fs.mkdirSync('native/module-cache',{recursive:true});
 for(const arch of ['arm64','x86_64'])execFileSync('/usr/bin/xcrun',['swiftc','src/cell-anchor.swift','-O','-target',`${arch}-apple-macos11.0`,'-module-cache-path','native/module-cache','-o',`native/cell-anchor-${arch}`],{stdio:'inherit'});
 execFileSync('/usr/bin/lipo',['-create','native/cell-anchor-arm64','native/cell-anchor-x86_64','-output','native/cell-anchor'],{stdio:'inherit'});
}
