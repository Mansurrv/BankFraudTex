export const languages = [
  {id:'en', label:'English', tag:'en-US'},
  {id:'ru', label:'Русский', tag:'ru-RU'},
  {id:'kk', label:'Қазақша', tag:'kk-KZ'}
] as const

export type Locale = typeof languages[number]['id']
export type Localized<T> = Record<Locale,T>
export const local = <T,>(value:Localized<T>,language:Locale) => value[language] ?? value.en
export const localeTag = (language:Locale) => languages.find(option=>option.id===language)?.tag??'en-US'
