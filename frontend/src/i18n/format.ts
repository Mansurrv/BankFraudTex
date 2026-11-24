import type {Locale} from './locales'

type CyrillicLocale = Exclude<Locale,'en'>
const monthNames = {
  ru:['янв.','февр.','мар.','апр.','мая','июн.','июл.','авг.','сент.','окт.','нояб.','дек.'],
  kk:['қаң.','ақп.','нау.','сәу.','мам.','мау.','шіл.','там.','қыр.','қаз.','қар.','жел.']
} satisfies Record<CyrillicLocale,string[]>
const englishMonths=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export function shortUtcDate(language:CyrillicLocale,date:Date,year:boolean) {
  const day=String(date.getUTCDate()).padStart(2,'0')
  const month=monthNames[language][date.getUTCMonth()]
  const suffix=language==='ru'?' г.':' ж.'
  return day+' '+month+(year?' '+date.getUTCFullYear()+suffix:'')
}

export function ledgerTime(language:CyrillicLocale,value:string) {
  return value.replace(/\b([A-Z][a-z]{2})\b/g,word=>monthNames[language][englishMonths.indexOf(word)]??word)
}

export function ledgerNumber(value:string) {
  return /^-?\d[\d,]*(?:\.\d+)?$/.test(value)?value.replaceAll(',','\u00a0').replace('.',','):value
}

export function formatNumber(language:Locale,formatter:Intl.NumberFormat,value:number) {
  if(language==='en')return formatter.format(value)
  return formatter.formatToParts(value).map(part=>part.type==='group'?'\u00a0':part.type==='decimal'?',':part.value).join('')
}
