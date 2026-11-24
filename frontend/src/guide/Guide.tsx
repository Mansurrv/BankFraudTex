import {useQuery} from '@tanstack/react-query'
import {BookOpen, ChevronLeft, ChevronRight, CircleHelp, Crosshair, GitBranch, Play, Search, X} from 'lucide-react'
import {useEffect, useId, useLayoutEffect, useRef, useState} from 'react'
import type {ReactNode} from 'react'
import {createPortal} from 'react-dom'
import {api} from '../api'
import {LanguageSelect} from '../i18n/LanguageSelect'
import type {Finding, Story} from '../types'
import {controls, featureCopy, local, topicFor, topics} from './content'
import type {Feature, Level, Topic} from './content'
import {LearningDiagram} from './Diagrams'
import {journeys} from './journeys'
import type {Journey, TourStep} from './journeys'
import {useGuide} from './state'
import {glossary, questions, strings} from './strings'
import './guide.css'

function useCopy() {
  return local(strings,useGuide(s=>s.language))
}

export function GuidePreferences() {
  const {language,level,levelSet}=useGuide()
  const copy=local(strings,language)
  return <div className="guide-preferences">
    <LanguageSelect label={copy.language}/>
    <label>{copy.level}<select value={level} onChange={event=>levelSet(event.target.value as Level)}>
      <option value="beginner">{copy.beginner}</option><option value="advanced">{copy.advanced}</option>
    </select></label>
  </div>
}

export function GuideSettings() {
  const copy=useCopy()
  const {launch,openHelp,progress}=useGuide()
  return <section className="surface settings guide-settings">
    <h2>{copy.preferences}</h2>
    <GuidePreferences/>
    <div className="guide-settings-actions">
      <button className="secondary" onClick={()=>launch('tour')}>{copy.restart}</button>
      {progress.tour&&<button className="secondary" onClick={()=>launch('tour',true)}>{copy.resume}</button>}
      <button className="text-link" onClick={()=>openHelp()}>{copy.center}</button>
    </div>
  </section>
}

export function HelpButton() {
  const copy=useCopy()
  const open=useGuide(s=>s.openHelp)
  return <button className="header-icon guide-entry" onClick={()=>open()} title={copy.center} aria-label={copy.help} aria-haspopup="dialog">
    <CircleHelp size={18}/><span>{copy.help}</span>
  </button>
}

export function HelpHint({feature}:{feature:Feature}) {
  const language=useGuide(s=>s.language)
  const open=useGuide(s=>s.openHelp)
  const title=featureCopy(feature,language).title
  return <button className="guide-help-icon" type="button" data-help={feature} aria-haspopup="dialog"
    aria-label={local(strings,language).explanation.replace('{feature}',title)} onClick={()=>open(feature)}><CircleHelp size={15}/></button>
}

function Faq() {
  const language=useGuide(s=>s.language)
  return <div className="guide-faq">
    {local(questions,language).map(([question,answer])=><details key={question}><summary>{question}</summary><p>{answer}</p></details>)}
  </div>
}

export function FeatureExplanation({feature}:{feature:Feature}) {
  const {language,level}=useGuide()
  const copy=local(strings,language)
  const lesson=featureCopy(feature,language)
  const topic=topics[topicFor(feature)]
  return <article className="guide-explanation">
    <h3>{lesson.title}</h3>
    <p>{lesson.what}</p>
    <dl>
      <div><dt>{copy.why}</dt><dd>{lesson.why}</dd></div>
      <div><dt>{copy.how}</dt><dd>{lesson.how}</dd></div>
    </dl>
    {level==='advanced'?<p className="guide-advanced"><b>{copy.more}</b>{lesson.advanced}</p>:
      <details><summary>{copy.more}</summary><p>{lesson.advanced}</p></details>}
    {'diagram' in topic&&<LearningDiagram key={topic.diagram} kind={topic.diagram}/>}
    {feature==='patterns'&&<details><summary>{copy.morePatterns}</summary><LearningDiagram kind="split"/></details>}
    {feature==='faq'&&<Faq/>}
  </article>
}

function GuideDialog({children,className,title,onClose}:{children:ReactNode;className:string;title:string;onClose:()=>void}) {
  const ref=useRef<HTMLDialogElement>(null)
  const titleID=useId()
  const copy=useCopy()
  useLayoutEffect(()=>{
    const dialog=ref.current
    dialog?.showModal()
    return ()=>{if(dialog?.open)dialog.close()}
  },[])
  return <dialog ref={ref} className={'guide-dialog '+className} aria-labelledby={titleID}
    onCancel={event=>{event.preventDefault();onClose()}}>
    <header className="guide-dialog-head">
      <div className="guide-dialog-title"><BookOpen size={19}/><h2 id={titleID} tabIndex={-1} autoFocus>{title}</h2></div>
      <button className="icon-button" type="button" onClick={onClose} aria-label={copy.close}><X size={20}/></button>
    </header>
    {children}
  </dialog>
}

function OnboardingWelcome({brand,demoAvailable}:{brand:string;demoAvailable:boolean}) {
  const copy=useCopy()
  const {launch,skip}=useGuide()
  return <GuideDialog title={copy.welcome.replace('{brand}',brand)} className="guide-welcome" onClose={skip}>
    <div className="welcome-body">
      <span className="welcome-symbol"><img className="logo-mark" src="/orbit-mark.svg" alt=""/></span>
      <p>{copy.intro}</p>
      <GuidePreferences/>
      <div className="welcome-actions">
        <button className="primary" onClick={()=>launch('tour')}><Play size={16}/>{copy.start}</button>
        {demoAvailable&&<button className="secondary" onClick={()=>launch('demo')}><GitBranch size={16}/>{copy.demo}</button>}
      </div>
      <button className="text-link welcome-skip" onClick={skip}>{copy.skip}</button>
    </div>
  </GuideDialog>
}

function FeatureGlossary({query}:{query:string}) {
  const language=useGuide(s=>s.language)
  const entries=local(glossary,language).filter(entry=>!query||includesWords(entry.join(' '),query))
  if(!entries.length)return null
  return <details className="guide-glossary" open={query?true:undefined}>
    <summary>{local(strings,language).glossary}</summary>
    <dl>{entries.map(([name,definition])=><div key={name}><dt>{name}</dt><dd>{definition}</dd></div>)}</dl>
  </details>
}

const searchable=(value:string)=>value.toLowerCase().replaceAll('ё','е').trim()
function includesWords(text:string,query:string) {
  const words=query.match(/[\p{L}\p{N}]+/gu)??[]
  const haystack=searchable(text)
  return words.every(word=>haystack.includes(word))
}
const topicIDs=Object.keys(topics) as Topic[]
const featureIDs=[...topicIDs,...Object.keys(controls) as (keyof typeof controls)[]]

function HelpCenter({initial,demoAvailable}:{initial:Feature;demoAvailable:boolean}) {
  const {language,launch,closeHelp,progress,pickHelp}=useGuide()
  const copy=local(strings,language)
  const [input,setInput]=useState('')
  const [selected,setSelected]=useState<Feature>(initial)
  const query=searchable(input)
  const matches=query?featureIDs.filter(id=>{
    const english=Object.values(featureCopy(id,'en')).join(' ')
    const translated=Object.values(featureCopy(id,language)).join(' ')
    const faq=id==='faq'?local(questions,language).flat().join(' '):''
    return includesWords(english+' '+translated+' '+faq,query)
  }):topicIDs
  const active=query?(matches.includes(selected)?selected:matches[0]):selected
  return <GuideDialog title={copy.center} onClose={closeHelp} className="guide-center">
    <div className="guide-center-tools">
      <label className="guide-search"><Search size={18}/><input type="search" aria-label={copy.search} placeholder={copy.searchPlaceholder}
        value={input} onChange={event=>setInput(event.target.value)}/></label>
      <GuidePreferences/>
    </div>
    <div className="guide-center-layout">
      <nav aria-label={copy.topics} className="guide-topic-list">
        {matches.map(id=><button type="button" key={id} className={id===active?'current':''} aria-current={id===active?'page':undefined}
          onClick={()=>setSelected(id)}>{featureCopy(id,language).title}</button>)}
      </nav>
      <div className="guide-content">
        {active?<FeatureExplanation feature={active}/>:<p className="guide-muted" role="status">{copy.noResults}</p>}
        <FeatureGlossary query={query}/>
      </div>
    </div>
    <footer className="guide-center-footer">
      <div className="guide-footer-tour">
        <button className="primary" onClick={()=>launch('tour',Boolean(progress.tour))}><Play size={15}/>{progress.tour?copy.resume:copy.start}</button>
        {progress.tour&&<button className="text-link" onClick={()=>launch('tour')}>{copy.restart}</button>}
        <button className="text-link" onClick={pickHelp}><Crosshair size={14}/>{copy.pick}</button>
      </div>
      {demoAvailable&&<div className="guide-demo-option">
        <button className="secondary" disabled={!demoAvailable} onClick={()=>launch('demo',Boolean(progress.demo))}>
          <GitBranch size={16}/>{progress.demo?copy.resumeDemo:copy.demoName}
        </button>
        <small>{demoAvailable?copy.demoDescription:copy.demoUnavailable}</small>
        {progress.demo&&demoAvailable&&<button className="text-link" onClick={()=>launch('demo')}>{copy.restartDemo}</button>}
      </div>}
    </footer>
  </GuideDialog>
}

function findTarget(key:string) {
  return Array.from(document.querySelectorAll<HTMLElement>('[data-guide-target="'+key+'"]')).find(element=>{
    const rect=element.getBoundingClientRect()
    return rect.width>0&&rect.height>0&&getComputedStyle(element).visibility==='visible'
  })??null
}

type Position = {left:number;top:number;width:number;height:number}
function samePosition(a:Position|null,b:Position|null) {
  return a===b||Boolean(a&&b&&a.left===b.left&&a.top===b.top&&a.width===b.width&&a.height===b.height)
}

function useSpotlight(step:TourStep) {
  const target=useRef<HTMLElement|null>(null)
  const [position,setPosition]=useState<Position|null>(null)
  const [found,setFound]=useState(false)
  const [fallback,setFallback]=useState(false)
  useLayoutEffect(()=>{
    let scheduled=0
    let initial=true
    const shell=document.querySelector('.app-shell')
    const shellResize=new ResizeObserver(schedule)
    if(shell)shellResize.observe(shell)
    const resize=new ResizeObserver(schedule)
    function update() {
      scheduled=0
      const preferred=findTarget(step.target)
      const element=preferred??(step.fallback?findTarget(step.fallback):null)
      setFound(Boolean(element))
      setFallback(!preferred&&Boolean(element))
      if(element!==target.current){
        resize.disconnect()
        if(element)resize.observe(element)
        target.current=element
      }
      let next:Position|null=null
      if(element){
        let rect=element.getBoundingClientRect()
        const bounds=document.fullscreenElement?null:shell?.getBoundingClientRect()
        const h=Math.min(window.innerHeight,bounds?.bottom??window.innerHeight)
        if(initial){
          if(rect.top<0||rect.top>h*.53||rect.bottom>h&&rect.height<h*.55)element.scrollIntoView({block:'start'})
          rect=element.getBoundingClientRect()
          initial=false
        }
        const left=Math.max(3,Math.round(rect.left-5))
        const top=Math.max(3,Math.round(rect.top-5))
        const right=Math.min(window.innerWidth-3,(bounds?.right??window.innerWidth)+2,Math.round(rect.right+5))
        const bottom=Math.min(h-3,Math.round(rect.bottom+5))
        if(right>left&&bottom>top)next={left,top,width:right-left,height:bottom-top}
      }
      setPosition(old=>samePosition(old,next)?old:next)
    }
    function schedule(){
      if(!scheduled)scheduled=requestAnimationFrame(update)
    }
    update()
    const observer=new MutationObserver(schedule)
    if(shell)observer.observe(shell,{subtree:true,childList:true})
    window.addEventListener('scroll',schedule,true)
    window.addEventListener('resize',schedule)
    return ()=>{
      cancelAnimationFrame(scheduled);resize.disconnect();shellResize.disconnect();observer.disconnect()
      window.removeEventListener('scroll',schedule,true)
      window.removeEventListener('resize',schedule)
      target.current=null
    }
  },[step])
  return {target,position,found,fallback}
}

function GuidedTour({journey,step,onPrepare}:{journey:Journey;step:TourStep;onPrepare:()=>void}) {
  const {language,level,move,pause,openHelp}=useGuide()
  const copy=local(strings,language)
  const [title,action,next]=local(step.copy,language)
  const lesson=featureCopy(step.feature,language)
  const index=journeys[journey].indexOf(step)
  const total=journeys[journey].length
  const {target,position,found,fallback}=useSpotlight(step)
  const [host,setHost]=useState<Element>(()=>document.fullscreenElement??document.body)
  const [showMissing,setShowMissing]=useState(false)
  const card=useRef<HTMLElement>(null)
  const titleID=useId()
  const titleRef=useRef<HTMLHeadingElement>(null)
  useLayoutEffect(()=>{
    const element=card.current
    const shell=document.querySelector<HTMLElement>('.app-shell')
    if(!element||!shell)return
    const update=()=>{
      const height=Math.ceil(element.getBoundingClientRect().height)+16+'px'
      shell.style.setProperty('--guide-dock-height',height)
      if(host instanceof HTMLElement&&host!==document.body)host.style.setProperty('--guide-dock-height',height)
    }
    update()
    const observer=new ResizeObserver(update)
    observer.observe(element)
    return ()=>{
      observer.disconnect()
      shell.style.removeProperty('--guide-dock-height')
      if(host instanceof HTMLElement)host.style.removeProperty('--guide-dock-height')
    }
  },[host])
  useEffect(()=>{
    setShowMissing(false)
    if(found)return
    const timer=window.setTimeout(()=>setShowMissing(true),550)
    return ()=>window.clearTimeout(timer)
  },[found,step])
  useLayoutEffect(()=>{
    const previous=document.activeElement
    return ()=>{
      const trigger=previous instanceof HTMLElement&&previous.isConnected?previous:document.querySelector<HTMLElement>('.guide-entry')
      trigger?.focus({preventScroll:true})
    }
  },[])
  useLayoutEffect(()=>{titleRef.current?.focus({preventScroll:true})},[step])
  useEffect(()=>{
    const change=()=>setHost(document.fullscreenElement??document.body)
    const key=(event:KeyboardEvent)=>{
      if(event.defaultPrevented)return
      if(event.key==='Escape')pause()
      if(card.current?.contains(event.target as Node)&&['ArrowLeft','ArrowRight'].includes(event.key)){
        event.preventDefault()
        move(event.key==='ArrowLeft'?-1:1)
      }
    }
    document.addEventListener('fullscreenchange',change)
    document.addEventListener('keydown',key)
    return ()=>{document.removeEventListener('fullscreenchange',change);document.removeEventListener('keydown',key)}
  },[pause,move])
  const locate=()=>{
    if(!target.current){onPrepare();return}
    target.current.scrollIntoView({block:'start'})
    const control=target.current.matches('input,button,select,a,summary,[tabindex]')?target.current:
      target.current.querySelector<HTMLElement>('input,button:not(.guide-help-icon),select,a,summary,[tabindex]')
    control?.focus({preventScroll:true})
  }
  return createPortal(<div className="guide-tour-root" lang={language}>
    {position&&<div className="guide-spotlight" style={position} aria-hidden="true"/>}
    <section className="guide-tour-card" ref={card} aria-labelledby={titleID} aria-roledescription={copy.tour}>
      <div className="guide-tour-top">
        <span><BookOpen size={15}/>{journey==='tour'?copy.tour:copy.demoName}</span>
        <button type="button" className="icon-button" aria-label={copy.pause} onClick={pause}><X size={18}/></button>
      </div>
      <div className="guide-tour-progress"><span>{copy.step} {index+1} {copy.of} {total}</span>
        <progress value={index+1} max={total} aria-label={copy.step}/></div>
      <div className="guide-tour-body">
        <h2 id={titleID} ref={titleRef} tabIndex={-1}>{title}</h2>
        <p>{lesson.what}</p>
        <p><b>{copy.why}</b> {lesson.why}</p>
        <p><b>{copy.task}</b> {action}</p>
        <p><b>{copy.result}</b> {next}</p>
        {!found&&showMissing&&<p className="guide-target-message" role="status">{copy.waiting}</p>}
        <div className="guide-tour-links">
          <button type="button" className="text-link" onClick={found?locate:onPrepare}><Crosshair size={14}/>{!found&&showMissing?copy.returnToStep:copy.locate}</button>
          <button type="button" className="text-link" onClick={()=>openHelp(step.feature)}>{level==='advanced'?copy.more:copy.help}</button>
          {fallback&&<button type="button" className="text-link" onClick={onPrepare}>{copy.returnToStep}</button>}
        </div>
      </div>
      <footer className="guide-tour-actions">
        <button className="secondary" disabled={index===0} onClick={()=>move(-1)}><ChevronLeft size={15} aria-hidden="true"/>{copy.previous}</button>
        <button className="primary" onClick={()=>move(1)}>{index+1===total?copy.finish:copy.next}{index+1<total&&<ChevronRight size={15} aria-hidden="true"/>}</button>
      </footer>
    </section>
  </div>,host)
}

function HelpTooltip({suspended}:{suspended:boolean}) {
  const language=useGuide(s=>s.language)
  const level=useGuide(s=>s.level)
  const id=useId()
  const tooltip=useRef<HTMLDivElement>(null)
  const [anchor,setAnchor]=useState<HTMLElement|null>(null)
  const [coordinates,setCoordinates]=useState({left:0,top:0})
  useEffect(()=>{
    if(suspended)return
    let timer:number|undefined
    let current:HTMLElement|null=null
    const annotated=(target:EventTarget|null)=>target instanceof HTMLElement||target instanceof SVGElement?
      target.closest<HTMLElement>('[data-help]'):null
    const show=(element:HTMLElement,delay:number)=>{
      window.clearTimeout(timer)
      if(current!==element)setAnchor(null)
      current=element
      timer=window.setTimeout(()=>setAnchor(element),delay)
    }
    const hide=()=>{window.clearTimeout(timer);current=null;setAnchor(null)}
    const over=(event:PointerEvent)=>{
      if(event.pointerType==='touch')return
      const element=annotated(event.target)
      if(element&&element!==current)show(element,480)
    }
    const out=(event:PointerEvent)=>{
      if(current&&annotated(event.target)===current&&!current.contains(event.relatedTarget as Node|null))hide()
    }
    const focus=(event:FocusEvent)=>{
      const element=annotated(event.target)
      if(element)show(element,160)
    }
    const key=(event:KeyboardEvent)=>{if(event.key==='Escape')hide()}
    document.addEventListener('pointerover',over)
    document.addEventListener('pointerout',out)
    document.addEventListener('focusin',focus)
    document.addEventListener('focusout',hide)
    document.addEventListener('click',hide)
    document.addEventListener('keydown',key)
    window.addEventListener('scroll',hide,true)
    return ()=>{
      window.clearTimeout(timer)
      document.removeEventListener('pointerover',over);document.removeEventListener('pointerout',out)
      document.removeEventListener('focusin',focus);document.removeEventListener('focusout',hide)
      document.removeEventListener('click',hide);document.removeEventListener('keydown',key)
      window.removeEventListener('scroll',hide,true)
    }
  },[suspended])
  useLayoutEffect(()=>{
    if(!anchor||!tooltip.current||suspended)return
    const rect=anchor.getBoundingClientRect()
    const {offsetWidth:w,offsetHeight:h}=tooltip.current
    const left=Math.max(8,Math.min(window.innerWidth-w-8,rect.left+(rect.width-w)/2))
    const top=rect.bottom+h+10<window.innerHeight?rect.bottom+7:Math.max(8,rect.top-h-7)
    setCoordinates({left,top})
    const prior=anchor.getAttribute('aria-describedby')
    anchor.setAttribute('aria-describedby',[prior,id].filter(Boolean).join(' '))
    return ()=>{if(prior)anchor.setAttribute('aria-describedby',prior);else anchor.removeAttribute('aria-describedby')}
  },[anchor,id,language,level,suspended])
  if(!anchor?.isConnected||suspended)return null
  const feature=anchor.dataset.help as Feature
  const copy=featureCopy(feature,language)
  return createPortal(<div id={id} ref={tooltip} className="guide-tooltip" role="tooltip" style={coordinates} lang={language}>
    <strong>{copy.title}</strong><span>{level==='advanced'?copy.advanced:copy.what}</span>
  </div>,document.fullscreenElement??document.body)
}

type Prepare = (step:TourStep,journey:Journey,finding:Finding|undefined,story:Story|undefined)=>void

export function GuideLayer({brand,rapid,prepare}:{brand:string;rapid?:Finding;prepare:Prepare}) {
  const {active,progress,help,seen,language,finished,clearNotice,picking,cancelPick,openHelp,pause}=useGuide()
  useEffect(()=>{if(active==='demo'&&!rapid)pause()},[active,rapid,pause])
  const story=useQuery({queryKey:['story',rapid?.id],queryFn:()=>api<Story>('stories/'+rapid!.id),enabled:active==='demo'&&!!rapid})
  const step=active?journeys[active].find(item=>item.id===progress[active]):undefined
  const needsStory=step&&['credit','debit','intermediary'].includes(step.setup)
  const data=needsStory?story.data:undefined
  const prepareRef=useRef(prepare)
  prepareRef.current=prepare
  const prepareStep=()=>{if(step&&active)prepareRef.current(step,active,rapid,data)}
  useEffect(prepareStep,[step,active,rapid?.id,data])
  useEffect(()=>{
    if(!finished)return
    const timer=window.setTimeout(clearNotice,6200)
    return ()=>window.clearTimeout(timer)
  },[finished,clearNotice])
  useEffect(()=>{
    if(!picking)return
    const select=(event:MouseEvent)=>{
      const target=event.target
      if(!(target instanceof Element))return
      const feature=target.closest<HTMLElement>('[data-help]')?.dataset.help as Feature|undefined
      if(!feature)return
      event.preventDefault()
      event.stopPropagation()
      openHelp(feature)
    }
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape')cancelPick()}
    document.addEventListener('click',select,true)
    document.addEventListener('keydown',escape)
    return ()=>{
      document.removeEventListener('click',select,true)
      document.removeEventListener('keydown',escape)
    }
  },[picking,cancelPick,openHelp])
  const welcome=!seen&&!help&&!active
  return <div lang={language} className="guide-layer">
    {welcome&&<OnboardingWelcome brand={brand} demoAvailable={Boolean(rapid)}/>}
    {help&&<HelpCenter key={help} initial={help} demoAvailable={Boolean(rapid)}/>}
    {active&&step&&<GuidedTour journey={active} step={step} onPrepare={prepareStep}/>}
    {picking&&<div className="notice guide-notice guide-picker"><span role="status">{local(strings,language).pickNotice}</span><button className="text-link" onClick={cancelPick}>{local(strings,language).cancelPick}</button></div>}
    {finished&&<div className="notice guide-notice" role="status">{local(strings,language).done}</div>}
    <HelpTooltip suspended={Boolean(help)||welcome}/>
  </div>
}
