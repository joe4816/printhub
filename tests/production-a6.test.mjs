import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const code=fs.readFileSync(new URL('../production.js',import.meta.url),'utf8');
for(const version of ['0.6.0','0.6.1'])test('production polling gates A6 correctly on bridge '+version,async()=>{
 const timers=new Map(),requests=[];let next=0,loaded,onMessage;
 const window={location:{origin:'https://joe4816.github.io'},addEventListener(type,fn){onMessage=fn;},postMessage(msg){
  requests.push(msg);
  const value=msg.action==='PING'?{version}:msg.action==='SOURCE_STATUS'?{configured:true,enabled:true}:{jobs:[]};
  onMessage({source:window,origin:window.location.origin,data:{channel:msg.channel,source:'PRINTHUB_EXTENSION',type:'response',id:msg.id,ok:true,value}});
 }};
 const context=vm.createContext({window,document:{addEventListener(type,fn){loaded=fn;},getElementById(){return null;}},setTimeout(fn,delay){const id=++next;timers.set(id,{fn,delay});return id;},clearTimeout(id){timers.delete(id);}});
 vm.runInContext(code,context);loaded();
 await [...timers.values()].find(t=>t.delay===1200).fn();
 await [...timers.values()].find(t=>t.delay===500).fn();
 const profiles=requests.find(r=>r.action==='POLL_SOURCE').payload.supportedMediaProfiles;
 assert.deepEqual(Array.from(profiles),version==='0.6.1'?['80MM_RECEIPT','STATEMENT','A6','B6']:['80MM_RECEIPT','STATEMENT']);
});
