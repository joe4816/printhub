import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {PRINTER_ROUTES} from '../shared/printer-catalog.js';
const worker = fs.readFileSync(new URL('../optional/chrome-extension/service-worker.js',import.meta.url),'utf8');
const routing = fs.readFileSync(new URL('../optional/chrome-extension/printer-routing.js',import.meta.url),'utf8');
const sandbox = {chrome:{runtime:{onMessage:{addListener(){}}},printing:{onJobStatusChanged:{addListener(){}}}},importScripts(){}};
vm.createContext(sandbox); vm.runInContext(routing+'\n'+worker,sandbox);
const routeValue = expression => JSON.parse(vm.runInContext('JSON.stringify('+expression+')',sandbox));
const caps = {media_size:{option:[{name:'NA_LETTER',width_microns:215900,height_microns:279400,is_default:true},{name:'NA_STATEMENT',vendor_id:'statement',width_microns:139700,height_microns:215900},{name:'ISO_B6',vendor_id:'B6',width_microns:125000,height_microns:176000},{name:'ISO_A6',vendor_id:'A6',width_microns:105000,height_microns:148000}]},page_orientation:{option:[{type:'PORTRAIT',is_default:true},{type:'LANDSCAPE'}]},duplex:{option:[{type:'LONG_EDGE',is_default:true},{type:'NO_DUPLEX'}]}};
sandbox.caps=caps;
test('all seven CUPS destinations agree across page and bridge',()=>{
 assert.deepEqual(routeValue('PRINTER_ROUTES'),PRINTER_ROUTES);
 assert.equal(PRINTER_ROUTES.length,7);
 assert.equal(PRINTER_ROUTES.filter(r=>r.mediaProfileId==='A6')[0].name,'Back Office');
});
test('exact printer resolution rejects missing and duplicate names',()=>{
 sandbox.printers=[{id:'a',name:'Receipt Printer 1'},{id:'b',name:'Main Office Copier'}];
 assert.equal(routeValue('resolveExactPrinter(printers,{name:"Main Office Copier"},"MAIN_COPIER")').id,'b');
 assert.throws(()=>vm.runInContext('resolveExactPrinter(printers,{name:"Back Office"},"BACK_OFFICE")',sandbox),/not found/);
 sandbox.printers.push({id:'c',name:'Main Office Copier'});
 assert.throws(()=>vm.runInContext('resolveExactPrinter(printers,{name:"Main Office Copier"},"MAIN_COPIER")',sandbox),/Ambiguous/);
});
test('Statement chooses correct media and forces landscape/simplex',()=>{
 const media=routeValue('chooseProfileMedia(caps,"STATEMENT",100000)');assert.equal(media.vendor_id,'statement');sandbox.media=media;
 const ticket=routeValue('buildProfileTicket(caps,media,true,"STATEMENT")');
 assert.equal(ticket.print.page_orientation.type,'LANDSCAPE');assert.equal(ticket.print.duplex.type,'NO_DUPLEX');assert.equal(ticket.print.vendor_ticket_item,undefined);
});
test('A6 uses matching ISO geometry and portrait',()=>{
 const media=routeValue('chooseProfileMedia(caps,"A6",100000)');assert.equal(media.vendor_id,'A6');assert.equal(media.width_microns,105000);sandbox.media=media;
 assert.equal(routeValue('buildProfileTicket(caps,media,true,"A6")').print.page_orientation.type,'PORTRAIT');
});
test('copier lacking selected paper never falls back to default Letter',()=>{
 sandbox.letterOnly={media_size:{option:[caps.media_size.option[0]]}};
 for(const profile of ['A6','B6','STATEMENT']) assert.throws(()=>vm.runInContext(`chooseProfileMedia(letterOnly,'${profile}',100000)`,sandbox),/not advertised/);
});
test('old bridge cannot claim copier jobs; readiness and catalog must match',()=>{
 assert.match(worker,/readyBindingKeys:.*auditPrinterRoutes/);
 assert.match(worker,/supportedMediaProfiles/);
});
test('source submissions reach seven distinct installed printers with correct tickets',async()=>{
 const submitted=[];const callbacks=[];const stored={};
 const printers=PRINTER_ROUTES.map(r=>({id:'cups-'+r.key,name:r.name,uri:'test://'+r.key}));
 const receiptCaps={...caps,media_size:{option:[{is_continuous_feed:true,width_microns:80000,min_height_microns:25400,max_height_microns:500000}]}};
 const context=vm.createContext({Blob,atob,TextEncoder,console,fetch:async(url,args)=>{callbacks.push(JSON.parse(args.body));return{ok:true,text:async()=>'{"ok":true}'};},chrome:{runtime:{onMessage:{addListener(){}}},storage:{managed:{get:async()=>({sourceConfigJson:JSON.stringify({endpointUrl:'https://script.google.com/macros/s/test/exec',endpointId:'PH-FRONT-RECEIPT-01',endpointKey:'x'.repeat(32),bindings:{RECEIPT1:{name:'Receipt Printer 1'}}})})},local:{get:async()=>stored,set:async row=>Object.assign(stored,row)}},printing:{onJobStatusChanged:{addListener(){}},getPrinters:async()=>printers,getPrinterInfo:async id=>({status:'AVAILABLE',capabilities:{printer:PRINTER_ROUTES.find(r=>'cups-'+r.key===id).mediaProfileId==='80MM_RECEIPT'?receiptCaps:caps}}),submitJob:async({job})=>{submitted.push(job);return{status:'OK',jobId:'job-'+submitted.length}}}},importScripts(){}});
 vm.runInContext(routing+'\n'+worker,context);
 for(const route of PRINTER_ROUTES){context.payload={job:{printJobId:'PJ-'+route.key,endpointId:'PH-FRONT-RECEIPT-01',bindingKey:route.key,mediaProfileId:route.key==='BACK_OFFICE'?'B6':route.mediaProfileId,claim:{claimId:'CLM-test'}},pdfBase64:'JVBERi0xLjQ=',heightMicrons:139700,trim:route.mediaProfileId==='80MM_RECEIPT',rendererVersion:'test'};await vm.runInContext('submitSourceJob(payload)',context);}
 assert.deepEqual(submitted.map(j=>j.printerId),printers.map(p=>p.id));
 assert.equal(submitted[0].ticket.print.media_size.vendor_id,'statement');
 assert.equal(submitted[2].ticket.print.media_size.vendor_id,'A6');
 assert.equal(callbacks.filter(c=>c.action==='endpoint.complete').length,7);
 await vm.runInContext('pollSource({maxJobs:1})',context);
 assert.deepEqual(callbacks.at(-1).readyBindingKeys,['AP_TARDY','CAFE_TARDY','RECEIPT1','RECEIPT2']);
 await vm.runInContext("pollSource({maxJobs:1,supportedMediaProfiles:['80MM_RECEIPT','STATEMENT','A6','B6']})",context);
 assert.deepEqual(callbacks.at(-1).readyBindingKeys,PRINTER_ROUTES.map(r=>r.key));
});

test('A6 rejects B6 and mislabeled media, accepts custom matching geometry',()=>{
 sandbox.badCaps={media_size:{option:[{name:'A6',width_microns:125000,height_microns:176000},caps.media_size.option[2]]}};
 assert.throws(()=>vm.runInContext('chooseProfileMedia(badCaps,"A6",148000)',sandbox),/not advertised/);
 sandbox.customCaps={media_size:{option:[{name:'CUSTOM',vendor_id:'custom-a6',width_microns:105000,height_microns:148000}]}};
 assert.equal(routeValue('chooseProfileMedia(customCaps,"A6",148000)').vendor_id,'custom-a6');
 assert.equal(routeValue('chooseProfileMedia(caps,"B6",148000)').vendor_id,'A6');
});

