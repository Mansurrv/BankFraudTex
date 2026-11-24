import {useText} from './i18n/text'
import {ledgerText} from './i18n/ledger'
import {useMutation, useQuery} from '@tanstack/react-query'
import {ArrowDownLeft, ArrowRight, ArrowUpRight, Bot, ChevronRight, CircleHelp, FileText, GitBranch, ListTree, Network, Play, Plus, Send, Sparkles, Waypoints, X} from 'lucide-react'
import {useEffect, useRef, useState} from 'react'
import {api, date, duration, money, num, url, utc} from './api'
import {AnswerCard, Empty, ErrorNote, EvidenceList, PatternRow, RuleChecks, SelectedStep, Status} from './components'
import {useOrbit} from './state'
import {HelpHint} from './guide/Guide'
import {helpAttrs} from './guide/content'
import type {Answer, EntityDetail, Finding, Relationship, Simulation, Story, Transaction} from './types'

const prompts=['What is happening in this network?','Where did the money go?','Why is this account high risk?','What changed in the last 24 hours?','Find circular transactions','Which account is most important?'] as const

export function Investigator({finding,full=false,auto=false}:{finding?:Finding;full?:boolean;auto?:boolean}) {
  const {t,display}=useText()
  const {selected,patch}=useOrbit()
  const [question,setQuestion]=useState('')
  const [messages,setMessages]=useState<{question:string;query:string;answer:Answer}[]>([])
  const ask=useMutation({
    mutationFn:(input:{ask:string;shown:string})=>api<Answer>('investigate',{question:input.ask,focus:selected,finding:finding?.id??''}),
    onSuccess:(answer,input)=>{setMessages(old=>[...old,{answer,question:input.shown,query:input.ask}]);setQuestion('')}
  })
  const started=useRef(false)
  useEffect(()=>{if(auto&&!started.current){started.current=true;ask.mutate({ask:prompts[0],shown:t(prompts[0])})}},[auto])
  const submit=(q:string,shown=q)=>{if(q.trim()&&!ask.isPending)ask.mutate({ask:q.trim(),shown:shown.trim()})}
  return <div className={'investigator '+(full?'full':'')}>
    <div className="investigator-scope"><Bot size={20}/><span><b>{finding?display(finding.title):t('Network inquiry')}</b><small>{selected||t('Network-wide')} · {t('Ledger-backed responses')}</small></span></div>
    <div className="prompt-list" data-guide-target="ask">{prompts.slice(0,full?prompts.length:3).map(q=><button key={q} {...helpAttrs('ask')} onClick={()=>submit(q,t(q))} disabled={ask.isPending}>{t(q)}<ArrowUpRight size={13}/></button>)}</div>
    {messages.map((m,i)=><div className="conversation-turn" key={i}><div className="question-bubble">{m.question}</div><AnswerCard answer={m.answer}/>
      {finding&&m.answer.id&&<button className="text-link save-finding-link" {...helpAttrs('saveAnswer')} onClick={()=>{sessionStorage.setItem('orbit-report-question',m.query);if(m.answer.id)sessionStorage.setItem('orbit-report-answer',m.answer.id);patch({view:'workspace'})}}><FileText size={14}/> {t("Save response to a case")}</button>}
    </div>)}
    {ask.isPending&&<p className="muted" role="status">{t("Querying the ledger…")}</p>}
    <ErrorNote error={ask.error}/>
    <form className="question-form" onSubmit={e=>{e.preventDefault();submit(question)}}>
      <input {...helpAttrs('ask')} value={question} onChange={e=>setQuestion(e.target.value)} aria-label={t("Question for investigator")} maxLength={600} placeholder={t("Ask about this network…")}/>
      <button className="primary icon-button" {...helpAttrs('ask')} disabled={!question.trim()||ask.isPending} aria-label={t("Send question")}><Send size={16}/></button>
    </form>
  </div>
}

export function StoryContent({story,detailed=false}:{story?:Story;detailed?:boolean}) {
  const {t,display,language}=useText()
  const {step,playing,patch}=useOrbit()
  if(!story)return <Empty>{t("Choose a finding to load a money flow story.")}</Empty>
  return <div className="story-content">
    {detailed&&<p>{ledgerText(language,story.summary)}</p>}
    {step>=0&&story.steps[step]&&<SelectedStep step={story.steps[step]} index={step} onClose={()=>patch({step:-1,playing:false,panel:'finding'})}/>}
    <div className="section-top story-section-header"><h3>{t("Transaction sequence")} <HelpHint feature="flow"/></h3><button className="small-button" {...helpAttrs('story')} onClick={()=>patch({playing:!playing,step:playing?step:0,view:'stories',panel:'story',after:'',before:''})}>{playing?t('Pause'):<><Play size={13}/> {t("Play sequence")}</>}</button></div>
    <div className="step-list">{story.steps.map((tx,index)=><button className={step===index?'current':''} key={tx.id} {...helpAttrs('transfer')} onClick={()=>patch({step:index,playing:false,after:'',before:'',panel:'story'})}>
      <span className="step-index">{String(index+1).padStart(2,'0')}</span>
      <span className="step-info"><b>{display(tx.stage)}</b><small>{t('{from} to {to}',{from:tx.sender,to:tx.receiver})}</small>{detailed&&<small>{tx.id} · {utc(tx.time)} UTC · {tx.elapsed?t('{duration} since prior transfer',{duration:duration(tx.elapsed)}):t('Opening entry')}</small>}</span>
      <span className="step-amount">{money(tx.amount,tx.currency)}<small>{utc(tx.time)}</small></span>
    </button>)}</div>
  </div>
}

const scenarioActions=[['remove-account','Remove account'],['disconnect-account','Disconnect account'],['remove-transaction','Exclude transfer']]
export function SimulationForm({finding,names,expanded=false}:{finding?:Finding;names:Map<string,string>;expanded?:boolean}) {
  const {t,display}=useText()
  const {sim,simActive,patch}=useOrbit()
  const [action,setAction]=useState('remove-account')
  const [target,setTarget]=useState('')
  const [request,setRequest]=useState<{action:string;target:string}|null>(null)
  const run=useMutation({mutationFn:(input:{action:string;target:string})=>api<Simulation>('simulation',{...input,finding:finding?.id}),onSuccess:(result,input)=>{setRequest(input);patch({sim:result,simActive:true,playing:false,step:-1,after:'',before:''})}})
  if(!finding)return <Empty>{t("Choose a finding to compare its confirmed network with a temporary scenario.")}</Empty>
  const targets=action==='remove-transaction'?finding.transactions:finding.entities
  const value=targets.includes(target)?target:targets[0]
  return <div className="simulation-form">
    <p className="muted">{t("Changes apply to a temporary copy of the selected finding. The source ledger stays intact.")}</p>
    <form onSubmit={e=>{e.preventDefault();if(value)run.mutate({action,target:value})}}>
      <label>{t("Scenario")}<select {...helpAttrs('scenarioAction')} value={action} onChange={e=>{setAction(e.target.value);setTarget('')}}>{scenarioActions.map(([key,label])=><option key={key} value={key}>{display(label)}</option>)}</select></label>
      <label>{t("Target")}<select {...helpAttrs('scenarioAction')} value={value??''} onChange={e=>setTarget(e.target.value)}>{targets.map(id=><option key={id} value={id}>{names.get(id)??id}</option>)}</select></label>
      <button className="primary" {...helpAttrs('run','scenario-run')} disabled={!value||run.isPending}><GitBranch size={16}/>{t(run.isPending?'Calculating…':'Run scenario')}</button>
    </form>
    <ErrorNote error={run.error}/>
    {sim&&<div className="scenario-results">
      <div className="section-top"><h3>{t("Network comparison")} <HelpHint feature="compare"/></h3><Status kind="warm">{t("Hypothetical")}</Status></div>
      <div className="segmented"><button {...helpAttrs('compare')} className={!simActive?'current':''} onClick={()=>patch({simActive:false})}>{t("Original")}</button><button {...helpAttrs('compare')} className={simActive?'current':''} onClick={()=>patch({simActive:true})}>{t("Scenario")}</button></div>
      <dl className="comparison">
        {[['Entities',sim.before.nodes,sim.after.nodes],['Transfers',sim.before.transactions,sim.after.transactions],['Connected groups',sim.before.components,sim.after.components],['Gross USD equivalent',money(sim.before.usd),money(sim.after.usd)]].map(([label,b,a])=><div key={label}><dt>{display(String(label))}</dt><dd>{b} <ArrowRight size={13}/> <b>{a}</b></dd></div>)}
      </dl>
      {(expanded||sim.removed.length>0)&&<details><summary>{t('{count} excluded transfer references',{count:num(sim.removed.length)})}</summary><p className="record-id">{sim.removed.join(', ')||t('None')}</p></details>}
      <details><summary>{t(sim.alternative.length?'Observed alternative route':'Alternative route')}</summary>{sim.alternative.length?<p>{sim.alternative.map(t=>t.id+' · '+t.receiver).join(' → ')}</p>:<p>{t("No time-ordered route between the original endpoints remains in this finding.")}</p>}</details>
      {sim.critical.length>0&&<details><summary>{t("Critical accounts")}</summary><EvidenceList entries={sim.critical}/></details>}
      {request&&<button className="text-link" {...helpAttrs('saveScenario')} onClick={()=>{sessionStorage.setItem('orbit-report-scenario',JSON.stringify(request));patch({view:'workspace'})}}><FileText size={14}/> {t("Save scenario to a case")}</button>}
      <button className="small-button" {...helpAttrs('compare')} onClick={()=>patch({sim:null,simActive:false})}>{t("Clear scenario")}</button>
    </div>}
  </div>
}

export function Brief({finding,findings,onCase}:{finding?:Finding;findings:Finding[];onCase:()=>void}) {
  const {t,display,language}=useText()
  const {showFinding,patch}=useOrbit()
  if(!finding)return <div className="brief"><h3>{t("Findings to review")}</h3><p>{t("Select a detected pattern to see the supporting transactions and start a guided review.")}</p>{findings.slice(0,8).map(f=><PatternRow key={f.id} finding={f} action={()=>showFinding(f.id,f.subject)}/>)}<button className="text-link all-findings-link" onClick={()=>patch({view:'radar',playing:false})}>{t("View all {count} flagged patterns",{count:num(findings.length)})}</button></div>
  const start=new Date(finding.start).getTime(),end=new Date(finding.end).getTime()
  const minutes=Math.ceil((end-start)/60000)
  return <div className="brief">
    <div className="brief-topic">
      <span className="signal-icon"><GitBranch size={22}/></span><Status kind="warm"><span className="status-dot"/> {t(finding.score>=85?'High priority':'Review suggested')}</Status>
    </div>
    <h2>{display(finding.title)}</h2>
    <p>{ledgerText(language,finding.summary)}</p>
    <div className="risk-box" {...helpAttrs('riskScore')}>
      <div><span>{t("Anomaly score")} <HelpHint feature="risk"/></span><strong>{finding.score}<small> / 100</small></strong></div>
      <div className="risk-bar" role="meter" aria-label={t("Anomaly score")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={finding.score}><i style={{width:finding.score+'%'}}/></div>
      <small>{t("Algorithmic finding · Human review required")}</small>
    </div>
    <dl className="brief-evidence">
      <div><dt>{t("Entities involved")}</dt><dd>{finding.entities.length}</dd></div>
      <div><dt>{t("Linked transfers")}</dt><dd>{finding.transactions.length}</dd></div>
      <div {...helpAttrs('volume')}><dt>{t("Gross flow")} <span>{t("USD eq.")}</span></dt><dd>{money(finding.usd)}</dd></div>
      <div><dt>{t("Observed window")}</dt><dd>{minutes?t('{count} min',{count:minutes}):t('Same timestamp')}</dd></div>
    </dl>
    <div className="brief-actions">
      <button className="primary explain" {...helpAttrs('explain')} onClick={()=>patch({panel:'ai'})}><Sparkles size={17}/> {t("Explain this network")}<ChevronRight size={16}/></button>
      <div className="paired-buttons"><button className="secondary" {...helpAttrs('story')} onClick={()=>patch({panel:'story',step:0,playing:true,after:'',before:''})}><Play size={14}/> {t("Play flow")}</button><button className="secondary" {...helpAttrs('caseCreate')} onClick={onCase}><Plus size={15}/> {t("Create case")}</button></div>
    </div>
    <details className="brief-details finding-verification"><summary {...helpAttrs('riskScore')}>{t("Why this was flagged")}</summary>
      {!!finding.checks?.length&&<>
        <h3>{t("Rule verification")}</h3>
        <RuleChecks checks={finding.checks} evidence={finding.evidence}/>
      </>}
      <ul>{finding.reasons.map(reason=><li key={reason}>{ledgerText(language,reason)}</li>)}</ul>
      <p>{t("The records support analyst review. Establishing intent or the origin of funds requires separate evidence.")}</p>
    </details>
    <details className="brief-details"><summary {...helpAttrs('evidence')}>{t("Verified ledger evidence")}</summary><EvidenceList entries={finding.evidence}/></details>
  </div>
}

function EntityPanel({id}:{id:string}) {
  const {t,display}=useText()
  const {patch,expands,hidden,inspect,showFinding}=useOrbit()
  const details=useQuery({queryKey:['entity',id],queryFn:()=>api<EntityDetail>('entities/'+id),enabled:!!id})
  const links=useQuery({queryKey:['relationships',id],queryFn:()=>api<Relationship[]>(url('relationships',{entity:id})),
    enabled:details.data?.entity.kind==='account'})
  const parties=links.data?.filter(relation=>relation.status==='verified'&&relation.signals.some(signal=>
    signal.status==='verified'&&/^registered (signatory|organization)/i.test(signal.label)))??[]
  if(!details.data)return <><ErrorNote error={details.error}/>{details.isLoading&&<Empty>{t("Loading entity…")}</Empty>}</>
  const {entity:n,inflow,outflow,count,counterparties,findings,transactions}=details.data
  return <div className="entity-panel" data-guide-target="account">
    <Status kind="verified"><Network size={13}/> {t("Verified ledger entity")}</Status><h2>{n.name}</h2>
    <p>{n.id} · {display(n.kind)} · {display(n.location)}</p>
    {n.masked&&<p className="record-id">{n.masked}</p>}
    {parties.length>0&&<div className="account-registrations"><strong>{t("Registered parties")}</strong><HelpHint feature="account"/>
      <div>{parties.map(party=><button key={party.entity} {...helpAttrs('relationships')} onClick={()=>inspect(party.entity)}>{party.name}</button>)}</div>
    </div>}
    <dl className="brief-evidence">
      <div><dt>{t("Inbound")}</dt><dd>{money(inflow)}</dd></div><div><dt>{t("Outbound")}</dt><dd>{money(outflow)}</dd></div>
      <div><dt>{t("Transactions")}</dt><dd>{num(count)}</dd></div><div><dt>{t("Counterparties")}</dt><dd>{num(counterparties)}</dd></div>
    </dl>
    <div className="paired-buttons">
      <button className="secondary" {...helpAttrs('expand')} onClick={()=>patch({expands:Array.from(new Set([...expands,id])),hidden:hidden.filter(n=>n!==id)})}><Plus size={14}/> {t("Expand links")}</button>
      <button className="secondary" {...helpAttrs('collapse')} onClick={()=>patch({expands:expands.filter(n=>n!==id),hidden:expands.includes(id)?hidden:Array.from(new Set([...hidden,id])),panel:expands.includes(id)?'entity':'finding',selected:expands.includes(id)?id:''})}><ListTree size={14}/> {t("Collapse")}</button>
    </div>
    <button className="text-link" {...helpAttrs('focus')} onClick={()=>inspect(id)}>{t("Focus camera")}</button>
    {findings.length>0&&<><h3>{t("Connected findings")}</h3>{findings.slice(0,4).map(f=><PatternRow key={f.id} finding={f} action={()=>showFinding(f.id,f.subject)}/>)}</>}
    {transactions.length>0&&<div className="entity-transactions"><h3>{t("Latest transfers")}</h3>{transactions.slice(0,7).map(tx=><button key={tx.id} className="transfer-party" {...helpAttrs('transfer')} onClick={()=>patch({panel:'transaction',tx:tx.id})}>{tx.from===id?<ArrowUpRight size={16}/>:<ArrowDownLeft size={16}/>}<span>{tx.id}<small>{date(tx.time)} · {display(tx.kind)}</small></span><b>{money(tx.amount,tx.currency)}</b></button>)}</div>}
  </div>
}

function TxPanel({id,names}:{id:string;names:Map<string,string>}) {
  const {t,display}=useText()
  const {inspect}=useOrbit()
  const result=useQuery({queryKey:['tx',id],queryFn:()=>api<Transaction>(id==='.'||id==='..'?url('transactions',{reference:id}):'transactions/'+encodeURIComponent(id)),enabled:!!id})
  const transaction=result.data
  if(!transaction)return <><ErrorNote error={result.error}/>{result.isLoading&&<Empty>{t("Loading transfer…")}</Empty>}</>
  return <div className="entity-panel" data-guide-target="transaction"><Status kind="verified">{t("Verified ledger transfer")}</Status><h2>{money(transaction.amount,transaction.currency)}</h2><p>{transaction.id} · {date(transaction.time,true)} · {utc(transaction.time)} UTC</p>
    <button className="transfer-party" {...helpAttrs('transfer')} onClick={()=>inspect(transaction.from)}><ArrowUpRight size={17}/><span><small>{t("Sender")}</small>{names.get(transaction.from)||transaction.from}</span></button>
    <button className="transfer-party" {...helpAttrs('transfer')} onClick={()=>inspect(transaction.to)}><ArrowDownLeft size={17}/><span><small>{t("Receiver")}</small>{names.get(transaction.to)||transaction.to}</span></button>
    <dl className="brief-evidence"><div><dt>{t("Type")}</dt><dd>{display(transaction.kind)}</dd></div><div><dt>{t("USD equivalent")}</dt><dd>{money(transaction.usd)}</dd></div></dl>
  </div>
}

export function ContextPanel({finding,findings,story,names,onCase}:{finding?:Finding;findings:Finding[];story?:Story;names:Map<string,string>;onCase:()=>void}) {
  const {t,display}=useText()
  const {panel,patch,selected,tx}=useOrbit()
  const labels={finding:'Investigation brief',entity:'Entity intelligence',story:'Money flow story',ai:'AI Investigator',simulation:'Simulation Lab',transaction:'Transaction detail'}
  const help={finding:'patterns',entity:'account',story:'flow',ai:'investigator',simulation:'simulation',transaction:'transfer'} as const
  const Icon=panel==='ai'?Sparkles:panel==='story'?Play:panel==='entity'?Network:panel==='transaction'?Waypoints:panel==='simulation'?GitBranch:CircleHelp
  return <aside className="context-panel" aria-label={display(labels[panel])}>
    <div className="context-heading"><span><Icon size={17}/><b>{display(labels[panel])}</b><HelpHint feature={help[panel]}/></span>{panel==='finding'?null:<button className="icon-button" aria-label={t("Return to investigation brief")} onClick={()=>patch({panel:'finding',playing:false})}><X size={17}/></button>}</div>
    <div className="context-content" key={panel}>
      {panel==='finding'&&<Brief finding={finding} findings={findings} onCase={onCase}/>}
      {panel==='ai'&&<Investigator key={finding?.id??'global'} finding={finding} auto/>}
      {panel==='story'&&<StoryContent story={story}/>}
      {panel==='simulation'&&<SimulationForm finding={finding} names={names}/>}
      {panel==='entity'&&<EntityPanel id={selected}/>}
      {panel==='transaction'&&<TxPanel id={tx} names={names}/>}
    </div>
  </aside>
}

