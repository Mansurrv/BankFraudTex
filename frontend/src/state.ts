import {create} from 'zustand'
import type {Simulation,View} from './types'

export const layouts=['Communities','Force-directed','Hierarchical','Geography','Risk','Time']
export const kinds=['account','company','person','device','bank'] as const
export const colors={account:'#218876',company:'#7665d8',person:'#3b83b9',device:'#ab741c',bank:'#4f61a2'}
export const groups:Record<string,string>={'Meridian corridor':'#29967f','Retail services':'#477fd1','Wholesale trade':'#8269c2','Digital commerce':'#3b8e9d','Institutional banking':'#565fa7'}
export type Panel = 'finding'|'entity'|'story'|'ai'|'simulation'|'transaction'
type State = {
  view:View; finding:string; selected:string; focus:number; panel:Panel; tx:string; layout:string; community:string; after:string; before:string; expands:string[]; hidden:string[];
  large:boolean; guided:boolean; camera:'iso'|'front'|'top'; list:boolean; reduced:boolean; playing:boolean; step:number; sim:Simulation|null; simActive:boolean
  patch:(changes:Partial<Omit<State,'patch'|'inspect'|'showFinding'|'overview'>>)=>void;
  inspect:(id:string, focus?:boolean)=>void; showFinding:(id:string,subject:string)=>void; overview:()=>void;
}
export const useOrbit = create<State>((set)=>({
  view:'universe',finding:'',selected:'',focus:0,panel:'finding',tx:'',layout:'Communities',community:'',after:'',before:'',expands:[],hidden:[],
  large:false,guided:false,camera:'front',list:false,reduced:typeof matchMedia!=='undefined'&&matchMedia('(prefers-reduced-motion: reduce)').matches,playing:false,step:-1,sim:null,simActive:false,
  patch:(changes)=>set(changes),
  inspect:(id,focus=true)=>set(s=>({selected:id,focus:focus?s.focus+1:s.focus,panel:'entity',simActive:false})),
  showFinding:(id,subject)=>set(s=>({finding:id,selected:subject,focus:s.focus+1,panel:'finding',after:'',before:'',expands:[],hidden:[],playing:false,step:-1,sim:null,simActive:false,community:''})),
  overview:()=>set(s=>({finding:'',selected:'',focus:s.focus+1,panel:'finding',after:'',before:'',expands:[],hidden:[],playing:false,step:-1,sim:null,simActive:false,community:''}))
}))
