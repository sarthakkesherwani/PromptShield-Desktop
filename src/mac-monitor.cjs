const {spawn}=require('node:child_process');
const {EventEmitter}=require('node:events');
// One bounded snapshot at a time. No shell, no sheet data in argv or stderr.
function createMacMonitor(script, options={}) {
 const launch=options.spawn||spawn, interval=options.interval||2000, timeout=options.timeout||120000;
 const label=options.sourceLabel==='Numbers'?'Numbers':'Excel';
 const monitor=new EventEmitter(); monitor.stdout=new EventEmitter();
 monitor.stdout.setEncoding=()=>{};
 let stopped=false,child,timer,deadline;
 function poll(){
  if(stopped)return;
  monitor.stdout.emit('data',JSON.stringify({status:'waiting',reason:`Reading the active ${label} sheet…`})+'\n');
  let buffer='',overflow=false;
  child=launch('/usr/bin/osascript',['-l','JavaScript',script],{stdio:['ignore','pipe','ignore']});
  child.stdout.setEncoding('utf8');
  deadline=setTimeout(()=>{child.kill();},timeout);
  child.stdout.on('data',chunk=>{if(stopped||overflow)return;buffer+=chunk;if(buffer.length>8000000){overflow=true;buffer='';child.kill();}});
  child.on('error',()=>{if(!stopped)monitor.emit('error',new Error('Mac spreadsheet adapter unavailable'));});
  child.on('close',code=>{
   clearTimeout(deadline);child=null;if(stopped)return;
   let snapshot;
   try{if(code!==0||overflow)throw Error();snapshot=JSON.parse(buffer);}
   catch{snapshot={status:'waiting',reason:`Could not read ${label}. Check Automation access and press Start to reconnect.`};}
   buffer='';monitor.stdout.emit('data',JSON.stringify(snapshot)+'\n');
   if(snapshot.status==='permission'){stopped=true;monitor.emit('exit');return;}
   timer=setTimeout(poll,interval);
  });
 }
 monitor.kill=()=>{stopped=true;clearTimeout(timer);clearTimeout(deadline);if(child)child.kill();};
 // Allow callers to install handlers before launching the first process.
 timer=setTimeout(poll,0);
 return monitor;
}
module.exports={createMacMonitor};
