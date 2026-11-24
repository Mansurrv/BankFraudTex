import {Languages} from 'lucide-react'
import {useGuide} from '../guide/state'
import {languages, type Locale} from './locales'
import {text} from './text'

export function LanguageSelect({label,compact=false}:{label?:string;compact?:boolean}) {
  const language=useGuide(state=>state.language)
  const choose=useGuide(state=>state.languageSet)
  const caption=label??text(language,'Language')
  return <label className={compact?'language-picker':undefined}>
    {compact?<Languages size={16} aria-hidden="true"/>:caption}
    <select aria-label={caption} title={caption} value={language} onChange={event=>choose(event.target.value as Locale)}>
      {languages.map(option=><option key={option.id} value={option.id} lang={option.id}>{option.label}</option>)}
    </select>
  </label>
}
