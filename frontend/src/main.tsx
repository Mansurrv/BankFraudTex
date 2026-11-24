import {useText, type TextKey} from './i18n/text'
import {LanguageSelect} from './i18n/LanguageSelect'
import {QueryClient, QueryClientProvider, keepPreviousData, useQuery, useQueryClient} from '@tanstack/react-query'
import {Activity, Bell, ChevronDown, ChevronRight, Command, Database, Fingerprint, FlaskConical, FolderOpen, GitBranch, LayoutDashboard, Menu, Network, Orbit, Radio, Settings as SettingsIcon, Sparkles, Waypoints} from 'lucide-react'
import {useEffect, useMemo, useRef, useState} from 'react'
import {createRoot} from 'react-dom/client'
import {ApiError, api, date, isConnectionError, url} from './api'
import {ErrorNote, GraphCard, Heading, Metrics, PatternRow, SearchBox, Timeline} from './components'
import {ContextPanel, Investigator, SimulationForm, StoryContent} from './Intelligence'
import {Starfield} from './Starfield'
import {useOrbit} from './state'
import {GuideLayer, HelpButton} from './guide/Guide'
import {helpAttrs,type Feature} from './guide/content'
import type {Journey, TourStep} from './guide/journeys'
import {useGuide} from './guide/state'
import type {Bootstrap, Finding, Graph, Story, View} from './types'
import {AccountManagement, Behavior, DataSources, Login, Overview, Radar, Relationships, Settings, TemporalComparison, Workspace} from './Views'
import './styles.css'

const sections=[
  {title:'Workspace', items:[
    {id:'overview', label:'Overview',icon:LayoutDashboard},{id:'universe',label:'Universe Explorer',icon:Orbit},
    {id:'stories',label:'Money Flow Stories',icon:Waypoints}]},
  {title:'Intelligence',items:[
    {id:'behavior',label:'Behavior Intelligence',icon:Fingerprint},{id:'relationships',label:'Relationship Discovery',icon:GitBranch},
    {id:'radar',label:'Anomaly Radar',icon:Radio},{id:'investigator',label:'AI Investigator',icon:Sparkles}]},
  {title:'Operations',items:[
    {id:'simulation',label:'Simulation Lab',icon:FlaskConical},{id:'workspace',label:'Investigation Workspace',icon:FolderOpen},
    {id:'data',label:'Data Sources',icon:Database},{id:'settings',label:'Settings',icon:SettingsIcon}]}
] as const
const titles=Object.fromEntries(sections.flatMap(s=>s.items.map(n=>[n.id,n.label]))) as Record<View,TextKey>

const viewHelp:Record<View,Feature> = {
  overview:'dashboard', universe:'graph', stories:'flow', behavior:'behavior', relationships:'relationships',
  radar:'patterns', investigator:'investigator', simulation:'simulation', workspace:'cases', data:'data', settings:'settings'
}

function Logo({brand='FFBI'}:{brand?:string}) {
  return <span className="logo">
    <img className="logo-mark" src="/orbit-mark.svg" alt=""/>
    <span>{brand}</span>
  </span>
}

function App() {
  const {t,display,language}=useText()
  const client=useQueryClient()
  const guideActive=useGuide(s=>Boolean(s.active))
  const {view,patch,overview,showFinding,selected,finding:findingID,panel,layout,community,after,before,expands,hidden,playing,step,sim,simActive,guided}=useOrbit()
  const [login,setLogin]=useState(false)
  const [mobile,setMobile]=useState(false)
  const [popover,setPopover]=useState<'notifications'|'profile'|null>(null)
  const headerRef=useRef<HTMLDivElement>(null)
  const initialized=useRef(false)
  const boot=useQuery({
    queryKey:['bootstrap'],
    queryFn:({signal})=>api<Bootstrap>('bootstrap',undefined,{signal}),
    retry:(failures,error)=>failures<7&&isConnectionError(error),
    retryDelay:attempt=>Math.min(1200+attempt*1000,5000),
  })
  const data=boot.data
  const platformAdmin=data?.user.role==='platform administrator'
  const brand=data?.brand==='ORBIT'?undefined:data?.brand
  const summary=data?.summary
  const finding=summary?.findings.find(f=>f.id===findingID)
  const graphView=!platformAdmin&&['universe','stories','simulation'].includes(view)
  const graphURL=url('graph',{finding:findingID,focus:selected===finding?.subject?'':selected,layout,community,after,before,expand:expands.join(','),hide:hidden.join(','),limit:Math.min(144,38+expands.length*8)})
  const graph=useQuery({queryKey:['graph',graphURL],queryFn:()=>api<Graph>(graphURL),enabled:!!data&&graphView,placeholderData:keepPreviousData})
  const story=useQuery({queryKey:['story',findingID],queryFn:()=>api<Story>('stories/'+findingID),enabled:!!data&&!!findingID&&graphView})
  const active=story.data?.steps[step]
  const shown=simActive&&sim?sim.graph:graph.data
  const outsideRange=finding&&(before&&before<finding.start.slice(0,10)||after&&after>finding.end.slice(0,10))
  const visibleFinding=outsideRange?undefined:finding
  const names=useMemo(()=>new Map((shown?.nodes??[]).map(n=>[n.id,n.name])),[shown])
  const openFinding=(f:Finding)=>{
    showFinding(f.id,f.subject)
    patch({view:'universe',guided:false})
    setPopover(null);setMobile(false)
  }
  useEffect(()=>{
    if(!data||platformAdmin)return
    document.title=(brand??'FFBI')+' '+t('Financial Intelligence')
    if(!initialized.current){
      const f=data.summary.findings[0]
      if(f)patch({finding:f.id,selected:f.subject})
      else if(!data.summary.transactions&&data.user.role!=='auditor')patch({view:'data'})
      initialized.current=true
    }
  },[data,brand,patch,language,platformAdmin])
  useEffect(()=>{document.documentElement.lang=language},[language])
  useEffect(()=>{
    if(!data||platformAdmin)return
    let first=true
    const events=new EventSource('/api/events')
    events.addEventListener('ledger',()=>{
      if(first){first=false;return}
      void client.invalidateQueries()
    })
    return ()=>events.close()
  },[!!data,client,platformAdmin])
  useEffect(()=>{
    if(!playing||!summary)return
    const timer=window.setTimeout(()=>{
      if(story.data?.steps.length) {
        if(step>=story.data.steps.length-1)patch({playing:false})
        else patch({step:step+1})
      } else if(!findingID) {
        const index=summary.buckets.findIndex(b=>b.date===before)
        if(index<0||index>=summary.buckets.length-1)patch({playing:false})
        else patch({before:summary.buckets[index+1].date})
      }
    },story.data?.steps.length?1700:800)
    return ()=>clearTimeout(timer)
  },[playing,step,summary,story.data,before,patch,findingID])
  useEffect(()=>{
    const listener=(event:PointerEvent)=>{
      if(!headerRef.current?.contains(event.target as Node))setPopover(null)
    }
    const keyboard=(event:KeyboardEvent)=>{
      if(event.key==='Escape'){patch({large:false});setPopover(null);setMobile(false)}
    }
    document.addEventListener('pointerdown',listener)
    document.addEventListener('keydown',keyboard)
    return ()=>{document.removeEventListener('pointerdown',listener);document.removeEventListener('keydown',keyboard)}
  },[patch])
  const navigate=(next:View)=>{
    setMobile(false);setPopover(null)
    if(next===view)return
    patch({view:next,playing:false,simActive:false,...(next==='stories'?{panel:'story'}:next==='simulation'?{panel:'simulation'}:next==='universe'?{panel:'finding'}:{})})
    window.scrollTo({top:0,behavior:'instant'})
    document.querySelector('.app-shell')?.scrollTo({top:0,behavior:'instant'})
  }

  const rapid=summary?.findings.find(f=>f.kind==='rapid')
  function prepareGuide(lesson:TourStep,journey:Journey,demoFinding:Finding|undefined,demoStory:Story|undefined) {
    navigate(lesson.view)
    if(lesson.setup==='overview')return
    if(lesson.setup==='history'){
      overview()
      return
    }
    const f=journey==='demo'?demoFinding:finding??rapid??summary?.findings[0]
    if(!f)return
    if(lesson.setup==='case'){
      if(f.id!==findingID)showFinding(f.id,f.subject)
      return
    }
    showFinding(f.id,f.subject)
    const firstCredit=demoStory?.steps.find(t=>t.to===f.subject)
    const firstDebit=demoStory?.steps.find(t=>t.from===f.subject)
    if(lesson.setup==='account')patch({panel:'entity'})
    if(lesson.setup==='intermediary')patch({panel:'entity',selected:firstDebit?.to??f.subject})
    if(lesson.setup==='credit'&&firstCredit)patch({panel:'transaction',tx:firstCredit.id})
    if(lesson.setup==='debit'&&firstDebit)patch({panel:'transaction',tx:firstDebit.id})
    if(lesson.setup==='story')patch({panel:'story'})
    if(lesson.setup==='simulation')patch({panel:'simulation'})
  }

  const signOut=async()=>{
    try {
      await api('logout',{})
      initialized.current=false
      overview()
      client.removeQueries({predicate:q=>q.queryKey[0]!=='bootstrap'})
      await boot.refetch()
    } finally {
      setPopover(null)
    }
  }

  if(boot.error instanceof ApiError&&boot.error.status===401)return <Login initial close={()=>{}} onSuccess={()=>{void boot.refetch()}}/>
  if(!data) {
    return <div className="boot-screen"><Logo/><div role="status">{boot.isFetching?t('Opening financial workspace…'):<><ErrorNote error={boot.error}/><button className="secondary" onClick={()=>void boot.refetch()}>{t("Retry connection")}</button></>}</div></div>
  }
  if(platformAdmin)return <>
    <header className="top-header">
      <Logo brand={brand}/>
      <div className="header-actions"><LanguageSelect compact/><button className="secondary" onClick={()=>void signOut()}>{t("Sign out")}</button></div>
    </header>
    <main className="main-content">
      <Heading title={t("Account management")} description={data.user.name}/>
      {data.managedRole&&<AccountManagement key={data.user.name} role={data.managedRole} user={data.user}/>}
    </main>
  </>
  const source=data.summary
  const profileName=data.user.name
  const profileInitials=profileName.split(' ').slice(0,2).map(x=>x[0]?.toUpperCase()).join('')
  return <div className="app-shell" data-orbit-tour={guideActive?'active':undefined}>
    <aside className={'sidebar '+(mobile?'mobile-open':'')}>
      <button className="logo-button" aria-label={t('Home — {brand}',{brand:brand??'FFBI'})} onClick={()=>navigate('universe')}><Logo brand={brand}/></button>
      <nav aria-label={t("Workspace navigation")}>{sections.map(section=><div className="nav-group" key={section.title}><div className="nav-label">{t(section.title)}</div>
        {section.items.map(({id,label,icon:Icon})=><button key={id} {...helpAttrs(viewHelp[id])} onClick={()=>navigate(id)} className={view===id?'active':''} aria-current={view===id?'page':undefined}>
          <Icon size={18}/><span>{t(label)}</span>{view===id&&<span className="nav-indicator"/>}
        </button>)}</div>)}</nav>
    </aside>
    {mobile&&<button className="mobile-cover" onClick={()=>setMobile(false)} aria-label={t("Close navigation")}/>}
    <div className="app-main">
      <header className="top-header" ref={headerRef}>
        <div className="breadcrumbs"><button className="icon-button mobile-menu" aria-label={t("Open navigation")} onClick={()=>setMobile(m=>!m)}><Menu size={21}/></button><span className="breadcrumb-text">{t("Workspace")}</span><ChevronRight size={14}/><strong>{t(titles[view])}</strong></div>
        <SearchBox/>
        <div className="header-actions">
          <LanguageSelect compact/>
          <HelpButton/>
          <button className={'header-icon '+(popover==='notifications'?'active':'')} title={t("Review notifications")} aria-label={t("Review notifications")} aria-expanded={popover==='notifications'} onClick={()=>setPopover(p=>p==='notifications'?null:'notifications')}><Bell size={19}/>{source.findings.length>0&&<i/>}</button>
          <span className="header-divider"/>
          <button className="profile" aria-label={t("Account menu")} aria-expanded={popover==='profile'} onClick={()=>setPopover(p=>p==='profile'?null:'profile')}><span className="avatar">{profileInitials}</span><span className="profile-name"><b>{profileName}</b><small>{display(data.user.role==='administrator'?'Bank administrator':data.user.role)}</small></span><ChevronDown size={14}/></button>
        </div>
        {popover==='notifications'&&<div className="header-popover"><h3>{t("Review notifications")}</h3>{source.findings.slice(0,5).map(f=><PatternRow key={f.id} finding={f} action={()=>openFinding(f)}/>)}</div>}
        {popover==='profile'&&<div className="header-popover profile-popover"><h3>{profileName}</h3><button onClick={()=>{setLogin(true);setPopover(null)}}>{t("Switch account")}</button><button onClick={()=>navigate('settings')}>{t("Preferences")}</button><button onClick={()=>void signOut()}>{t("Sign out")}</button></div>}
      </header>
      <main className={'main-content '+(graphView?'network-page':'')} aria-label={t(titles[view])}>
        {graphView&&<>
          <Heading title={t(titles[view])} help={viewHelp[view]} description={
            view==='universe'?t('Explore money movement and relationships across the financial network.'):
            view==='stories'?t('Follow each observed transfer through the selected network.'):
            t('Test changes to a finding and compare how connectivity shifts.')
          } actions={<>{source.transactions>0&&<span className="date-chip"><Activity size={15}/>{date(source.start)} – {date(source.end,true)}</span>}<button className="secondary workspace-button" onClick={()=>navigate('data')}><Database size={15}/> {t("Data sources")}</button></>}/>
          {view==='universe'&&<Metrics summary={source} onFindings={()=>navigate('radar')}/>}
          <div className="network-grid">
            <div className="network-column">
              <GraphCard graph={shown} finding={visibleFinding} guideFinding={source.findings[0]} active={active} loading={graph.isFetching} error={graph.error}/>
              {source.buckets.length>0&&<Timeline summary={source} story={story.data}/>}
            </div>
            <ContextPanel finding={finding} findings={source.findings} story={story.data} names={names} onCase={()=>navigate('workspace')}/>
          </div>
          {view==='stories'&&<section className="surface below-map" data-guide-target="story-sequence"><div className="section-top"><h2>{t("Money flow story")}</h2><select {...helpAttrs('flow')} aria-label={t("Select a flow finding")} value={findingID} onChange={e=>{const next=source.findings.find(f=>f.id===e.target.value);if(next){showFinding(next.id,next.subject);patch({panel:'story'})}}}><option value="">{t("Select a finding")}</option>{source.findings.map(f=><option key={f.id} value={f.id}>{display(f.title)} · {f.subject}</option>)}</select></div>
          <ErrorNote error={story.error}/><StoryContent story={story.data} detailed/></section>}
          {view==='simulation'&&panel!=='simulation'&&<section className="surface below-map"><h2>{t("What-if scenario")}</h2><SimulationForm finding={finding} names={names} expanded/></section>}
          {view==='universe'&&before&&<div className="below-map"><TemporalComparison subject={selected}/></div>}
        </>}
        {view==='overview'&&<Overview summary={source} user={data.user} openFinding={openFinding} onFindings={()=>navigate('radar')}/>}
        {view==='radar'&&<Radar summary={source} openFinding={openFinding}/>}
        {view==='behavior'&&<Behavior finding={finding}/>}
        {view==='relationships'&&<Relationships finding={finding}/>}
        {view==='investigator'&&<><Heading title={t("AI Investigator")} help="investigator" description={t("Ask a question about the selected account or finding. Responses cite the underlying records.")}/><section className="surface"><Investigator finding={finding} full/></section></>}
        {view==='workspace'&&<Workspace key={data.user.name} finding={finding} user={data.user}/>}
        {view==='data'&&<DataSources summary={source} user={data.user}/>}
        {view==='settings'&&<Settings user={data.user} managedRole={data.managedRole} onLogin={()=>setLogin(true)}/>}
      </main>
    </div>
    <GuideLayer brand={brand??'FFBI'} prepare={prepareGuide}/>
    {login&&<Login close={()=>setLogin(false)} onSuccess={()=>{setLogin(false);client.removeQueries({predicate:q=>q.queryKey[0]!=='bootstrap'});void client.invalidateQueries({queryKey:['bootstrap']})}}/>}
  </div>
}

const client=new QueryClient({defaultOptions:{queries:{staleTime:25_000,retry:1,refetchOnWindowFocus:false}}})
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={client}><Starfield/><App/></QueryClientProvider>)
