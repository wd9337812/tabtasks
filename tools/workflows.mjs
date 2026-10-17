import assert from 'node:assert/strict';
import vm from 'node:vm';
import {boot} from './test-harness.mjs';
const tests=[];const test=(name,fn)=>tests.push([name,fn]);
const item=(title='Step',extra={})=>({title,listId:'inbox',offsetDays:0,subtasks:[],...extra});
const task=(id,extra={})=>({id,title:id,listId:'inbox',tags:[],done:false,...extra});
const save=(env,items=[item()],extra={})=>env.request('TEMPLATE_SAVE',{name:'Release',items,...extra});

test('Free gets thirty active tasks, three custom lists and free tags/backup',async()=>{
 const e=await boot();for(let i=0;i<3;i++)assert((await e.request('LIST_ADD',{name:'List '+i})).ok);assert.equal((await e.request('LIST_ADD',{name:'Fourth'})).code,'limit');
 for(let i=0;i<30;i++)assert((await e.request('ADD',{title:'Task '+i})).ok);assert.equal((await e.request('ADD',{title:'31'})).code,'limit');
 const id=e.data.tasks[0].id;assert((await e.request('TAG_ADD',{id,tag:'Free'})).ok);assert((await e.request('TOGGLE',{id})).ok);assert((await e.request('ADD',{title:'Replacement'})).ok);assert.equal((await e.request('TOGGLE',{id})).code,'limit');
});
test('Legacy and oversized backups retain every record and workflow',async()=>{
 const e=await boot(),tasks=Array.from({length:35},(_,i)=>task('t'+i));const result=await e.request('IMPORT',{data:{tasks,lists:[],flows:{templates:[{id:'tpl',name:'Old template',items:[item()]}]}}});assert(result.ok);assert.equal(result.state.tasks.length,35);assert.equal(result.state.flows.templates.length,1);assert.equal((await e.request('ADD',{title:'Blocked'})).code,'limit');assert((await e.request('PATCH',{id:'t0',patch:{note:'Still editable'}})).ok);
});
test('Template preview handles month boundaries and leaves storage untouched',async()=>{
 const e=await boot(),saved=await save(e,[item('First',{offsetDays:1,subtasks:['Check']}),item('Second',{offsetDays:2})]);assert(saved.ok);const before=JSON.stringify(e.data);const preview=await e.request('TEMPLATE_PREVIEW',{id:saved.record.id,start:'2026-01-31'});assert(preview.ok);assert.equal(preview.tasks[0].due,'2026-02-01');assert.equal(preview.tasks[1].due,'2026-02-02');assert.equal(JSON.stringify(e.data),before);
 const run=await e.request('TEMPLATE_RUN',{id:saved.record.id,start:'2026-01-31',revision:preview.revision,indices:[0]});assert(run.ok);assert.equal(run.created,1);assert.equal(e.data.tasks[0].subtasks[0].title,'Check');assert.equal(e.data.tasks[0].due,'2026-02-01');
});
test('Second template requires Pro; cross-list and variable runs are gated after preview',async()=>{
 const e=await boot(),saved=await save(e,[item('{project}')]);assert.equal((await save(e)).code,'pro');let p=await e.request('TEMPLATE_PREVIEW',{id:saved.record.id,start:'2026-10-17',project:'Example'});assert.equal(p.tasks[0].title,'Example');assert.equal((await e.request('TEMPLATE_RUN',{id:saved.record.id,start:'2026-10-17',project:'Example',revision:p.revision})).code,'pro');await e.activate();assert((await save(e,[item('Third')])).ok);assert((await e.request('TEMPLATE_RUN',{id:saved.record.id,runs:[{start:'2026-10-17',project:'A'},{start:'2026-10-18',project:'B'}],revision:p.revision})).ok);assert.equal(e.data.tasks.length,2);
});
test('Template quota, missing lists and stale previews never partially create tasks',async()=>{
 const e=await boot({tasks:Array.from({length:29},(_,i)=>task('t'+i))}),saved=await save(e,[item('A'),item('B')]),p=await e.request('TEMPLATE_PREVIEW',{id:saved.record.id,start:'2026-10-17'});const before=JSON.stringify(e.data);assert.equal((await e.request('TEMPLATE_RUN',{id:saved.record.id,start:'2026-10-17',revision:p.revision})).code,'limit');assert.equal(JSON.stringify(e.data),before);
 await save(e,[item('Edited')],{id:saved.record.id});assert.equal((await e.request('TEMPLATE_RUN',{id:saved.record.id,start:'2026-10-17',revision:p.revision})).code,'stale');
 const list=await e.request('LIST_ADD',{name:'Temporary'});const listId=list.state.lists.at(-1).id;await save(e,[item('Orphan',{listId})],{id:saved.record.id});await e.request('LIST_DELETE',{id:listId});assert.equal((await e.request('TEMPLATE_PREVIEW',{id:saved.record.id,start:'2026-10-17'})).code,'missing');
});
test('Smart view limits exclude list quotas; Pro grouping and pins are enforced',async()=>{
 const e=await boot(),view=await e.request('VIEW_SAVE',{name:'This week',filters:{status:'active',due:'week',tag:'release',domain:'example.com'}});assert(view.ok);assert.equal((await e.request('VIEW_SAVE',{name:'Second'})).code,'pro');assert.equal((await e.request('VIEW_SAVE',{id:view.record.id,name:'Grouped',groupBy:'due'})).code,'pro');await e.activate();assert((await e.request('VIEW_SAVE',{id:view.record.id,name:'Grouped',groupBy:'due',pinned:true})).ok);assert.equal((await e.request('READ')).state.lists.length,2);
});
test('Single-task AI is free, selected scope and stale edits are enforced atomically',async()=>{
 const e=await boot({tasks:[task('one'),task('two')]}),r=await e.request('READ');const expected={one:JSON.stringify(r.state.tasks.find(x=>x.id==='one'))};
 assert((await e.request('AI_APPLY',{scopeIds:['one'],expected,ops:[{op:'update',id:'one',title:'Renamed'},{op:'add',title:'Child step'}]})).ok);
 assert.equal((await e.request('AI_APPLY',{scopeIds:['one','two'],ops:[{op:'done',id:'two'}]})).code,'pro');const before=JSON.stringify(e.data);assert.equal((await e.request('AI_APPLY',{scopeIds:['one'],ops:[{op:'add',title:'Should not remain'},{op:'done',id:'two'}]})).code,'invalid');assert.equal(JSON.stringify(e.data),before);
 assert.equal((await e.request('AI_APPLY',{scopeIds:['one'],expected,ops:[{op:'done',id:'one'}]})).code,'stale');
});
test('Saved prompts require Pro; deleting and reading existing data after downgrade stay available',async()=>{
 const e=await boot();assert.equal((await e.request('PROMPT_SAVE',{name:'Week',text:'Plan the week'})).code,'pro');await e.activate();const p=await e.request('PROMPT_SAVE',{name:'Week',text:'Plan the week'});assert(p.ok);await e.request('LICENSE_RELEASE');assert.equal((await e.request('READ')).state.flows.prompts.length,1);assert((await e.request('PROMPT_DELETE',{id:p.record.id})).ok);
});
test('Undo restores batch AI, deletion and consumed pending selections without losing captures',async()=>{
 const e=await boot({tasks:[task('one'),task('two')]});await e.request('BULK_PATCH',{ids:['one','two'],delete:true});assert((await e.request('READ')).state.undoAvailable);await e.request('UNDO');assert.equal(e.data.tasks.length,2);await e.request('AI_APPLY',{scopeIds:['one'],ops:[{op:'update',id:'one',title:'Changed'}]});await e.request('UNDO');assert.equal(e.data.tasks.find(x=>x.id==='one').title,'one');
 const full=await boot({tasks:Array.from({length:30},(_,i)=>task('f'+i)),pendingCaptures:[{title:'Queued',at:1}]});await full.request('DELETE',{id:'f0'});assert(full.data.tasks.some(x=>x.title==='Queued'));assert((await full.request('UNDO')).ok);assert.equal(full.data.tasks.length,30);assert(full.data.tasks.some(x=>x.id==='f0'));assert.equal(full.data.pendingCaptures.length,1);
});
test('Failed writes preserve tasks, workflows and undo; corrupt flows get a recovery backup',async()=>{
 const e=await boot({tasks:[task('one')],tt_flows:{templates:[{id:'broken'}]}});e.failNextSet=true;assert.equal((await e.request('DELETE',{id:'one'})).ok,false);assert.equal(e.data.tasks.length,1);assert((await e.request('DELETE',{id:'one'})).ok);assert(e.data.tt_flows_recovery_v1.tt_flows.templates.length);
});
test('Automatic language follows browser UI, falls back safely and preserves explicit choices',async()=>{
 const e=await boot();e.chrome.i18n={getUILanguage:()=> 'zh-TW'};let r=await e.request('READ');assert.equal(r.state.ui.langPref,'auto');assert.equal(r.state.ui.langResolved,'zh');e.chrome.i18n.getUILanguage=()=> 'de-DE';assert.equal((await e.request('READ')).state.ui.langResolved,'en');await e.request('UI_PREFS',{langPref:'zh',fontSize:'large'});assert.equal((await e.request('READ')).state.ui.langResolved,'zh');e.chrome.i18n.getUILanguage=()=>{throw new Error()};await e.request('UI_PREFS',{langPref:'auto'});assert.equal((await e.request('READ')).state.ui.langResolved,'en');assert.equal((await e.request('READ')).state.ui.fontSize,'large');
});
test('Invalid template and backup workflow records cannot overwrite user data',async()=>{
 const e=await boot();const before=JSON.stringify(e.data);for(const items of [[],[item('',{})],[item('Bad',{offsetDays:1.5})],[item('Bad',{url:'javascript:alert(1)'})]])assert.equal((await save(e,items)).ok,false);assert.equal((await e.request('IMPORT',{data:{tasks:[],lists:[],flows:{templates:[{id:'bad',name:'Bad',items:[]}]}}})).ok,false);assert.equal(JSON.stringify(e.data),before);
});
let failed=0;for(const[name,fn]of tests){try{await fn();console.log('PASS '+name)}catch(error){failed++;console.error('FAIL '+name+'\n'+error.stack)}}console.log('Task workflows: '+(tests.length-failed)+'/'+tests.length);process.exitCode=failed?1:0;
