import {useText} from './i18n/text'
import {ledgerText} from './i18n/ledger'
import {useQuery} from '@tanstack/react-query'
import {Activity, ArrowDownLeft, ArrowUpRight, ChevronDown, ChevronLeft, ChevronRight, CircleAlert, Clock3, Fingerprint, GitBranch, Maximize, Minimize, Network, Pause, Play, Search, SkipBack, Sparkles, Waypoints, X} from 'lucide-react'
import {useEffect, useState} from 'react'
import type {ReactNode} from 'react'
import {api, compact, date, money, num, url, utc} from './api'
import {HelpHint} from './guide/Guide'
import {helpAttrs,type Feature} from './guide/content'
import {useGuide} from './guide/state'
import {Scene} from './Scene'
import {layouts, useOrbit} from './state'
import type {Answer, Entity, Evidence, Finding, FindingCheck, Graph, Step, Story, Summary, Transaction} from './types'

export const graphLayouts=layouts

export function Empty({children}:{children:ReactNode}) {return <div className="empty">{children}</div>}
export function ErrorNote({error}:{error:unknown}) {
  const {language}=useText()
  return error instanceof Error?<div className="error-note" role="alert"><CircleAlert size={16}/>{ledgerText(language,error.message)}</div>:null
}
export function Status({children,kind='neutral'}:{children:ReactNode;kind?:string}) {
  return <span className={'status '+kind}>{children}</span>
}
export function Stat({label,value,note,icon,help}:{label:string;value:ReactNode;note?:string;icon?:ReactNode;help?:Feature}) {
  return <div className="stat" {...(help?helpAttrs(help):{})}><div className="stat-label">{icon}{label}</div><strong>{value}</strong>{note&&<small>{note}</small>}</div>
}
export function Metrics({summary,onFindings}:{summary:Summary;onFindings:()=>void}) {
  const {t,language}=useText()
  return <div className="metrics">
    <Stat help="metrics" label={t("Network entities")} icon={<Network size={15}/>} value={num(summary.entities)} note={t('{count} accounts',{count:num(summary.accounts)})}/>
    <Stat help="metrics" label={t("Transactions")} icon={<Waypoints size={15}/>} value={num(summary.transactions)} note={t("Across all currencies")}/>
    <Stat help="volume" label={t("Gross volume")} icon={<Activity size={15}/>} value={language==='en'?'$'+compact(summary.usd):compact(summary.usd)+' USD'} note={t("USD equivalent")}/>
    <button className="stat stat-action" onClick={onFindings} {...helpAttrs('riskScore')}>
      <span className="stat-label"><CircleAlert size={15}/>{t("Flagged patterns")}<ChevronRight size={15}/></span>
      <strong>{num(summary.findings.length)}</strong><small>{t("View all flagged patterns")}</small>
    </button>
  </div>
}

export function EvidenceList({entries,limit}:{entries:Evidence[];limit?:number}) {
  const {language}=useText()
  const {inspect,patch}=useOrbit()
  return <div className="evidence-list">{entries.slice(0,limit??entries.length).map((e,i)=><button key={e.id+i} {...helpAttrs('evidence')} onClick={()=>{
    if(e.focus)inspect(e.focus)
    if(e.transaction||/^TX-[\w-]+$/.test(e.id))patch({tx:e.id,panel:'transaction',playing:false})
    patch({view:'universe'})
  }}>
    <span className={'evidence-mark '+e.status}/><span><b>{e.id}</b><small>{ledgerText(language,e.label)}</small></span><ChevronRight size={14}/>
  </button>)}</div>
}

export function RuleChecks({checks,evidence}:{checks:FindingCheck[];evidence:Evidence[]}) {
  const {t,language}=useText()
  const records=new Map(evidence.map(entry=>[entry.id,entry]))
  return <ol className="rule-checks">{checks.map((check,index)=>{
    const refs=(check.references??[]).flatMap(id=>{
      const record=records.get(id)
      return record?[record]:[]
    })
    return <li key={index}>
      <h3>{ledgerText(language,check.condition)}</h3>
      {check.observations.map((observation,i)=><p key={i}>{ledgerText(language,observation)}</p>)}
      {refs.length>0&&<details><summary>{t('{count} supporting references',{count:num(refs.length)})}</summary><EvidenceList entries={refs}/></details>}
    </li>
  })}</ol>
}

export function AnswerCard({answer}:{answer:Answer}) {
  const {t,language,display}=useText()
  if(answer.kind==='assistant')return <article className="answer assistant-reply"><p>{ledgerText(language,answer.text)}</p></article>
  return <article className="answer">
    <Status kind={answer.kind}><Sparkles size={12}/> {t("Algorithmic finding")}</Status>
    <h3>{display(answer.title)}</h3><p>{ledgerText(language,answer.text)}</p>
    {answer.evidence.length>0&&<details><summary>{t('{count} supporting references',{count:num(answer.evidence.length)})}</summary><EvidenceList entries={answer.evidence}/></details>}
    {!!answer.checks?.length&&<details><summary>{t("Rule verification")}</summary><RuleChecks checks={answer.checks} evidence={answer.evidence}/></details>}
    {answer.hypotheses?.map(h=><details key={h.text}><summary>{t("AI-generated hypothesis")}</summary><p>{ledgerText(language,h.text)}</p><EvidenceList entries={answer.evidence.filter(e=>h.references.includes(e.id))}/></details>)}
    {answer.limitations.length>0&&<details><summary>{t("Limitations")}</summary><ul>{answer.limitations.map(l=><li key={l}>{ledgerText(language,l)}</li>)}</ul></details>}
  </article>
}

export function SearchBox() {
  const {t,display}=useText()
  const [input,setInput]=useState('')
  const [value,setValue]=useState('')
  const [open,setOpen]=useState(false)
  const {inspect,patch}=useOrbit()
  useEffect(()=>{
    const timer=window.setTimeout(()=>setValue(input.trim()),180)
    return ()=>clearTimeout(timer)
  },[input])
  const search=useQuery({queryKey:['search',value],queryFn:()=>api<{entities:Entity[];transactions:Transaction[]}>(url('search',{q:value})),enabled:open&&value.length>0})
  useEffect(()=>{
    const handler=(e:KeyboardEvent)=>{
      if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){
        e.preventDefault();document.getElementById('global-search')?.focus()
      }
    }
    window.addEventListener('keydown',handler)
    return ()=>window.removeEventListener('keydown',handler)
  },[])
  const choose=(id:string,tx?:string)=>{
    inspect(id)
    patch({view:'universe',community:'',after:'',before:'',...(tx?{tx,panel:'transaction'}:{})})
    setOpen(false);setInput('')
    document.getElementById('global-search')?.blur()
  }
  return <div className="global-search">
    <Search size={17}/><input {...helpAttrs('search')} id="global-search" autoComplete="off" aria-label={t("Search entities or transactions")} placeholder={t("Search entities, transactions…")} value={input} onFocus={()=>setOpen(true)} onBlur={e=>{if(!e.currentTarget.parentElement?.contains(e.relatedTarget))setOpen(false)}} onChange={e=>{setInput(e.target.value);setOpen(true)}} onKeyDown={e=>{
      if(e.key==='Escape'){setOpen(false);e.currentTarget.blur()}
      if(e.key==='Enter'&&search.data){
        const first=search.data.entities[0],tx=search.data.transactions[0]
        if(tx)choose(tx.to,tx.id); else if(first)choose(first.id)
      }
    }}/><kbd>⌘ K</kbd>
    {open&&input&&<div className="search-results" aria-label={t("Search results")}>
      {search.isFetching&&<p>{t("Searching ledger…")}</p>}
      {!search.isFetching&&search.data&&!search.data.entities.length&&!search.data.transactions.length&&<p>{t("No matching entities or transactions.")}</p>}
      {search.data?.transactions.map(tx=><button key={tx.id} onMouseDown={e=>e.preventDefault()} onClick={()=>choose(tx.to,tx.id)}><Activity size={16}/><span>{tx.id}<small>{money(tx.amount,tx.currency)} · {date(tx.time)}</small></span></button>)}
      {search.data?.entities.map(n=><button key={n.id} onMouseDown={e=>e.preventDefault()} onClick={()=>choose(n.id)}><Network size={16}/><span>{n.name}<small>{n.id} · {display(n.kind)}</small></span></button>)}
      <ErrorNote error={search.error}/>
    </div>}
  </div>
}

export function Heading({eyebrow,title,description,actions,help}:{eyebrow?:string;title:string;description?:string;actions?:ReactNode;help?:Feature}) {
  return <div className="page-heading"><div>
    {eyebrow&&<div className="eyebrow">{eyebrow}</div>}
    <div className="guide-heading-title"><h1>{title}</h1>{help&&<HelpHint feature={help}/>}</div>{description&&<p>{description}</p>}
  </div>{actions&&<div className="heading-actions">{actions}</div>}</div>
}

export function GraphCard({graph,finding,guideFinding,active,loading,error,communities}:{graph?:Graph;finding?:Finding;guideFinding?:Finding;active?:Step;loading?:boolean;error?:unknown;communities?:string[]}) {
  const {t,display}=useText()
  const welcomeOpen=useGuide(state=>!state.seen&&!state.help&&!state.active)
  const [sceneReady,setSceneReady]=useState(!welcomeOpen)
  const {layout,community,guided,patch,large,list,showFinding}=useOrbit()
  useEffect(()=>{
    if(welcomeOpen||sceneReady)return
    // Paint the workspace after the welcome dialog closes before starting WebGL.
    let sceneFrame=0
    const paintFrame=requestAnimationFrame(()=>{
      sceneFrame=requestAnimationFrame(()=>setSceneReady(true))
    })
    return ()=>{
      cancelAnimationFrame(paintFrame)
      cancelAnimationFrame(sceneFrame)
    }
  },[welcomeOpen,sceneReady])
  const communityOptions=communities??Array.from(new Set(graph?.nodes.map(node=>node.community).filter(Boolean))).sort()
  const toggleFullscreen=()=>{
    const el=document.getElementById('graph-card')
    if(document.fullscreenElement){void document.exitFullscreen();return}
    if(large){patch({large:false});return}
    if(el?.requestFullscreen){void el.requestFullscreen().catch(()=>patch({large:true}))}
    else patch({large:true})
  }
  return <section className={'graph-card '+(large?'maximized':'')} id="graph-card" data-guide-target="graph" aria-label={t("Financial universe")}>
    <div className="graph-toolbar">
      <div className="graph-title"><Network size={17}/><b>{t("Network topology")}</b><HelpHint feature="graph"/>{loading&&graph&&<span className="tiny-spinner" aria-label={t("Updating graph")}/>}</div>
      <div className="graph-options">
        {(communityOptions.length>0||community)&&<div className="select-inline"><select {...helpAttrs('community')} aria-label={t("Filter community")} value={community} onChange={e=>patch({community:e.target.value,simActive:false})}><option value="">{t("All communities")}</option>{communityOptions.map(c=><option key={c} value={c}>{display(c)}</option>)}</select><ChevronDown size={13}/></div>}
        <div className="select-inline"><select {...helpAttrs('layout')} aria-label={t("Graph layout")} value={layout} onChange={e=>patch({layout:e.target.value,simActive:false})}>{graphLayouts.map(c=><option key={c} value={c}>{display(c)}</option>)}</select><ChevronDown size={13}/></div>
        <button className="icon-button fullscreen-control" {...helpAttrs('fullscreen')} aria-label={t("Toggle fullscreen")} onClick={toggleFullscreen}>{large?<Minimize size={16}/>:<Maximize size={16}/>}</button>
      </div>
    </div>
    <div className="graph-body">
      {welcomeOpen||!sceneReady ? <div className="scene" aria-hidden="true"/> :
        graph ? <Scene graph={graph} finding={finding} active={active}/> :
        <div className="scene waiting"><ErrorNote error={error}/>{!error&&<span>{t("Constructing the financial graph…")}</span>}</div>}
      {graph&&<><div className="graph-view-mode">
        <button {...helpAttrs('explore')} aria-pressed={!guided} className={!guided?'current':''} onClick={()=>patch({guided:false})}><Network size={14}/> {t("Explore")}</button>
        <button {...helpAttrs('guided')} aria-pressed={guided} className={guided?'current':''} onClick={()=>{
          const target=finding??guideFinding
          if(target)showFinding(target.id,target.subject)
          patch({guided:true,panel:'finding',...(target?{playing:true,step:0}:{})})
        }}><Sparkles size={14}/> {t("Guided")}</button>
      </div><div className="graph-count"><span className="live-dot"/>{t('{shown} of {total} entities',{shown:num(graph.nodes.length),total:num(graph.total)})}{list&&<button className="text-link" {...helpAttrs('list')} onClick={()=>patch({list:false})}>{t("3D view")}</button>}</div></>}
    </div>
  </section>
}

export function Timeline({summary,story}:{summary:Summary;story?:Story}) {
  const {t}=useText()
  const {playing,step,after,before,patch}=useOrbit()
  const values=summary.buckets,max=Math.max(1,...values.map(v=>v.count))
  const at=before?values.findIndex(v=>v.date===before):values.length-1
  const displayDate=values[Math.max(0,at)]?.date??summary.end.slice(0,10)
  const rangeStart=values[0]?.date??summary.start.slice(0,10)
  const rangeEnd=values.at(-1)?.date??summary.end.slice(0,10)
  const total=story?.steps.length??0
  const current=story?.steps[step]
  function skip(amount:number) {
    if(total)patch({step:Math.min(total-1,Math.max(0,step+amount)),playing:false,panel:'story',after:'',before:''})
    else {
      const day=values[Math.min(values.length-1,Math.max(0,at+amount))]?.date
      if(day)patch({before:day,after:after>day?'':after,playing:false})
    }
  }
  function play() {
    if(playing)patch({playing:false})
    else if(total)patch({playing:true,step:step<0||step>=total-1?0:step,panel:'story',after:'',before:''})
    else patch({playing:true,before:at>=values.length-1?(after||rangeStart):displayDate})
  }
  return <section className="timeline" data-guide-target="timeline" aria-label={t("Temporal controls")}>
    <div className="timeline-top">
      <div className="timeline-title"><Clock3 size={16}/><b>{t("Temporal playback")}</b><HelpHint feature="history"/>{current&&<Status kind="warm">{t('Step {current} / {total}',{current:step+1,total})}</Status>}</div>
      <span className="timeline-date">{current?date(current.time)+' · '+utc(current.time)+' UTC':(after?date(after)+' – ':'')+date(displayDate,true)+' UTC'}</span>
    </div>
    <div className="timeline-main">
      <div className="transport">
        <button {...helpAttrs('playback')} aria-label={t("Go to start")} onClick={()=>patch({playing:false,step:-1,before:after||rangeStart})}><SkipBack size={16}/></button>
        <button {...helpAttrs('playback')} aria-label={t(playing?'Pause playback':'Play money flow')} className="play" onClick={play}>{playing?<Pause size={15} fill="currentColor"/>:<Play size={15} fill="currentColor"/>}</button>
        <button {...helpAttrs('playback')} aria-label={t("Previous step")} onClick={()=>skip(-1)}><ChevronLeft size={17}/></button>
        <button {...helpAttrs('playback')} aria-label={t("Next step")} onClick={()=>skip(1)}><ChevronRight size={17}/></button>
      </div>
      <div className="time-series">
        <div className="histogram" aria-hidden="true">{values.map((v,index)=><i key={v.date} style={{height:(12+88*v.count/max)+'%'}} className={(index<=at?'passed ':'')+(index===at?'at':'')} title={date(v.date)+' · '+t('{count} transfers',{count:num(v.count)})}/>)}</div>
        <input {...helpAttrs('scrub')} type="range" min={0} max={Math.max(0,values.length-1)} value={Math.max(0,at)} aria-label={t("Historical snapshot")} aria-valuetext={date(displayDate,true)} onChange={e=>{const day=values[Number(e.target.value)].date;patch({before:day,after:after>day?'':after,step:-1,playing:false,simActive:false})}}/>
        <div className="timeline-ticks">{[0,.25,.5,.75,1].map(x=>{const v=values[Math.round((values.length-1)*x)];return v?<span key={x}>{date(v.date)}</span>:null})}</div>
      </div>
    </div>
    <details className="guide-date-range">
      <summary {...helpAttrs('dateRange')}>{t("Date range")}</summary>
      <form key={after+'-'+before} onSubmit={event=>{
        event.preventDefault()
        const form=new FormData(event.currentTarget)
        const start=String(form.get('range-start')??'')
        const end=String(form.get('range-end')??'')
        if(!start||!end)return
        if(start>end){
          const input=event.currentTarget.elements.namedItem('range-end')
          if(input instanceof HTMLInputElement){input.setCustomValidity(t('Choose an end date on or after the start date.'));input.reportValidity()}
          return
        }
        patch({after:start,before:end,playing:false,step:-1,simActive:false})
      }}>
        <label>{t("Start date")}<input name="range-start" type="date" min={rangeStart} max={rangeEnd} defaultValue={after||rangeStart} required/></label>
        <label>{t("End date")}<input name="range-end" type="date" min={rangeStart} max={rangeEnd} defaultValue={before||rangeEnd}
          onInput={event=>event.currentTarget.setCustomValidity('')} required/></label>
        <button className="small-button" {...helpAttrs('dateRange')}>{t("Apply range")}</button>
        {(after||before)&&<button type="button" className="text-link" onClick={()=>patch({after:'',before:'',step:-1,playing:false,simActive:false})}>{t("Clear range")}</button>}
      </form>
    </details>
  </section>
}

export function SelectedStep({step,index,onClose}:{step:Step;index:number;onClose:()=>void}) {
  const {t,display}=useText()
  const {inspect}=useOrbit()
  return <div className="selected-step">
    <div className="section-top"><Status kind="warm">{t('Step {current} · {stage}',{current:index+1,stage:display(step.stage)})}</Status><button className="icon-button" title={t("Close transfer detail")} aria-label={t("Close transfer detail")} onClick={onClose}><X size={17}/></button></div>
    <strong>{money(step.amount,step.currency)}</strong>
    <p>{date(step.time,true)} · {utc(step.time)} UTC · {step.id}</p>
    <button {...helpAttrs('transfer')} className="transfer-party" onClick={()=>inspect(step.from)}><ArrowUpRight size={16}/><span><small>{t("Sender")}</small>{step.sender}</span></button>
    <button {...helpAttrs('transfer')} className="transfer-party" onClick={()=>inspect(step.to)}><ArrowDownLeft size={16}/><span><small>{t("Receiver")}</small>{step.receiver}</span></button>
  </div>
}

export function PatternRow({finding,action}:{finding:Finding;action:()=>void}) {
  const {display}=useText()
  return <button className="pattern-row" {...helpAttrs('finding')} onClick={action}>
    <span className="pattern-icon"><GitBranch size={17}/></span>
    <span className="pattern-info"><b>{display(finding.title)}</b><small>{finding.subject} · {date(finding.end)}</small></span>
    <Status kind={finding.score>=85?'warm':'neutral'}>{finding.score}/100</Status><ChevronRight size={15}/>
  </button>
}
