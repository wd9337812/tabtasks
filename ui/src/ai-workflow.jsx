import React,{useEffect,useRef,useState} from 'react';
import {Button,dateToday} from './shared';
import {validateAiOps} from './ai';
import {readAiConfig,requestAiPermission,requestAi} from './ai-client';

export function AiWorkflow({ws,run,listId,selectedIds,onClose,onUpgrade}){
 const {t}=ws;
 const [scope,setScope]=useState(()=>selectedIds.length?selectedIds:ws.state.tasks.filter(x=>!x.done).slice(0,1).map(x=>x.id));
 const [config,setConfig]=useState(null),[input,setInput]=useState(''),[ops,setOps]=useState([]),[picked,setPicked]=useState([]),[working,setWorking]=useState(false),[status,setStatus]=useState(''),[failed,setFailed]=useState(false),[base,setBase]=useState([]),[promptName,setPromptName]=useState('');
 const controller=useRef(null);useEffect(()=>{readAiConfig().then(setConfig).catch(()=>{});return()=>controller.current?.abort()},[]);
 const reset=()=>{setOps([]);setPicked([]);setStatus('')};
 const send=async()=>{
  if(working||!input.trim())return;
  if(!scope.length)return ws.notify(t('aiAtLeastOne'));
  if(!ws.isPro&&scope.length>1)return onUpgrade('aiBatchPro');
  if(!config)return ws.notify(t('aiNoKey'));
  const permission=requestAiPermission(config);setWorking(true);reset();setFailed(false);setStatus(t('aiThinking'));
  try{
   if(!await permission)throw new Error('aiPermission');
   const fresh=await chrome.runtime.sendMessage({type:'TT_OP',op:'READ'});if(!fresh?.ok)throw new Error('saveFailed');
   if(fresh.state.plan!=='pro'&&scope.length>1)throw new Error('aiBatchPro');
   const tasks=scope.map(id=>fresh.state.tasks.find(x=>x.id===id));if(tasks.some(x=>!x))throw new Error('flowStale');
   const fields=tasks.map(({id,title,due,done,tags})=>({id,title,due,done,tags}));
   const system='Return only JSON {"ops": [...]}. Supported operations: add(title,due,tags,note), update(id,title,due,tags,note), done(id), del(id). Only make explicitly requested changes. Existing ids must be from the selected tasks. Never modify unselected tasks. Due dates: YYYY-MM-DD. Use the user language for new text. Today: '+dateToday()+'. Selected tasks: '+JSON.stringify(fields);
   controller.current=new AbortController();const text=await requestAi(config,system,input.trim(),{signal:controller.current.signal});
   const parsed=JSON.parse(text.replace(/^\s*`{3}(?:json)?\s*/i,'').replace(/\s*`{3}\s*$/,'').trim()),result=validateAiOps(Array.isArray(parsed)?parsed:parsed.ops,tasks);
   setBase(tasks);setOps(result);setPicked(result.map((_,index)=>index));setStatus(t('aiPending',{n:result.length}));
  }catch(error){setFailed(true);setStatus(t(error instanceof SyntaxError||error instanceof TypeError?'aiFailed':error.message))}
  finally{setWorking(false);controller.current=null}
 };
 const apply=async()=>{
  const selected=picked.map(index=>ops[index]);if(!selected.length)return;
  const expected=Object.fromEntries(base.map(task=>[task.id,JSON.stringify(task)]));
  const result=await run('AI_APPLY',{ops:selected,listId,scopeIds:scope,expected});if(result){reset();ws.notify(t('aiApplied'));onClose()}
 };
 return <><p className="settings-note">{t('aiChoose')}</p><div className="flow-card">{ws.state.tasks.map(task=><label className="flow-row" key={task.id}><input type="checkbox" disabled={working} checked={scope.includes(task.id)} onChange={()=>{setScope(ids=>ids.includes(task.id)?ids.filter(x=>x!==task.id):[...ids,task.id]);reset()}}/><span>{task.title}<small>{task.due||t('noDate')}</small></span></label>)}</div><p className="settings-note">{t('selectedTasks',{n:scope.length})}</p>
 <div className="flow-actions"><Button variant="outline" disabled={working} onClick={()=>{setInput(t('weeklyInstruction'));reset()}}>{t('weeklyPlan')}</Button><Button variant="outline" disabled={working} onClick={()=>{setInput(t('organizeInstruction'));reset()}}>{t('organizeTasks')}</Button></div>
 {(ws.state.flows?.prompts||[]).map(item=><div className="flow-actions" key={item.id}><Button variant="outline" disabled={working} onClick={()=>{setInput(item.text);reset()}}>{item.name}</Button><Button variant="ghost" disabled={working} onClick={()=>run('PROMPT_DELETE',{id:item.id})}>{t('delete')}</Button></div>)}
 <label className="form-label">{t('aiInstruction')}<textarea id="aiChat" rows={4} value={input} disabled={working} onChange={e=>{setInput(e.target.value);reset()}} placeholder={t('aiPlaceholder')}/></label><Button id="btnAiSend" className="primary-action" disabled={working||!input.trim()||!scope.length} onClick={send}>{t(working?'aiThinking':'aiPreview')}{scope.length>1&&!ws.isPro?' · Pro':''}</Button>
 <details className="flow-card"><summary>{t('savedPrompts')}</summary><label className="form-label">{t('name')}<input value={promptName} maxLength={80} onChange={e=>setPromptName(e.target.value)}/></label><Button variant="outline" disabled={!promptName.trim()||!input.trim()||ws.busy} onClick={async()=>{if(await run('PROMPT_SAVE',{name:promptName,text:input})){setPromptName('');ws.notify(t('saved'))}}}>{t('savePrompt')}</Button></details>
 {status&&<p id="aiStatus" role="status" className={'status-message '+(failed?'error':'')}>{status}</p>}
 {ops.length>0&&<div id="aiOps" className="ai-preview"><h3>{t('selectChanges')}</h3>{ops.map((op,index)=>{const original=base.find(task=>task.id===op.id),keys=Object.keys(op).filter(key=>!['op','id'].includes(key));return <label className="flow-step flow-row" key={index}><input type="checkbox" checked={picked.includes(index)} onChange={()=>setPicked(ids=>ids.includes(index)?ids.filter(x=>x!==index):[...ids,index])}/><span><b>{t(({add:'aiAdd',update:'aiUpdate',done:'aiDone',del:'aiDelete'})[op.op])} · {op.title||original?.title}</b><small>{t('before')}</small><span className="flow-comparison">{original?JSON.stringify(Object.fromEntries((keys.length?keys:['title','done']).map(key=>[key,original[key]])),null,2):'—'}</span><small>{t('after')}</small><span className="flow-comparison">{JSON.stringify(op,null,2)}</span></span></label>})}<Button id="btnAiApply" className="primary-action" disabled={ws.busy||working||!picked.length} onClick={apply}>{t('aiApply')} · {picked.length}</Button></div>}
 <p className="settings-note">{t('aiKeyNote')}</p></>;
}
