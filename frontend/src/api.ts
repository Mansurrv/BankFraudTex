import {useGuide} from './guide/state'
import {localeTag} from './i18n/locales'
import {text} from './i18n/text'
import {formatNumber, shortUtcDate} from './i18n/format'
export class ApiError extends Error {
  constructor(public status:number, message:string) {super(message)}
}
export function isConnectionError(error:unknown) {
  return error instanceof ApiError&&[0,502,503,504].includes(error.status)
}
export async function api<T>(path:string, data?:unknown, options?:RequestInit):Promise<T> {
  const response = await fetch('/api/'+path, {
    ...options,
    method: data === undefined ? 'GET' : 'POST',
    credentials:'same-origin',
    headers:{...options?.headers,...(data === undefined ? {} : {'Content-Type':'application/json'})},
    body: data === undefined ? undefined : JSON.stringify(data)
  }).catch(error=>{
    if(options?.signal?.aborted)throw error
    throw new ApiError(0,'Could not connect to FFBI')
  })
  const result = await response.json().catch(()=>{
    const status=response.ok?503:response.status
    throw new ApiError(status,[502,503,504].includes(status)?'FFBI is temporarily unavailable.':'Request failed')
  })
  if (!response.ok) throw new ApiError(response.status,result?.error || 'Request failed')
  return result as T
}
export function url(path:string,params:Record<string,string|number|undefined>) {
  const values=new URLSearchParams()
  for (const [k,v] of Object.entries(params)) if(v!==undefined&&v!=='') values.set(k,String(v))
  return path+(values.size?'?'+values.toString():'')
}

const chosenLanguage=()=>useGuide.getState().language
const formatCache=new Map<ReturnType<typeof chosenLanguage>,ReturnType<typeof createFormats>>()
function createFormats(language:ReturnType<typeof chosenLanguage>) {
  const locale=localeTag(language)
  const calendar=language==='en'?'en-GB':locale
  const dayOptions={day:'2-digit',month:'short',timeZone:'UTC'} as const
  return {
    whole:new Intl.NumberFormat(locale,{maximumFractionDigits:0}),
    decimal:new Intl.NumberFormat(locale,{maximumFractionDigits:2}),
    compact:new Intl.NumberFormat(locale,{notation:'compact',maximumFractionDigits:2}),
    day:new Intl.DateTimeFormat(calendar,dayOptions),
    fullDate:new Intl.DateTimeFormat(calendar,{...dayOptions,year:'numeric'}),
    time:new Intl.DateTimeFormat(calendar,{hour:'2-digit',minute:'2-digit',hourCycle:'h23',timeZone:'UTC'})
  }
}
function currentFormats() {
  const language=chosenLanguage()
  let cached=formatCache.get(language)
  if(!cached){
    cached=createFormats(language)
    formatCache.set(language,cached)
  }
  return cached
}
export const num=(n:number)=>formatNumber(chosenLanguage(),currentFormats().whole,n)
export const decimal=(n:number)=>formatNumber(chosenLanguage(),currentFormats().decimal,n)
export const money=(n:number,currency='USD')=>{
  const amount=decimal(n)
  return chosenLanguage()==='en'?(currency==='USD'?'$':currency+' ')+amount:amount+' '+currency
}
export function compact(n:number) {
  const language=chosenLanguage()
  if(language==='en')return currentFormats().compact.format(n)
  const scale=[[1e12,'трлн'],[1e9,'млрд'],[1e6,'млн'],[1e3,language==='ru'?'тыс.':'мың']] as const
  const unit=scale.find(([size])=>Math.abs(n)>=size)
  return unit?decimal(n/unit[0])+' '+unit[1]:decimal(n)
}
export const date=(value:string,year=false)=>{
  const parsed=new Date(value)
  if(Number.isNaN(parsed.getTime()))return value
  const language=chosenLanguage()
  const formats=currentFormats()
  return language==='en'?(year?formats.fullDate:formats.day).format(parsed):shortUtcDate(language,parsed,year)
}
export const utc=(value:string)=>{
  const parsed=new Date(value)
  return Number.isNaN(parsed.getTime())?value:currentFormats().time.format(parsed)
}
export function duration(seconds:number) {
  const language=chosenLanguage()
  const minutes=Math.floor(seconds/60)
  const rest=seconds%60
  if(language==='en')return minutes?minutes+'m'+(rest?' '+rest+'s':''):seconds+'s'
  return [minutes?text(language,'{count} min',{count:minutes}):'',rest||!minutes?text(language,'{count} sec',{count:rest}):''].filter(Boolean).join(' ')
}
