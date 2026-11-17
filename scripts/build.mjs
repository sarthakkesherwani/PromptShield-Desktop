import {build} from 'esbuild';
await build({entryPoints:['detector/engine.ts'],outfile:'detector-bundle.cjs',bundle:true,platform:'node',format:'cjs',target:'node22'});
