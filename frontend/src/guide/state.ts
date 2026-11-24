import {create} from 'zustand'
import {persist} from 'zustand/middleware'
import {journeys} from './journeys'
import type {Feature, Level, Locale} from './content'
import type {Journey} from './journeys'

type GuideState = {
  seen:boolean
  language:Locale
  level:Level
  progress:Partial<Record<Journey,string>>
  active:Journey|null
  help:Feature|null
  finished:boolean
  picking:boolean
  pickHelp:()=>void
  cancelPick:()=>void
  languageSet:(language:Locale)=>void
  levelSet:(level:Level)=>void
  skip:()=>void
  openHelp:(feature?:Feature)=>void
  closeHelp:()=>void
  launch:(journey:Journey,resume?:boolean)=>void
  move:(direction:number)=>void
  pause:()=>void
  clearNotice:()=>void
}

export const useGuide = create<GuideState>()(persist((set,get)=>({
  seen:false, language:'en', level:'beginner', progress:{},
  active:null, help:null, finished:false, picking:false,
  languageSet:language=>set({language}),
  levelSet:level=>set({level}),
  skip:()=>set({seen:true}),
  openHelp:(feature='start')=>set({seen:true,active:null,help:feature,finished:false,picking:false}),
  closeHelp:()=>set({help:null}),
  pickHelp:()=>set({help:null,picking:true}),
  cancelPick:()=>set({picking:false}),
  launch:(journey,resume=false)=>{
    const current=get().progress[journey]
    const id=resume&&journeys[journey].some(step=>step.id===current)?current:journeys[journey][0].id
    set(state=>({seen:true,active:journey,help:null,finished:false,picking:false,progress:{...state.progress,[journey]:id}}))
  },
  move:direction=>{
    const {active,progress}=get()
    if(!active)return
    const steps=journeys[active]
    const index=Math.max(0,steps.findIndex(step=>step.id===progress[active]))
    const next=index+direction
    if(next<0)return
    if(next>=steps.length){
      set({active:null,progress:{...progress,[active]:undefined},finished:true})
      return
    }
    set({progress:{...progress,[active]:steps[next].id}})
  },
  pause:()=>set({active:null}),
  clearNotice:()=>set({finished:false})
}),{
  name:'orbit-product-guide',
  version:1,
  partialize:({seen,language,level,progress})=>({seen,language,level,progress})
}))
