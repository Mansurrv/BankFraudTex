import {
  BoxGeometry, BufferAttribute, type BufferGeometry, CylinderGeometry,
  ExtrudeGeometry, Shape, SphereGeometry
} from 'three'
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js'
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js'
import type {Entity, NodeKind} from './types'

type Part = {geometry:BufferGeometry;shade:number}
type Position = [x:number,y:number,z:number]

function part(geometry:BufferGeometry,position:Position,shade=1):Part {
  geometry.translate(...position)
  return {geometry,shade}
}

function block(width:number,height:number,depth:number,position:Position,shade=1):Part {
  return part(new BoxGeometry(width,height,depth),position,shade)
}

function rounded(width:number,height:number,depth:number,radius:number,position:Position,shade=1):Part {
  return part(new RoundedBoxGeometry(width,height,depth,1,radius),position,shade)
}

function pillar(radius:number,height:number,position:Position,shade=1):Part {
  return part(new CylinderGeometry(radius,radius,height,8),position,shade)
}

function card():Part[] {
  return [
    rounded(1.16,.73,.16,.075,[0,0,0],.9),
    rounded(1.04,.61,.035,.017,[0,0,.079],.54),
    block(1.03,.105,.024,[0,-.18,.1],.27),
    rounded(.23,.17,.045,.017,[-.29,.09,.111],1),
    block(.17,.014,.016,[-.29,.09,.139],.42),
    block(.014,.13,.016,[-.29,.09,.139],.42),
    block(.27,.038,.019,[.27,.11,.103],.89),
    block(.17,.026,.018,[.32,.023,.102],.72),
    block(1.02,.12,.022,[0,.115,-.083],.29)
  ]
}

function phone():Part[] {
  return [
    rounded(.68,1.15,.19,.09,[0,0,0],.92),
    rounded(.57,.92,.054,.026,[0,.045,.096],.23),
    block(.46,.68,.022,[0,.055,.127],.44),
    block(.34,.08,.017,[0,.29,.14],.95),
    block(.12,.27,.017,[-.11,-.005,.14],.72),
    block(.12,.27,.017,[.065,-.005,.14],.63),
    rounded(.15,.028,.014,.006,[0,-.445,.101],.93),
    block(.034,.155,.083,[.343,.21,0],.77),
    rounded(.205,.25,.052,.024,[-.145,.357,-.101],.51),
    part(new SphereGeometry(.055,10,8).scale(1,1,.35),[-.152,.39,-.134],1)
  ]
}

function office():Part[] {
  const windows=[-.31,-.068,.175,.418].flatMap(y=>[
    ...[-.195,.024,.24].map(x=>block(.128,.137,.025,[x,y,.287],.9)),
    block(.023,.137,.31,[.376,y,.035],.67)
  ])
  return [
    block(.79,1.1,.55,[0,-.006,0],.47),
    block(.83,.077,.59,[0,.555,0],.86),
    block(.48,.105,.35,[-.06,.62,-.02],.66),
    block(.87,.067,.64,[0,-.575,.005],.79),
    block(.24,.21,.033,[.006,-.437,.291],.63),
    ...windows
  ]
}

function bank():Part[] {
  const roof=new Shape()
  roof.moveTo(-.56,.23)
  roof.lineTo(.56,.23)
  roof.lineTo(0,.6)
  roof.closePath()
  const columns=[-.37,-.125,.125,.37].flatMap(x=>[
    pillar(.065,.56,[x,-.098,.21],.96),
    block(.17,.053,.17,[x,.171,.21],1),
    block(.16,.047,.165,[x,-.375,.21],.85)
  ])
  return [
    part(new ExtrudeGeometry(roof,{depth:.62,bevelEnabled:false}),[0,0,-.31],1),
    block(1.03,.073,.65,[0,.19,0],.76),
    block(.95,.59,.22,[0,-.105,-.116],.38),
    block(.18,.36,.022,[0,-.23,.014],.23),
    block(1.04,.083,.65,[0,-.422,.012],.83),
    block(1.12,.074,.71,[0,-.503,.017],.7),
    ...columns
  ]
}

function person():Part[] {
  return [
    part(new SphereGeometry(.195,12,9),[0,.439,0],1),
    pillar(.085,.12,[0,.239,0],.83),
    rounded(.52,.415,.31,.07,[0,.033,0],.83),
    rounded(.163,.405,.18,.046,[-.32,-.012,0],.65),
    rounded(.163,.405,.18,.046,[.32,-.012,0],.65),
    rounded(.195,.39,.235,.048,[-.121,-.33,0],.57),
    rounded(.195,.39,.235,.048,[.121,-.33,0],.57),
    rounded(.207,.079,.31,.03,[-.122,-.53,.025],.81),
    rounded(.207,.079,.31,.03,[.122,-.53,.025],.81)
  ]
}

function model(parts:Part[]):BufferGeometry {
  const batches=parts.map(({geometry,shade})=>{
    const batch=geometry.index?geometry.toNonIndexed():geometry
    if(batch!==geometry)geometry.dispose()
    batch.deleteAttribute('uv')
    const colors=new Float32Array(batch.getAttribute('position').count*3).fill(shade)
    batch.setAttribute('color',new BufferAttribute(colors,3))
    return batch
  })
  const joined=mergeGeometries(batches)
  for(const batch of batches)batch.dispose()
  if(!joined)throw new Error('Could not assemble a 3D node model')
  joined.rotateX(.11).rotateY(-.28)
  joined.computeBoundingSphere()
  return joined
}

// Each kind shares one geometry and one draw call per node, regardless of its parts.
export const nodeModels:Record<NodeKind,BufferGeometry> = {
  account:model(card()),
  device:model(phone()),
  company:model(office()),
  bank:model(bank()),
  person:model(person())
}

export function nodeScale(node:Entity,selected:boolean,featured:boolean) {
  return (node.size||1)*(selected?.63:featured?.57:.55)
}

export function nodeRadius(node:Entity,selected:boolean,featured:boolean) {
  return (nodeModels[node.kind].boundingSphere?.radius??.7)*nodeScale(node,selected,featured)
}
