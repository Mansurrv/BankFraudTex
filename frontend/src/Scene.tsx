import {useText} from './i18n/text'
import {num} from './api'
import {OrbitControls} from '@react-three/drei'
import {Canvas, useFrame, useThree} from '@react-three/fiber'
import {Component, Suspense, useEffect, useMemo, useRef, useState} from 'react'
import type {ReactNode, RefObject} from 'react'
import * as THREE from 'three'
import type {OrbitControls as Controls} from 'three-stdlib'
import {Box, Building2, CircleDot, CreditCard, Crosshair, Landmark, List, Minus, Plus, Scan, Smartphone, UserRound} from 'lucide-react'
import {helpAttrs,type Control} from './guide/content'
import {colors, groups, kinds, useOrbit} from './state'
import {nodeModels, nodeRadius, nodeScale} from './nodeModels'
import type {Edge, Entity, Finding, Graph, Step} from './types'

const warm='#c65528'
const shapes={account:CreditCard,company:Building2,bank:Landmark,device:Smartphone,person:UserRound}
const kindLabels={account:'Account',company:'Company',bank:'Bank',device:'Device',person:'Person'}
const cone=new THREE.ConeGeometry(.066,.21,7)
const halo=new THREE.RingGeometry(.29,.304,48)
const innerHalo=new THREE.RingGeometry(.23,.235,48)
const dot=new THREE.SphereGeometry(.068,8,6)

class SceneBoundary extends Component<{children:ReactNode;fallback:ReactNode},{failed:boolean}> {
  state={failed:false}
  static getDerivedStateFromError(){return {failed:true}}
  render(){return this.state.failed?this.props.fallback:this.props.children}
}

function Node({n,selected,featured,active,quiet,onInspect,onHover}:{n:Entity;selected:boolean;featured:boolean;active:boolean;quiet:boolean;onInspect:(id:string,focus?:boolean)=>void;onHover:(id:string)=>void}) {
  const high=(n.score??0)>=85
  const c=featured||selected?warm:high?'#af4a50':n.kind==='account'?(groups[n.community]||colors.account):colors[n.kind]
  const scale=nodeScale(n,selected,featured)
  const setCursor=(next:boolean)=>{onHover(next?n.id:'');document.body.style.cursor=next?'pointer':''}
  return <group position={n.position}>
    <mesh geometry={nodeModels[n.kind]} scale={scale} onPointerOver={e=>{e.stopPropagation();setCursor(true)}} onPointerOut={()=>setCursor(false)}
      onClick={e=>{e.stopPropagation();onInspect(n.id,false)}} onDoubleClick={e=>{e.stopPropagation();onInspect(n.id,true)}}>
      <meshStandardMaterial vertexColors color={c} emissive={c} emissiveIntensity={selected?.19:featured?.11:quiet?.025:.06} metalness={.08} roughness={.59}/>
    </mesh>
    {(selected||active)&&<Halo color={c} scale={nodeRadius(n,selected,featured)*3.65}/>}
  </group>
}

function Halo({color,scale}:{color:string;scale:number}) {
  const ref=useRef<THREE.Group>(null)
  useFrame(({camera})=>ref.current?.quaternion.copy(camera.quaternion))
  return <group ref={ref} scale={scale}>
    <mesh geometry={halo}><meshBasicMaterial color={color} transparent opacity={.52} depthWrite={false} side={THREE.DoubleSide}/></mesh>
    <mesh geometry={innerHalo} scale={1.15}><meshBasicMaterial color={color} transparent opacity={.35} depthWrite={false} side={THREE.DoubleSide}/></mesh>
  </group>
}

function Strand({edge,a,b,hot,quiet,pulse,motion,onTransaction}:{edge:Edge;a:Entity;b:Entity;hot:boolean;quiet:boolean;pulse:boolean;motion:boolean;onTransaction:(id:string)=>void}) {
  const particle=useRef<THREE.Mesh>(null)
  const [hover,setHover]=useState(false)
  const shape=useMemo(()=>{
    const start=new THREE.Vector3(...a.position)
    const end=new THREE.Vector3(...b.position)
    const mid=start.clone().lerp(end,.5)
    mid.z+=Math.min(.5,start.distanceTo(end)*.1)
    mid.y+=edge.from<edge.to?.08:-.08
    const path=new THREE.QuadraticBezierCurve3(start,mid,end)
    const points=path.getPoints(16)
    const line=new THREE.BufferGeometry().setFromPoints(points.flatMap((point,i)=>i>0?[points[i-1],point]:[]))
    const tube=edge.highlight?new THREE.TubeGeometry(path,18,.009+.013*Math.min(1,edge.usd/160000),5,false):undefined
    const at=path.getPoint(.72)
    const orientation=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),path.getTangent(.72).normalize())
    return {path,line,tube,at,orientation}
  },[a,b,edge.from,edge.to,edge.highlight,edge.usd])
  useEffect(()=>()=>{shape.line.dispose();shape.tube?.dispose()},[shape])
  const color=pulse?'#a83e22':edge.highlight?warm:edge.usd===0?'#7990b0':groups[a.community]||'#61839a'
  const opacity=pulse?1:hot?.76:quiet?.13:edge.usd===0?.40:.33
  const animate=motion&&(pulse||hot&&edge.usd>0)
  useFrame(({clock})=>{
    if(animate && particle.current) {
      const offset=edge.from.charCodeAt(edge.from.length-1)*.017
      const p=(clock.elapsedTime*(pulse?.65:.22+edge.recency*.12)+offset)%1
      shape.path.getPoint(p,particle.current.position)
    }
  })
  return <group>
    <lineSegments
      onClick={e=>{if(!edge.transactions.length)return;e.stopPropagation();onTransaction(edge.transactions.at(-1)!)}}
      onPointerOver={e=>{if(!edge.transactions.length)return;e.stopPropagation();setHover(true);document.body.style.cursor='pointer'}}
      onPointerOut={()=>{setHover(false);document.body.style.cursor=''}}>
      <primitive object={shape.line} attach="geometry"/>
      <lineBasicMaterial color={color} transparent opacity={hover?1:opacity} depthWrite={false}/>
    </lineSegments>
    {shape.tube&&<mesh geometry={shape.tube}><meshBasicMaterial color={color} transparent opacity={pulse?.9:.45} depthWrite={false}/></mesh>}
    {edge.usd>0&&(hot||!quiet)&&<mesh position={shape.at} quaternion={shape.orientation} geometry={cone} scale={hot?1.05:.70}>
      <meshBasicMaterial color={color} transparent opacity={hot?.85:.38} depthWrite={false}/>
    </mesh>}
    {animate&&<mesh ref={particle} geometry={dot} scale={pulse?1.40:.73+.27*Math.min(1,edge.usd/150000)}><meshBasicMaterial color={pulse?'#823922':'#dd7a44'} transparent opacity={pulse?1:.78}/></mesh>}
  </group>
}

function Camera({graph,active,zoom}:{graph:Graph;active?:Step;zoom:number}) {
  const {camera,viewport,invalidate}=useThree()
  const controls=useRef<Controls>(null)
  const {selected,focus,camera:preset,reduced,playing}=useOrbit()
  const moving=useRef(false)
  const desired=useRef({target:new THREE.Vector3(),position:new THREE.Vector3()})
  const previousZoom=useRef(zoom)
  const graphRef=useRef(graph)
  graphRef.current=graph
  const selectedPosition=graph.nodes.find(n=>n.id===selected)?.position.join(",")
  const activeRef=useRef(active)
  activeRef.current=active
  useEffect(()=>{
    if(!controls.current) return
    const node=graphRef.current.nodes.find(n=>n.id===selected)
    const step=activeRef.current
    const a=step&&graphRef.current.nodes.find(n=>n.id===step.from)
    const b=step&&graphRef.current.nodes.find(n=>n.id===step.to)
    const center=playing&&a&&b?new THREE.Vector3(...a.position).lerp(new THREE.Vector3(...b.position),.43):
      node && focus>0 ? new THREE.Vector3(...node.position).multiplyScalar(.61):new THREE.Vector3(0,0,0)
    const distance=viewport.aspect<1.1?24:19
    const view=preset==='iso'?new THREE.Vector3(6,5,distance):preset==='top'?new THREE.Vector3(0,distance,.8):new THREE.Vector3(.65,.50,distance)
    if(node&&focus>0) view.multiplyScalar(.83)
    desired.current={target:center,position:view.add(center)}
    moving.current=true
    invalidate()
  },[focus,preset,viewport.aspect,active?.id,playing,selectedPosition,invalidate])
  useEffect(()=>{
    if(previousZoom.current===zoom||!controls.current)return
    const center=controls.current.target.clone()
    const vector=camera.position.clone().sub(center)
    vector.multiplyScalar(zoom>previousZoom.current?.82:1.22)
    vector.setLength(Math.max(5,Math.min(60,vector.length())))
    desired.current={target:center,position:vector.add(center)}
    previousZoom.current=zoom
    moving.current=true
    invalidate()
  },[camera,zoom,invalidate])
  useFrame((_,delta)=>{
    if(!moving.current||!controls.current) return
    const alpha=reduced?1:1-Math.exp(-delta*6)
    camera.position.lerp(desired.current.position,alpha)
    controls.current.target.lerp(desired.current.target,alpha)
    controls.current.update()
    if(camera.position.distanceTo(desired.current.position)<.03)moving.current=false
  })
  return <OrbitControls ref={controls} makeDefault enableDamping={!reduced} dampingFactor={.09}
    minDistance={4} maxDistance={60} rotateSpeed={.6} panSpeed={.73} zoomSpeed={.82}
    onStart={()=>{moving.current=false}}/>
}

function World({graph,finding,active,zoom,labels,labelRefs,onHover}:{graph:Graph;finding?:Finding;active?:Step;zoom:number;labels:Entity[];labelRefs:LabelRefs;onHover:(id:string)=>void}) {
  const {selected,step,reduced,inspect,patch,guided}=useOrbit()
  const important=useMemo(()=>new Set(finding?.entities),[finding])
  const nodes=useMemo(()=>new Map(graph.nodes.map(n=>[n.id,n])),[graph])
  return <>
    <ambientLight intensity={1.35}/><directionalLight position={[-3,5,5]} color="#c1efff" intensity={2.1}/>
    <directionalLight position={[3,-4,2]} color="#527fae" intensity={1.25}/>
    <gridHelper args={[48,48,'#a4b2d2','#cdd8ee']} position={[0,-4.85,-2.3]}/>
    <Camera graph={graph} active={active} zoom={zoom}/>
    <ProjectLabels nodes={graph.nodes} labels={labels} refs={labelRefs} selected={selected} important={important}/>
    {graph.edges.map(edge=>{
      const a=nodes.get(edge.from),b=nodes.get(edge.to)
      if(!a||!b)return null
      const cur=active?.from===edge.from&&active?.to===edge.to
      return <Strand key={edge.id} edge={edge} a={a} b={b} hot={edge.highlight} pulse={cur} quiet={Boolean(finding)&&!edge.highlight&&(guided||step>=0)} motion={!reduced} onTransaction={id=>patch({tx:id,panel:'transaction'})}/>
    })}
    {graph.nodes.map((node)=><Node key={node.id} n={node} selected={selected===node.id} featured={important.has(node.id)} active={node.id===active?.from||node.id===active?.to}
      quiet={Boolean(finding)&&!important.has(node.id)} onInspect={inspect} onHover={onHover}/>)}
  </>
}

type LabelRefs = RefObject<Map<string,HTMLSpanElement>>

type ScreenBox = {x:number;y:number;w:number;h:number}

function overlaps(a:ScreenBox,b:ScreenBox) {
  return a.x<b.x+b.w+2&&a.x+a.w+2>b.x&&a.y<b.y+b.h+2&&a.y+a.h+2>b.y
}

function ProjectLabels({nodes,labels,refs,selected,important}:{nodes:Entity[];labels:Entity[];refs:LabelRefs;selected:string;important:Set<string>}) {
  const point=useMemo(()=>new THREE.Vector3(),[])
  useFrame(({camera,size})=>{
    if(!labels.length)return
    const pixelsPerUnit=size.height*camera.projectionMatrix.elements[5]/2
    const projected=new Map<string,{x:number;y:number;radius:number}>()
    const occupied:ScreenBox[]=[]
    for(const node of nodes){
      point.set(...node.position)
      const distance=-point.applyMatrix4(camera.matrixWorldInverse).z
      point.set(...node.position).project(camera)
      if(distance<=0||point.z<=-1||point.z>=1)continue
      const x=(point.x+1)*size.width*.5,y=(1-point.y)*size.height*.5
      const radius=Math.ceil(nodeRadius(node,selected===node.id,important.has(node.id))*pixelsPerUnit/Math.max(1,distance))
      projected.set(node.id,{x,y,radius})
      occupied.push({x:x-radius,y:y-radius,w:radius*2,h:radius*2})
    }
    for(const node of labels){
      const el=refs.current.get(node.id)
      if(!el)continue
      const screen=projected.get(node.id)
      let placed=false
      if(screen){
        const {x,y,radius}=screen
        const w=el.offsetWidth,h=el.offsetHeight
        const gap=radius+5
        const candidates=[
          [x+gap,y-h/2],[x-w-gap,y-h/2],[x-w/2,y+gap],[x-w/2,y-h-gap],
          [x+gap,y+gap],[x-w-gap,y+gap],[x+gap,y-h-gap],[x-w-gap,y-h-gap],
          [x-w/2,y+gap+h],[x-w/2,y-gap-h*2]
        ]
        for(const [lx,ly] of candidates){
          if(lx<46||lx+w>size.width-6||ly<49||ly+h>size.height-74)continue
          const box={x:lx,y:ly,w,h}
          if(occupied.some(other=>overlaps(box,other)))continue
          el.style.transform='translate3d('+Math.round(lx)+'px,'+Math.round(ly)+'px,0)'
          occupied.push(box)
          placed=true
          break
        }
      }
      el.style.visibility=placed?'visible':'hidden'
    }
  })
  return null
}

export function GraphList({graph,openInUniverse=false}:{graph:Graph;openInUniverse?:boolean}) {
  const {t,display}=useText()
  const {inspect,selected,patch}=useOrbit()
  const locate=(id:string,tx?:string)=>{
    if(openInUniverse)patch({view:'universe',after:'',before:'',community:''})
    inspect(id)
    if(tx)patch({tx,panel:'transaction'})
  }
  return <div className="graph-list">
    <table><thead><tr><th>{t("Entity")}</th><th>{t("Category")}</th><th>{t("Community")}</th><th>{t("Anomaly")}</th></tr></thead><tbody>
      {graph.nodes.map(n=><tr key={n.id} className={selected===n.id?'chosen':''}><td><button {...helpAttrs('account')} onClick={()=>locate(n.id)}>{n.name} <small>{n.id}</small></button></td><td>{display(kindLabels[n.kind])}</td><td>{display(n.community)}</td><td>{n.score||'—'}</td></tr>)}
    </tbody></table>
    <h3>{t("Visible transfer routes")}</h3><div className="visible-routes">
      {graph.edges.filter(e=>e.transactions.length>0).map(e=><button key={e.id} {...helpAttrs('transfer')} onClick={()=>locate(e.to,e.transactions.at(-1))}>{t('{from} to {to}',{from:e.from,to:e.to})} · {t('{count} transfers',{count:num(e.count)})}</button>)}
    </div>
  </div>
}

function hasWebGL() {
  try {
    const canvas=document.createElement('canvas')
    const gl=canvas.getContext('webgl2')
    if(!gl)return false
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    return true
  } catch {return false}
}

function Locator({graph}:{graph:Graph}) {
  const {t}=useText()
  const {selected,inspect}=useOrbit()
  return <div className="locator" {...helpAttrs('locator')} aria-label={t("Graph orientation")}>
    <div><Crosshair size={12}/> {t("ORIENTATION")}</div>
    <div className="locator-map">
      {graph.nodes.map(n=>{
        const x=Math.min(96,Math.max(4,50+n.position[0]*5.7))
        const y=Math.min(88,Math.max(12,50-n.position[1]*9))
        return <button key={n.id} tabIndex={-1} title={n.name} aria-label={t('Locate {name}',{name:n.name})} onClick={()=>inspect(n.id)} style={{left:x+'%',top:y+'%',background:n.id===selected?warm:colors[n.kind]}} className={n.id===selected?'current':''}/>
      })}
    </div>
  </div>
}

export function Scene({graph,finding,active}:{graph:Graph;finding?:Finding;active?:Step}) {
  const {t,display}=useText()
  const {list,patch,camera,overview,reduced,selected}=useOrbit()
  const [zoom,setZoom]=useState(0)
  const [hover,setHover]=useState('')
  const labelRefs=useRef(new Map<string,HTMLSpanElement>())
  const [supported]=useState(hasWebGL)
  const labels=useMemo(()=>{
    const nodes=new Map(graph.nodes.map(n=>[n.id,n]))
    const inbound=new Set(graph.edges.filter(e=>e.highlight).map(e=>e.to))
    const outgoing=new Set(graph.edges.filter(e=>e.highlight).map(e=>e.from))
    const hubs=graph.nodes.filter(n=>n.kind==='bank').slice(0,6).map(n=>n.id)
    const anchors=finding?[
      ...finding.entities.filter(id=>inbound.has(id)&&!outgoing.has(id)),...finding.entities.filter(id=>outgoing.has(id)&&!inbound.has(id)),...finding.entities
    ]:hubs
    return [...new Set([selected,hover,active?.from,active?.to,...anchors])].flatMap(id=>id&&nodes.has(id)?[nodes.get(id)!]:[]).slice(0,7)
  },[selected,hover,active?.from,active?.to,graph,finding])
  if(list||!supported) return <div className="scene list-mode"><GraphList graph={graph}/></div>
  const cameraControls:{icon:typeof Plus;label:string;action:()=>void;feature:Control}[]=[{icon:Plus,feature:'zoom',label:'Zoom in',action:()=>setZoom(x=>x+1)},{icon:Minus,feature:'zoom',label:'Zoom out',action:()=>setZoom(x=>x-1)},{icon:Scan,feature:'reset',label:'Return to overview',action:overview},{icon:Box,feature:'camera',label:'Cycle camera preset',action:()=>patch({camera:camera==='front'?'iso':camera==='iso'?'top':'front'})},{icon:List,feature:'list',label:'Switch to accessible entity list',action:()=>patch({list:true})}]
  return <div className="scene">
    <SceneBoundary fallback={<GraphList graph={graph}/>}>
      <Suspense fallback={<p className="scene-status">{t("Loading 3D scene…")}</p>}>
        <Canvas camera={{position:[.65,.50,19],fov:39,near:.1,far:125}} dpr={[1,1.5]} frameloop={reduced?'demand':'always'} gl={{alpha:true,antialias:true}} onCreated={({raycaster})=>{raycaster.params.Line.threshold=.09}} aria-label={t("Interactive 3D financial network")}>
          <World graph={graph} finding={finding} active={active} zoom={zoom} labels={labels} labelRefs={labelRefs} onHover={setHover}/>
        </Canvas>
      </Suspense>
    </SceneBoundary>
    <div className="projected-labels" aria-hidden="true">{labels.map(n=><span key={n.id} ref={el=>{if(el)labelRefs.current.set(n.id,el);else labelRefs.current.delete(n.id)}}
      className={'node-tag '+(selected===n.id?'selected':finding?.entities.includes(n.id)?'featured':'subtle')}>{n.name}</span>)}</div>
    <div className="scene-controls">{cameraControls.map(({icon:Icon,label,action,feature})=><button key={label} {...helpAttrs(feature)} aria-label={display(label)} onClick={action}><Icon size={17}/></button>)}</div>
    <div className="graph-key" {...helpAttrs('legend')}>{kinds.map(kind=>{const Icon=shapes[kind];return <span key={kind}><Icon size={13} color={colors[kind]}/>{display(kindLabels[kind])}</span>})}<span><CircleDot size={13} color={warm}/>{t("Highlighted")}</span></div>
    <Locator graph={graph}/>
    <div className="scene-help">{t("Drag to rotate")} <i/> {t("Scroll to zoom")}</div>
  </div>
}
