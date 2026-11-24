import {useText} from './i18n/text'
import {ledgerText} from './i18n/ledger'
import {LanguageSelect} from './i18n/LanguageSelect'
import {keepPreviousData, useMutation, useQuery, useQueryClient} from '@tanstack/react-query'
import {Activity, ArrowDownToLine, ArrowRight, Database, FileJson, FileText, Fingerprint, GitBranch, Layers3, Plus, ShieldCheck, Upload} from 'lucide-react'
import {type FormEvent,useState} from 'react'
import {Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis} from 'recharts'
import {api, date, decimal, money, num, url, utc} from './api'
import {AnswerCard, Empty, ErrorNote, EvidenceList, Heading, Metrics, PatternRow, Stat, Status} from './components'
import {GraphList} from './Scene'
import {useOrbit} from './state'
import {GuideSettings, HelpHint} from './guide/Guide'
import {helpAttrs} from './guide/content'
import type {AccountDirectoryEntry, Bootstrap, CaseList, CaseRecord, Community, EntityDetail, Finding, Relationship, Similarity, Summary, Temporal, Transaction, User} from './types'

type RegistrationStatus={enabled:boolean;localInbox:boolean;closed?:boolean}
const readRegistration=()=>api<RegistrationStatus>('registration')

function useSubject(finding?:Finding) {const selected=useOrbit(s=>s.selected);return selected||finding?.subject||''}

export function Overview({summary,user,openFinding,onFindings}:{summary:Summary;user:User;openFinding:(f:Finding)=>void;onFindings:()=>void}) {
  const {t,language}=useText()
  const {inspect,patch}=useOrbit()
  const clusters=useQuery({queryKey:['communities'],queryFn:()=>api<Community[]>('communities')})
  const temporal=useQuery({queryKey:['temporal','network'],queryFn:()=>api<Temporal>('temporal')})
  const cases=useQuery({queryKey:['cases',user.name],queryFn:()=>api<CaseList[]>('cases')})
  const priority=summary.findings.filter(f=>f.score>=85).length
  const openCases=cases.data?.filter(item=>item.status==='Open'||item.status==='In review').length

  return <>
    <Heading title={t("Overview")} help="dashboard" description={t("Review recent activity, detected communities, and open investigation leads.")}/>
    <div data-guide-target="overview-metrics">
      <Metrics summary={summary} onFindings={onFindings}/>
      <div className="dashboard-review-metrics">
        <Stat help="casesCount" label={t("Active investigations")} value={openCases==null?'—':num(openCases)} note={t("Open or in review")}/>
        <Stat help="distribution" label={t("Review priority")} value={t('{high} high · {other} other',{high:num(priority),other:num(summary.findings.length-priority)})} note={t("Counts of flagged findings")}/>
      </div>
    </div>
    <div className="view-grid">
      <section className="surface chart-surface"><div className="section-top"><h2>{t("Network activity")}</h2><Status kind="verified">{t("Daily transfers")}</Status></div>
        <div className="trend-chart"><ResponsiveContainer width="100%" height={235}><AreaChart data={summary.buckets} margin={{left:-20,right:14,top:12,bottom:0}}>
          <defs><linearGradient id="activity-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="var(--accent)" stopOpacity={.18}/><stop offset="100%" stopColor="var(--accent)" stopOpacity={.015}/></linearGradient></defs>
          <CartesianGrid stroke="var(--glass-divider)" vertical={false}/><XAxis dataKey="date" tickFormatter={v=>date(v)} fontSize={12} minTickGap={26} stroke="var(--muted)" tickLine={false} axisLine={false}/><YAxis fontSize={12} stroke="var(--muted)" tickLine={false} axisLine={false}/>
          <Tooltip labelFormatter={v=>date(String(v),true)} contentStyle={{background:'var(--glass-overlay)',border:'1px solid var(--glass-edge)',borderRadius:8,boxShadow:'var(--glass-shadow)'}}/>
          <Area type="monotone" dataKey="count" stroke="var(--accent)" fill="url(#activity-fill)" strokeWidth={2} name={t("Transfers")}/>
        </AreaChart></ResponsiveContainer></div>
        {temporal.data&&<div className="forecast"><Activity size={18}/><span><b>{t('Next-day estimate · {count} transfers',{count:num(temporal.data.forecast.nextDay)})}</b><small>{t('Estimated range {low}–{high}',{low:num(temporal.data.forecast.low),high:num(temporal.data.forecast.high)})} · {ledgerText(language,temporal.data.forecast.method)}</small></span></div>}
      </section>
      <section className="surface" data-guide-target="priority-review"><h2>{t("Priority review")} <HelpHint feature="patterns"/></h2>{summary.findings.slice(0,6).map(f=><PatternRow finding={f} key={f.id} action={()=>openFinding(f)}/>)}
        <button className="text-link all-findings-link" onClick={onFindings}>{t("View all {count} flagged patterns",{count:num(summary.findings.length)})}<ArrowRight size={15}/></button>
      </section>
      <section className="surface"><h2>{t("Discovered communities")}</h2><p className="muted">{t("Groups are inferred from repeated transfers. Open a representative account to compare groups in the universe.")}</p>
        <ErrorNote error={clusters.error}/>
        {clusters.data?.map(c=><button className="pattern-row" key={c.representative} {...helpAttrs('community')} onClick={()=>{inspect(c.representative);patch({view:'universe',finding:'',community:''})}}><Layers3 size={18}/><span className="pattern-info"><b>{ledgerText(language,c.name)}</b><small>{t('{count} internal transfers',{count:num(c.internal)})}</small></span><Status>{t('{count} accounts',{count:num(c.size)})}</Status></button>)}
      </section>
      <TemporalComparison/>
    </div>
  </>
}

export function TemporalComparison({subject}:{subject?:string}) {
  const {t}=useText()
  const before=useOrbit(s=>s.before)
  const result=useQuery({queryKey:['temporal',subject,before],queryFn:()=>api<Temporal>(url('temporal',{entity:subject,before})),placeholderData:keepPreviousData})
  return <section className="surface">
    <div className="section-top"><h2>{t("24-hour comparison")}</h2><Status>UTC</Status></div>
    <ErrorNote error={result.error}/>
    {result.data&&<>
      <div className="period-grid">
        {([['Previous',result.data.before],['Current',result.data.after]] as const).map(([label,value])=><div key={String(label)}><span>{t(label)} · {date(value.end)}</span><strong>{t('{count} transfers',{count:num(value.count)})}</strong><small>{t('{amount} gross USD eq.',{amount:money(value.usd)})}</small><small>{t('{count} counterparties',{count:num(value.counterparties)})}</small></div>)}
      </div>
      <p className="muted">{result.data.before.count?t('{change}% transfer count over the previous period.',{change:(result.data.change>0?'+':'')+decimal(Math.round(result.data.change*10)/10)}):t('The previous period recorded zero transfers.')}</p>
    </>}
  </section>
}

export function Radar({summary,openFinding}:{summary:Summary;openFinding:(f:Finding)=>void}) {
  const {t,display}=useText()
  const [filter,setFilter]=useState('all')
  const kinds=new Map(summary.findings.map(f=>[f.kind,f.title]))
  if(!kinds.has('mule'))kinds.set('mule','Money Mule / Dropper Networks')
  const filtered=summary.findings.filter(f=>filter==='all'||f.kind===filter)
  return <><Heading title={t("Anomaly Radar")} help="patterns" description={t("Inspect rule, statistical, and network findings with linked ledger evidence.")} actions={<Status kind="algorithmic">{display(summary.model)}</Status>}/>
    <section className="surface" data-guide-target="radar"><div className="section-top"><h2>{t('{count} findings',{count:num(filtered.length)})}</h2><select {...helpAttrs('anomalyFilter')} aria-label={t("Filter anomaly type")} value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">{t("All finding types")}</option>{Array.from(kinds,([k,title])=><option key={k} value={k}>{display(title)}</option>)}</select></div>
      {filtered.map(f=><PatternRow key={f.id} finding={f} action={()=>openFinding(f)}/>)}
      {!filtered.length&&<Empty>{t("No findings match this type.")}</Empty>}
    </section>
  </>
}

export function Behavior({finding}:{finding?:Finding}) {
  const {t,display}=useText()
  const id=useSubject(finding)
  const {inspect,patch}=useOrbit()
  const account=useQuery({queryKey:['entity',id],queryFn:()=>api<EntityDetail>('entities/'+id),enabled:!!id})
  const matches=useQuery({queryKey:['similarity',id],queryFn:()=>api<Similarity[]>(url('similarity',{entity:id})),enabled:!!id})
  return <><Heading title={t("Behavior Intelligence")} help="behavior" description={t("Compare account fingerprints by timing, values, counterparties, and transfer routes.")}/>
    <div className="view-grid"><section className="surface"><h2>{account.data?.entity.name??t('Account fingerprint')}</h2><ErrorNote error={account.error}/>
      {account.data?.fingerprint?<dl className="feature-grid">{Object.entries(account.data.fingerprint.features).map(([label,value])=><div key={label}><dt>{display(label)}</dt><dd>{decimal(value)}</dd></div>)}</dl>:<Empty>{t("Search for an account to inspect its fingerprint.")}</Empty>}
    </section><section className="surface" data-guide-target="behavior"><h2>{t("Closest peer matches")}</h2><p className="muted">{t("Similarity averages feature-level matches scaled by the median absolute deviation across accounts.")}</p><ErrorNote error={matches.error}/>
    {matches.data?.map(m=><details className="match" key={m.entity}><summary {...helpAttrs('similarity')}><Fingerprint size={16}/><b>{m.entity}</b><Status kind="verified">{m.score}/100</Status></summary>
      <dl className="feature-grid">{Object.entries(m.contributors).sort((a,b)=>b[1]-a[1]).map(([k,v])=><div key={k}><dt>{display(k)}</dt><dd>{num(v)}%</dd></div>)}</dl>
      <button className="small-button" {...helpAttrs('focus')} onClick={()=>{inspect(m.entity);patch({view:'universe',community:''})}}>{t("Locate in universe")}</button>
    </details>)}</section><TemporalComparison subject={id}/></div>
  </>
}

export function Relationships({finding}:{finding?:Finding}) {
  const {t}=useText()
  const id=useSubject(finding)
  const {inspect,patch}=useOrbit()
  const result=useQuery({queryKey:['relationships',id],queryFn:()=>api<Relationship[]>(url('relationships',{entity:id})),enabled:!!id})
  const account=useQuery({queryKey:['entity',id],queryFn:()=>api<EntityDetail>('entities/'+id),enabled:!!id})
  return <><Heading title={t("Relationship Discovery")} help="relationships" description={t("Review confirmed source links and inferred matches across devices, contact identifiers, and counterparties.")}/>
    <section className="surface" data-guide-target="relationships"><div className="section-top relationship-summary"><h2>{account.data?.entity.name??t('Relationship evidence')}</h2><Status>{t('{count} candidates',{count:num(result.data?.length??0)})}</Status></div>
      <p className="muted">{t("Confidence combines observed signals. A shared device, IP range, or contact identifier does not verify common ownership.")}</p>
      <ErrorNote error={result.error}/>
      {!result.data?.length&&<Empty>{t(result.isFetching?'Searching relationships…':'Select an account with relationship data.')}</Empty>}
      <div className="relationship-grid">{result.data?.map(r=><article key={r.entity} className="relationship">
        <div className="relationship-header">
          <button className="text-link relationship-name" onClick={()=>{inspect(r.entity);patch({view:'universe',community:''})}}><GitBranch size={15}/><span>{r.name}</span></button>
          <div className="relationship-meta">
            <Status kind={r.status}>{r.status==='verified'?t('Verified'):t('Inferred · {score}/100',{score:r.confidence})}</Status>
            <HelpHint feature="confidence"/>
          </div>
        </div>
        <EvidenceList entries={r.signals}/>
      </article>)}</div>
    </section>
  </>
}

export function DataSources({summary,user}:{summary:Summary;user:User}) {
  const {t}=useText()
  const client=useQueryClient()
  const {patch,showFinding}=useOrbit()
  const [page,setPage]=useState(0)
  const [file,setFile]=useState<File|null>(null)
  const ingest=useMutation({
    mutationFn:async (source:File)=>{
      if(source.size>5*1024*1024)throw new Error('Choose a file up to 5 MB')
      const input=await source.text()
      if(/\.csv$/i.test(source.name))return api<{added:number;summary:Summary}>('ingest',{csv:input})
      if(!/\.json$/i.test(source.name))throw new Error('Choose a CSV or JSON file')
      let payload:unknown
      try{payload=JSON.parse(input.replace(/^\uFEFF/,''))}catch{throw new Error('Invalid transaction JSON')}
      return api<{added:number;summary:Summary}>('ingest',payload)
    },
    onSuccess:result=>{
      setPage(0)
      client.setQueryData<Bootstrap>(['bootstrap'],current=>current&&{...current,summary:result.summary})
      void client.invalidateQueries()
    }
  })
  const records=useQuery({queryKey:['transactions',page],queryFn:()=>api<{items:Transaction[];total:number}>(url('transactions',{page})),placeholderData:keepPreviousData})
  const result=ingest.data?.summary
  const resultFinding=result?.findings[0]
  return <><Heading title={t("Data Sources")} help="data" description={t("Upload bank transactions and review the financial network and flagged patterns.")}/>
    <div className="data-card surface"><span className="source-icon"><Database size={24}/></span><div><h2>{t("Transaction ledger")}</h2><p>{t('{count} transactions',{count:num(summary.transactions)})} · {t('{count} accounts',{count:num(summary.accounts)})}{summary.transactions>0&&<> · {date(summary.start)} – {date(summary.end,true)}</>}</p></div></div>
    {user.role!=='auditor'&&<section className="surface bank-import"><h2>{t("Import bank transactions")}</h2>
      <p className="muted">{t("Choose a CSV or JSON file with up to 2,000 transactions and 5 MB. Accounts are created from sender and receiver IDs.")}</p>
      <details><summary>{t("File format")}</summary><p>{t("CSV columns or JSON fields")}</p><code>id,from,to,amount,currency,usd,kind,time</code>
        <p>{t("Use a comma for CSV, a decimal point for amounts, and ISO 8601 timestamps with a timezone. For JSON, put records in the transactions array.")}</p>
        <p>{t("Use the bank’s USD equivalent for non-USD transfers. Use stable, pseudonymized account IDs and unique transaction IDs.")}</p>
      </details>
      <form className="stacked-form bank-upload" onSubmit={event=>{event.preventDefault();if(file)ingest.mutate(file)}}>
        <label>{t("Bank export file")}<input type="file" accept=".csv,.json" required disabled={ingest.isPending} onChange={event=>{setFile(event.target.files?.[0]??null);ingest.reset()}}/></label>
        <button className="primary" disabled={!file||ingest.isPending}><Upload size={16}/>{t(ingest.isPending?'Analyzing transactions…':'Import and analyze')}</button>
      </form><ErrorNote error={ingest.error}/>
    </section>}
    {result&&<section className="surface bank-import" aria-label={t("Analysis results")}>
      <h2>{t("Analysis results")}</h2>
      <p className="notice" role="status">{t("{added} new transactions. {findings} findings across the ledger.",{added:num(ingest.data!.added),findings:num(result.findings.length)})}</p>
      {!resultFinding&&<p>{t("No patterns met the current detection rules.")}</p>}
      <div className="bank-result-actions">
        <button className="secondary" onClick={()=>{if(resultFinding)showFinding(resultFinding.id,resultFinding.subject);else useOrbit.getState().overview();patch({view:'universe'})}}>{t("Universe Explorer")}</button>
        <button className="secondary" onClick={()=>patch({view:'radar'})}>{t("Anomaly Radar")}</button>
      </div>
    </section>}
    <section className="surface ledger"><div className="section-top"><h2>{t("Transaction ledger")}</h2><Status>{t('{count} records',{count:num(records.data?.total??summary.transactions)})}</Status></div><ErrorNote error={records.error}/>
      {!summary.transactions&&<Empty>{t("No transactions have been imported yet.")}</Empty>}
      <div className="table-scroll"><table><thead><tr><th>{t("Reference")}</th><th>{t("Sender")}</th><th>{t("Receiver")}</th><th>{t("Amount")}</th><th>{t("Recorded UTC")}</th></tr></thead><tbody>{records.data?.items.map(t=><tr key={t.id}><td><button className="text-link mono" {...helpAttrs('transfer')} onClick={()=>patch({view:'universe',tx:t.id,panel:'transaction',selected:t.to})}>{t.id}</button></td><td>{t.from}</td><td>{t.to}</td><td>{money(t.amount,t.currency)}</td><td>{date(t.time)} · {utc(t.time)}</td></tr>)}</tbody></table></div>
      <div className="section-top paginate"><button className="secondary" disabled={page===0} onClick={()=>setPage(x=>x-1)}>{t("Previous")}</button><span>{t('Page {page} of {total}',{page:num(page+1),total:num(Math.max(1,Math.ceil((records.data?.total??0)/40)))})}</span><button className="secondary" disabled={(page+1)*40>=(records.data?.total??0)} onClick={()=>setPage(x=>x+1)}>{t("Next")}</button></div>
    </section>
  </>
}

export function Workspace({finding,user}:{finding?:Finding;user:User}) {
  const {t,display,language}=useText()
  const client=useQueryClient()
  const {selected,layout,after,before,community,expands,hidden}=useOrbit()
  const caseKey='orbit-current-case:'+user.name
  const [id,setSelectedCase]=useState(()=>sessionStorage.getItem(caseKey)??'')
  const [confirmation,setConfirmation]=useState('')
  const setID=(value:string)=>{setSelectedCase(value);sessionStorage.setItem(caseKey,value);setConfirmation('')}
  const [enteredTitle,setTitle]=useState<string>()
  const title=enteredTitle??(finding?display(finding.title):'')
  const [note,setNote]=useState('')
  const [reference,setReference]=useState('')
  const [conclusion,setConclusion]=useState('')
  const [question,setQuestion]=useState(()=>sessionStorage.getItem('orbit-report-question')||'')
  const [answerID,setAnswerID]=useState(()=>sessionStorage.getItem('orbit-report-answer')||'')
  const [scenario,setScenario]=useState<{action:string;target:string}|null>(()=>{
    try{return JSON.parse(sessionStorage.getItem('orbit-report-scenario')||'null')}catch{return null}
  })
  const list=useQuery({queryKey:['cases',user.name],queryFn:()=>api<CaseList[]>('cases')})
  const record=useQuery({queryKey:['case',id],queryFn:()=>api<CaseRecord>('cases/'+id),enabled:!!id})
  const create=useMutation({mutationFn:()=>api<CaseRecord>('cases',{title,finding:finding?.id}),onSuccess:c=>{setID(c.id);setConfirmation('Case created. You can attach evidence or add a note.');client.setQueryData(['case',c.id],c);void client.invalidateQueries({queryKey:['cases']})}})
  const update=useMutation({
    mutationFn:({action,payload}:{action:string;payload:object})=>api<CaseRecord>('cases/'+id+'/'+action,payload),
    onSuccess:(c,{action})=>{
      const confirmed:Record<string,string>={note:'Note added to the case.', evidence:'Evidence attached.', finding:'Finding saved.',
        scenario:'Scenario attached.', snapshot:'Graph snapshot saved.', status:'Case status updated.'}
      setConfirmation(confirmed[action]??'')
      client.setQueryData(['case',c.id],c);void client.invalidateQueries({queryKey:['cases']})
      if(action==='note')setNote('')
      if(action==='finding'){setQuestion('');setAnswerID('');sessionStorage.removeItem('orbit-report-question');sessionStorage.removeItem('orbit-report-answer')}
      if(action==='scenario'){setScenario(null);sessionStorage.removeItem('orbit-report-scenario')}
    }
  })
  const relationLabel=(from:string,to:string)=>t('{from} to {to}',{from,to})
  const c=record.data
  const write=Boolean(c&&user.role!=='auditor'&&c.status!=='Reviewed')
  return <>
    <Heading title={t("Investigation Workspace")} help="cases" description={t("Save evidence, compare scenarios, and prepare cases for human review.")}/>
    <div className="workspace-grid">
      <section className="surface" data-guide-target="case-list"><h2>{t("Cases")}</h2><ErrorNote error={list.error}/>
        {!list.data?.length&&<Empty>{t(user.role==='auditor'?'Cases will appear here when an analyst creates one.':'Select a finding and use the form below to start your first case.')}</Empty>}
        {list.data?.map(item=><button key={item.id} {...helpAttrs('caseOpen')} className={'pattern-row '+(id===item.id?'current':'')} onClick={()=>{setID(item.id);setReference('')}}><FileText size={17}/><span className="pattern-info"><b>{item.title}</b><small>{date(item.updated)}</small></span><Status>{display(item.status)}</Status></button>)}
        {user.role!=='auditor'&&<form className="stacked-form case-create" data-guide-target="case-create" onSubmit={e=>{e.preventDefault();create.mutate()}}><label>{t("Case title")}<input minLength={3} maxLength={120} value={title} onChange={e=>setTitle(e.target.value)} placeholder={t("Investigation title")} required/></label>{finding&&<small className="muted">{display(finding.title)} · {t('{count} evidence records',{count:num(finding.transactions.length)})}</small>}
          <button className="primary" {...helpAttrs('caseCreate')} disabled={!finding||create.isPending}><Plus size={16}/>{t(create.isPending?'Creating…':'Create case')}</button><ErrorNote error={create.error}/></form>}
      </section>
      <section className="surface case-detail">
        <ErrorNote error={record.error}/><ErrorNote error={update.error}/>
        {confirmation&&<p className="guide-operation-status" role="status">{display(confirmation)}</p>}
        {!c?<Empty>{t(record.isFetching?'Loading case…':'Select or create a case to open its report.')}</Empty>:<>
          <div className="section-top"><div><Status kind={c.status==='Reviewed'?'verified':'neutral'}>{display(c.status)}</Status><h2>{c.title}</h2><small className="muted">{t('Case {id}',{id:c.id})} · {date(c.created,true)}</small></div>
          <div className="export-buttons" data-guide-target="exports"><HelpHint feature="reports"/><a className="secondary" {...helpAttrs('pdf')} href={'/api/cases/'+c.id+'/pdf'}><FileText size={15}/> PDF</a><a className="secondary" {...helpAttrs('json')} href={'/api/cases/'+c.id+'/json'}><FileJson size={15}/> JSON</a></div></div>
          <AnswerCard answer={c.summary}/>
          <details><summary>{t('Saved graph snapshot · {count} entities',{count:num(c.graph.nodes.length)})}</summary><GraphList graph={c.graph} openInUniverse/></details>
          {c.snapshots?.map((snapshot,i)=><details key={snapshot.at+i}><summary>{display(snapshot.label)} · {display(snapshot.layout)} · {snapshot.before?(snapshot.after?date(snapshot.after)+' – ':'')+date(snapshot.before,true):date(snapshot.at,true)}</summary><GraphList graph={snapshot.graph} openInUniverse/></details>)}
          {write&&<button {...helpAttrs('snapshot')} className="small-button" disabled={update.isPending} onClick={()=>update.mutate({action:'snapshot',payload:{focus:selected,layout,after,before,community,expand:expands.join(','),hide:hidden.join(',')}})}><Layers3 size={14}/> {t("Save current graph view")}</button>}
          <details><summary>{t('Transaction timeline · {count} entries',{count:num(c.timeline.steps.length)})}</summary><div className="report-timeline">{c.timeline.steps.map(t=><div key={t.id}><b>{t.id}</b><span>{utc(t.time)} UTC · {relationLabel(t.sender,t.receiver)}</span><strong>{money(t.amount,t.currency)}</strong></div>)}</div></details>
          <h3>{t("Attached evidence")}</h3>{c.evidence.length>0?<EvidenceList entries={c.evidence}/>:<p className="muted">{t("No additional evidence attached.")}</p>}
          {write&&<form className="inline-form" onSubmit={e=>{e.preventDefault();update.mutate({action:'evidence',payload:{reference:reference||c.finding.transactions[0]}})}}><select {...helpAttrs('attach')} aria-label={t("Ledger evidence reference")} value={reference||c.finding.transactions[0]||''} onChange={e=>setReference(e.target.value)}>{c.finding.evidence.map(ev=><option key={ev.id} value={ev.id}>{ev.id} · {ledgerText(language,ev.label)}</option>)}</select><button className="secondary" {...helpAttrs('attach')} disabled={update.isPending}>{t("Attach")}</button></form>}
          {c.savedFindings.map((a,i)=><AnswerCard answer={a} key={i}/>)}
          {write&&<form className="inline-form" onSubmit={e=>{e.preventDefault();update.mutate({action:'finding',payload:{question,reference:answerID,focus:c.finding.subject}})}}><input aria-label={t("Investigation question to save")} value={question} placeholder={t("Save a ledger-backed answer")} onChange={e=>{setQuestion(e.target.value);setAnswerID('')}}/><button {...helpAttrs('saveAnswer')} className="secondary" disabled={!question.trim()||update.isPending}>{t("Save finding")}</button></form>}
          {c.scenarios.length>0&&<><h3>{t("Saved scenarios")}</h3>{c.scenarios.map((s,i)=><details key={i}><summary>{language==='en'?s.action.replaceAll('-',' '):display(s.action)} · {s.target}</summary><p>{t('Transfers: {before} to {after} · Connected groups: {start} to {end}.',{before:s.comparison.before.transactions,after:s.comparison.after.transactions,start:s.comparison.before.components,end:s.comparison.after.components})}</p></details>)}</>}
          {write&&scenario&&<button {...helpAttrs('saveScenario')} className="secondary" disabled={update.isPending} onClick={()=>update.mutate({action:'scenario',payload:scenario})}><GitBranch size={15}/> {t('Attach scenario {target}',{target:scenario.target})}</button>}
          <h3>{t("Analyst notes")}</h3>{c.notes.map((n,i)=><article className="case-note" key={i}><small>{n.author} · {date(n.at,true)}</small><p>{n.text}</p></article>)}
          {write&&<form className="stacked-form" onSubmit={e=>{e.preventDefault();update.mutate({action:'note',payload:{text:note}})}}><textarea maxLength={3000} aria-label={t("Analyst note")} value={note} onChange={e=>setNote(e.target.value)} placeholder={t("Record an observation or next step…")}/><button {...helpAttrs('note')} className="secondary" disabled={!note.trim()||update.isPending}>{t("Add note")}</button></form>}
          {write&&c.status==='Open'&&<button {...helpAttrs('review')} className="secondary" disabled={update.isPending} onClick={()=>update.mutate({action:'status',payload:{status:'In review'}})}><ShieldCheck size={16}/> {t("Submit for review")}</button>}
          {write&&c.status==='In review'&&['administrator','senior analyst'].includes(user.role)&&<form className="stacked-form" onSubmit={e=>{e.preventDefault();update.mutate({action:'status',payload:{status:'Reviewed',text:conclusion}})}}><label>{t("Analyst conclusion")}<textarea value={conclusion} minLength={3} maxLength={3000} required onChange={e=>setConclusion(e.target.value)}/></label><button {...helpAttrs('review')} className="primary" disabled={conclusion.trim().length<3||update.isPending}>{t("Complete review")}</button></form>}
          {c.conclusion&&<article className="case-note"><small>{t('Analyst conclusion')} · {c.reviewer}</small><p>{c.conclusion}</p></article>}
        </>}
      </section>
    </div>
  </>
}

function AccountProvisioning({role,user}:{role:string;user:User}) {
  const {t,display}=useText()
  const client=useQueryClient()
  const registration=useQuery({queryKey:['registration'],queryFn:readRegistration})
  const [email,setEmail]=useState('')
  const create=useMutation({mutationFn:()=>api<User>('accounts',{email}),onSuccess:()=>{
    setEmail('')
    void client.invalidateQueries({queryKey:['accounts',user.name]})
  }})
  const roleName=display(role==='administrator'?'Bank administrator':role)
  return <section className="surface">
    <h2>{t("Create an account")}</h2>
    <p className="muted">{t("New account role — {role}",{role:roleName})}</p>
    <form className="stacked-form bank-upload" onSubmit={e=>{e.preventDefault();create.mutate()}}>
      <label>{t("Account email")}<input type="email" required maxLength={254} value={email} disabled={create.isPending} onChange={e=>setEmail(e.target.value)}/></label>
      <button className="primary" disabled={!email.trim()||create.isPending}>{t("Create account")}</button>
    </form>
    <ErrorNote error={create.error}/>
    {create.data&&<p className="notice" role="status">{t(registration.data?.closed?
      "Account created for {email}. It can be activated when registration reopens.":
      "Account created for {email}. They can activate it using Register on the sign-in screen.",{email:create.data.name})}</p>}
  </section>
}

const accountRoleFilters=[
  {id:'all', label:'All roles'},
  {id:'administrator', label:'Bank administrators'},
  {id:'senior analyst', label:'Senior analysts'},
  {id:'analyst', label:'Analysts'},
] as const

export function AccountManagement({role,user}:{role:string;user:User}) {
  const {t,display}=useText()
  const [filter,setFilter]=useState('all')
  const directory=useQuery({
    queryKey:['accounts',user.name],
    queryFn:()=>api<AccountDirectoryEntry[]>('accounts'),
    staleTime:0,
    refetchOnWindowFocus:true,
  })
  const rows=directory.data?.filter(account=>filter==='all'||account.role===filter)??[]
  const active=rows.filter(account=>account.active).length
  const title=user.role==='senior analyst'?'My analysts':user.role==='administrator'?'Senior analysts':'Account directory'

  return <>
    <section className="surface account-directory">
      <div className="section-top account-directory-toolbar">
        <h2>{t(title)}</h2>
        {user.role==='platform administrator'&&<select aria-label={t("Filter by role")} value={filter} onChange={event=>setFilter(event.target.value)}>
          {accountRoleFilters.map(option=><option key={option.id} value={option.id}>{t(option.label)}</option>)}
        </select>}
      </div>
      <ErrorNote error={directory.error}/>
      {directory.isPending&&<p className="muted" role="status">{t("Loading accounts…")}</p>}
      {directory.data&&<>
        <div className="account-directory-stats">
          <div><span>{t("Accounts")}</span><strong>{num(rows.length)}</strong></div>
          <div><span>{t("Active")}</span><strong>{num(active)}</strong></div>
          <div><span>{t("Pending activation")}</span><strong>{num(rows.length-active)}</strong></div>
          <div><span>{t("Cases")}</span><strong>{num(rows.reduce((sum,account)=>sum+account.activity.cases,0))}</strong></div>
        </div>
        {rows.length?<div className="table-scroll"><table>
          <thead><tr><th>{t("Corporate email")}</th><th>{t("Role")}</th><th>{t("Status")}</th><th>{t("Cases created")}</th><th>{t("In review")}</th><th>{t("Reviewed cases")}</th><th>{t("Reviews completed")}</th></tr></thead>
          <tbody>{rows.map(account=><tr key={account.email}>
            <td><b>{account.email}</b>{account.createdBy&&<small>{t("Created by {email}",{email:account.createdBy})}</small>}</td>
            <td>{display(account.role==='administrator'?'Bank administrator':account.role)}</td>
            <td><Status kind={account.active?'verified':'neutral'}>{t(account.active?'Active':'Pending activation')}</Status></td>
            <td>{num(account.activity.cases)}</td><td>{num(account.activity.inReview)}</td><td>{num(account.activity.reviewed)}</td><td>{num(account.activity.reviewsCompleted)}</td>
          </tr>)}</tbody>
        </table></div>:<Empty>{t("No accounts to show.")}</Empty>}
      </>}
    </section>
    <AccountProvisioning role={role} user={user}/>
  </>
}

export function Settings({user,onLogin,managedRole}:{user:User;onLogin:()=>void;managedRole?:string}) {
  const {t,display}=useText()
  const {list,reduced,patch}=useOrbit()
  const audit=useQuery({queryKey:['audit',user.name],queryFn:()=>api<{actor:string;action:string;reference:string;at:string}[]>('audit'),enabled:['administrator','auditor'].includes(user.role)})
  return <><Heading title={t("Settings")} help="settings" description={t("Manage presentation preferences and your investigation session.")}/>
    {managedRole&&<AccountManagement key={user.name} role={managedRole} user={user}/>}
    <section className="surface settings"><h2>{t("Accessibility")}</h2>
      <label><span><b>{t("Reduced motion")}</b><small>{t("Freeze background stars and transfer particles and skip camera transitions.")}</small></span><input type="checkbox" {...helpAttrs('display')} checked={reduced} onChange={e=>patch({reduced:e.target.checked})}/></label>
      <label><span><b>{t("Accessible entity list")}</b><small>{t("Use a keyboard-friendly table for graph exploration.")}</small></span><input type="checkbox" {...helpAttrs('display')} checked={list} onChange={e=>patch({list:e.target.checked})}/></label>
    </section>
    <GuideSettings/>
    <section className="surface settings"><h2>{t("Session")}</h2><div className="section-top"><div><b>{user.name}</b><p className="muted">{display(user.role==='administrator'?'Bank administrator':user.role)}</p></div><button className="secondary" onClick={onLogin}>{t("Switch account")}</button></div></section>
    {audit.isEnabled&&<section className="surface"><h2>{t("Audit trail")}</h2><ErrorNote error={audit.error}/><div className="table-scroll"><table><thead><tr><th>{t("Actor")}</th><th>{t("Action")}</th><th>{t("Reference")}</th><th>{t("Time UTC")}</th></tr></thead><tbody>{audit.data?.map((r,i)=><tr key={i}><td>{r.actor}</td><td>{display(r.action)}</td><td>{r.reference}</td><td>{date(r.at)} · {utc(r.at)}</td></tr>)}</tbody></table></div></section>}
  </>
}

export function Login({initial=false,close,onSuccess}:{initial?:boolean;close:()=>void;onSuccess:()=>void}) {
  const {t}=useText()
  const [mode,setMode]=useState<'login'|'register'|'verify'>('login')
  const [email,setEmail]=useState('')
  const [password,setPassword]=useState('')
  const [code,setCode]=useState('')
  const registration=useQuery({queryKey:['registration'],queryFn:readRegistration})
  const signIn=useMutation({mutationFn:()=>api<User>('login',{email,password}),onSuccess})
  const sendCode=useMutation({mutationFn:()=>api('registration/code',{email}),onSuccess:()=>setMode('verify')})
  const verify=useMutation({mutationFn:()=>api<User>('registration/verify',{email,code,password}),onSuccess})
  const inbox=useMutation({mutationFn:()=>api<{code:string}>('registration/test-inbox',{email})})
  const pending=signIn.isPending||sendCode.isPending||verify.isPending
  const canRegister=registration.data?.enabled===true
  const localInbox=registration.data?.localInbox===true
  const switchMode=(next:typeof mode)=>{
    signIn.reset();sendCode.reset();verify.reset();inbox.reset()
    setPassword('');setCode('');setMode(next)
  }
  const submit=(event:FormEvent)=>{
    event.preventDefault()
    if(mode==='login')signIn.mutate()
    else if(mode==='verify')verify.mutate()
    else if(canRegister)sendCode.mutate()
  }
  const title=mode==='login'?t("Sign in to your workspace"):t("Account registration")
  return <div className={initial?'login-page':'modal-backdrop'}><section className="surface login-card" role={initial?undefined:'dialog'} aria-modal={initial?undefined:true} aria-label={title}>
    <div className="section-top"><h2>{title}</h2><LanguageSelect compact/>{!initial&&<button type="button" className="text-link" onClick={close}>{t("Cancel")}</button>}</div>
    <form className="stacked-form" onSubmit={submit}>
      {mode==='register'&&registration.data?.enabled===false&&<p className="notice" role="status">{t("Corporate registration requires a configured email domain and mail delivery. For local testing, sign in with the test analyst account.")}</p>}
      {mode==='register'&&registration.isError&&<><ErrorNote error={registration.error}/><button type="button" className="secondary" onClick={()=>void registration.refetch()}>{t("Retry connection")}</button></>}
      {mode==='register'&&localInbox&&<p className="notice">{t("Use a made-up address on northstar.example. The code will appear in the local test inbox.")}</p>}
      <label>{t(localInbox&&mode!=='login'?"Test email":"Corporate email")}<input type="email" autoComplete="username" required maxLength={254} readOnly={mode==='verify'||pending} value={email} onChange={e=>setEmail(e.target.value)}/></label>
      {mode==='verify'&&<>
        {localInbox?<><button type="button" className="secondary" disabled={inbox.isPending||pending} onClick={()=>inbox.mutate()}>{t("Open test inbox")}</button>
          {inbox.data&&<output className="notice" aria-live="polite">{t("Code from the test email — {code}",{code:inbox.data.code})}</output>}</>:
          <p className="muted">{t("Enter the eight-digit code we sent to your corporate email.")}</p>}
        <label>{t("Verification code")}<input autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{8}" maxLength={8} required value={code} onChange={e=>setCode(e.target.value)}/></label>
      </>}
      {mode!=='register'&&<label>{t("Password")}<input type="password" autoComplete={mode==='verify'?'new-password':'current-password'} minLength={mode==='verify'?12:undefined} maxLength={72} required value={password} onChange={e=>setPassword(e.target.value)}/></label>}
      <ErrorNote error={signIn.error??sendCode.error??verify.error??inbox.error}/>
      <button className="primary" disabled={pending||mode==='register'&&!canRegister}>{mode==='register'?t("Send verification code"):mode==='verify'?t("Verify and create account"):t(signIn.isPending?'Signing in…':'Sign in')}</button>
      {mode==='verify'&&<button type="button" className="text-link" disabled={pending} onClick={()=>switchMode('register')}>{t("Change email or request a new code")}</button>}
      {mode!=='login'&&<button type="button" className="text-link" disabled={pending} onClick={()=>switchMode('login')}>{t("Sign in")}</button>}
      {mode==='login'&&registration.data&&!registration.data.closed&&<button type="button" className="secondary" disabled={pending} onClick={()=>switchMode('register')}>{t("Register")}</button>}
    </form>
  </section></div>
}
