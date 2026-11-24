import {useGuide} from '../guide/state'
import type {Locale} from './locales'
import {words} from './words'

type Values = Record<string,string|number>
export type TextKey = keyof typeof words

export function interpolate(template:string, values:Values) {
  return template.replace(/\{(\w+)\}/g, (token,name:string)=>String(values[name]??token))
}

export function text(language:Locale, key:TextKey, values:Values={}) {
  return interpolate(language==='en'?key:words[key][language],values)
}

export function label(language:Locale, value:string) {
  if(language==='en')return value
  const key=Object.hasOwn(words,value)?value:Object.hasOwn(words,value.charAt(0).toUpperCase()+value.slice(1))?value.charAt(0).toUpperCase()+value.slice(1):undefined
  return key?words[key as TextKey][language]:value
}

export function useText() {
  const language=useGuide(s=>s.language)
  return {
    language,
    t:(key:TextKey, values?:Values)=>text(language,key,values),
    display:(value:string)=>label(language,value)
  }
}
