export type NodeKind = 'account' | 'person' | 'company' | 'bank' | 'device'
export type Vec3 = [number, number, number]
export type Entity = {id:string; name:string; kind:NodeKind; community:string; location:string; masked?:string; size?:number; score?:number; position:Vec3}
export type Transaction = {id:string; from:string; to:string; amount:number; usd:number; currency:string; kind:string; time:string}
export type Evidence = {id:string; label:string; status:string; focus?:string; transaction?:boolean}
export type FindingCheck = {condition:string;observations:string[];references?:string[]}
export type Finding = {id:string; kind:string; title:string; summary:string; score:number; subject:string; entities:string[]; evidence:Evidence[]; transactions:string[]; reasons:string[]; start:string; end:string; usd:number; checks?:FindingCheck[]}
export type Edge = {id:string; from:string; to:string; kind:string; status:string; count:number; usd:number; recency:number; highlight:boolean; transactions:string[]}
export type Graph = {nodes:Entity[]; edges:Edge[]; total:number; window:number; version:string}
export type Bucket = {date:string; count:number; usd:number}
export type Summary = {version:string; transactions:number; accounts:number; entities:number; communities:number; usd:number; start:string; end:string; buckets:Bucket[]; findings:Finding[]; model:string}
export type User = {name:string; role:string}
export type AccountDirectoryEntry = {
  email:string; role:string; active:boolean; createdBy?:string;
  activity:{cases:number;inReview:number;reviewed:number;reviewsCompleted:number}
}
export type Bootstrap = {user:User; brand:string; summary:Summary; managedRole?:string}
export type Step = Transaction & {sender:string; receiver:string; elapsed:number; stage:string}
export type Story = {title:string; summary:string; steps:Step[]}
export type Answer = {id?:string; hypotheses?:{text:string;references:string[]}[]; intent:string; title:string; text:string; kind:string; evidence:Evidence[]; limitations:string[]; checks?:FindingCheck[]}
export type Similarity = {entity:string; features:Record<string,number>; score:number; contributors:Record<string,number>}
export type Relationship = {entity:string; name:string; status:string; confidence:number; signals:Evidence[]}
export type EntityDetail = {entity:Entity; inflow:number; outflow:number; count:number; counterparties:number; findings:Finding[]; transactions:Transaction[]; fingerprint?:{features:Record<string,number>}}
type Period = {start:string; end:string; count:number; usd:number; counterparties:number}
export type Temporal = {before:Period; after:Period; change:number; forecast:{nextDay:number; low:number; high:number; method:string}; evidence:Evidence[]}
type Metrics = {nodes:number; transactions:number; usd:number; components:number; largest:number}
export type Simulation = {before:Metrics; after:Metrics; graph:Graph; removed:string[]; alternative:Step[]; critical:Evidence[]}
export type CaseList = {id:string; title:string; owner:string; status:string; updated:string; finding:string}
export type CaseRecord = Omit<CaseList,'finding'> & {snapshots?:{label:string;layout:string;after?:string;before?:string;at:string;graph:Graph}[]; created:string; finding:Finding; graph:Graph; timeline:Story; summary:Answer; notes:{author:string; text:string; at:string}[]; evidence:Evidence[]; savedFindings:Answer[]; scenarios:{action:string;target:string;comparison:Simulation}[]; conclusion:string; reviewer?:string}
export type Community = {name:string; size:number; accounts:string[]; internal:number; representative:string}
export type View = 'overview'|'universe'|'stories'|'behavior'|'relationships'|'radar'|'investigator'|'simulation'|'workspace'|'data'|'settings'
