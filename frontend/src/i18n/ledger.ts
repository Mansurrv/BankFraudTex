import type {Locale} from './locales'
import {interpolate, label} from './text'
import {ledgerNumber,ledgerTime} from './format'

// The ledger stores canonical English narrative text in existing records and APIs.
// Translate the known formats at display time. Keep names, references, amounts and custom text intact.
type Template = readonly [source:string,ru:string,kk:string]
const templates:Template[] = [
  ['The ledger contains {n} transactions across {accounts} accounts.','Операций в реестре — {n}. Счетов — {accounts}.','Тізілімде {accounts} шот бойынша {n} операция бар.'],
  ['FFBI has flagged {n} patterns in the imported ledger. Open Anomaly Radar to review them.','В загруженном реестре FFBI отметил схем: {n}. Их можно проверить в «Радаре аномалий».','FFBI жүктелген тізілімде {n} үлгіні белгіледі. Оларды «Аномалиялар радарынан» қараңыз.'],
  ['Transfer: {amount} USD equivalent. Account median: {median}. Applied threshold: {threshold}.','Перевод: {amount} USD в эквиваленте. Медиана по счёту: {median}. Применённый порог: {threshold}.','Аударым: {amount} USD баламасы. Шот медианасы: {median}. Қолданылған шек: {threshold}.'],
  ['{n} recorded transfers in the account history','Переводов в истории счёта: {n}','Шот тарихындағы аударымдар: {n}'],
  ['Recorded span: {minutes} minutes','Интервал по реестру: {minutes} мин.','Тізілімдегі аралық: {minutes} мин.'],
  ['Onward transit: {first} and {second} minutes. Forwarded shares: {shareA}% and {shareB}%.','Время перевода дальше: {first} и {second} мин. Доли перечисленных сумм: {shareA}% и {shareB}%.','Әрі қарай аудару уақыты: {first} және {second} мин. Аударылған үлестер: {shareA}% және {shareB}%.'],
  ['Distributed shares: {shareA}% and {shareB}% of incoming credits.','Распределённые доли от поступлений: {shareA}% и {shareB}%.','Түсімдерден бөлінген үлестер: {shareA}% және {shareB}%.'],
  ['{name} sent high-value transfers to several accounts in quick succession.','{name} отправил несколько крупных переводов за короткое время.','{name} қысқа уақытта бірнеше шотқа ірі аударым жіберді.'],
  ['{name} received and redistributed high-value transfers in quick succession.','{name} получил и быстро перераспределил крупные переводы.','{name} ірі аударымдарды алып, тез арада қайта бөлді.'],
  ['{summary} The outgoing routes converge on a smaller set of accounts.','{summary} Исходящие маршруты сходятся на меньшем числе счетов.','{summary} Шығыс бағыттары азырақ шотта тоғысады.'],
  ['{n} outgoing transfers to {accounts} distinct accounts within {minutes} minutes','Исходящих переводов: {n}. Разных счетов: {accounts}. Интервал: {minutes} мин.','Шығыс аударымдар: {n}. Әртүрлі шоттар: {accounts}. Аралық: {minutes} мин.'],
  ['{name} repeatedly distributed incoming credits through the same intermediary accounts to downstream recipients.','{name} неоднократно распределял поступления через одни и те же счета-посредники для дальнейших переводов.','{name} түсімдерді кейінгі алушыларға бірдей делдал шоттар арқылы бірнеше рет бөлді.'],
  ['{n} intermediary accounts reused the same directed routes across two separate inbound credits','Счетов-посредников, повторивших те же маршруты после двух отдельных поступлений: {n}','Екі бөлек түсімнен кейін бірдей бағыттарды қайталаған делдал шоттар: {n}'],
  ['Intermediaries forwarded comparable USD-equivalent amounts within {minutes} minutes','Счета-посредники перевели сопоставимые суммы в эквиваленте USD в течение {minutes} мин.','Делдал шоттар USD баламасы ұқсас сомаларды {minutes} минут ішінде әрі қарай аударды'],
  ['Repeated route: {from} → {via} → {to}','Повторяющийся маршрут: {from} → {via} → {to}','Қайталанған бағыт: {from} → {via} → {to}'],
  ['{name} sent several similarly sized transfers across distinct counterparties in under 35 minutes.','{name} отправил нескольким контрагентам переводы на похожие суммы менее чем за 35 минут.','{name} 35 минутқа жетпей бірнеше контрагентке сомасы ұқсас аударымдар жіберді.'],
  ['{n} transfers between USD-equivalent 9,000 and 10,000','Переводов на сумму от 9 000 до 10 000 USD в эквиваленте: {n}','USD баламасы 9 000–10 000 аралығындағы аударымдар: {n}'],
  ['{name} contacted {n} counterparties in a concentrated burst.','{name} провёл операции с несколькими контрагентами за короткий промежуток времени. Контрагентов: {n}.','{name} қысқа уақыт ішінде бірнеше контрагентпен операция жасады. Контрагенттер: {n}.'],
  ['{n} distinct recipients within 12 minutes','Разных получателей за 12 минут: {n}','12 минуттағы әртүрлі алушылар: {n}'],
  ['{name} made an outgoing transfer far above its median transaction amount.','{name} отправил перевод на сумму значительно выше медианной для этого счёта.','{name} осы шоттың медианалық сомасынан едәуір жоғары аударым жіберді.'],
  ['Largest transfer is {n}× the account median','Крупнейший перевод превышает медианную сумму по счёту в {n} раз','Ең ірі аударым шоттың медианалық сомасынан {n} есе жоғары'],
  ['{metric} is {n} robust deviations from the account population median','{metric}: отклонение от медианы по счетам на {n} робастных единиц','{metric}: шоттар медианасынан {n} тұрақты бірлікке ауытқыған'],
  ['Isolation Forest percentile {n}/100; deviations describe observed features','Процентиль Isolation Forest: {n}/100. Отклонения описывают наблюдаемые признаки.','Isolation Forest процентилі: {n}/100. Ауытқулар байқалған белгілерді сипаттайды.'],
  ['{name} has an uncommon combination of observed account features. Evidence shows the most recent entries for review.','У {name} обнаружено необычное сочетание признаков. Для проверки приведены самые свежие записи.','{name} шотында белгілердің әдеттен тыс үйлесімі байқалды. Тексеру үшін соңғы жазбалар берілді.'],
  ['A directed sequence of {n} transfers returns to {name}.','Цепочка из {n} направленных переводов возвращается на счёт {name}.','{n} аударымнан тұратын бағытталған тізбек {name} шотына қайта оралады.'],
  ['The earliest observed route from {from} to {to} has {n} transfer(s). It starts at {start} UTC and arrives at {end} UTC.','Маршрут с самым ранним поступлением от {from} до {to}: переводов {n}. Начало в {start} UTC, поступление в {end} UTC.','{from} мен {to} арасындағы ең ерте тіркелген түсім бағыты: {n} аударым. Басталуы {start} UTC, түсуі {end} UTC.'],
  ['No qualifying time-ordered route from {from} to {to} in this window.','В этом периоде не найден подходящий маршрут от {from} до {to} с соблюдением порядка по времени.','Бұл кезеңде {from} мен {to} арасында уақыт ретіне сай бағыт табылмады.'],
  ['The latest 24-hour period recorded {after} transfers and USD-equivalent {afterAmount} in gross volume. The preceding period recorded {before} transfers and USD-equivalent {beforeAmount}.','Последние 24 часа: переводов {after}, валовой объём {afterAmount} USD в эквиваленте. Предыдущий период: {before} переводов, {beforeAmount} USD в эквиваленте.','Соңғы 24 сағат: {after} аударым, жалпы көлемі {afterAmount} USD баламасында. Алдыңғы кезең: {before} аударым, көлемі {beforeAmount} USD баламасында.'],
  ['{name} scored {score}/100 for {kind}. {reasons}.','{name}: оценка {score}/100. Наблюдение: {kind}. {reasons}.','{name}: баға {score}/100. Байқау: {kind}. {reasons}.'],
  ['The relationship search returned {n} candidates for {name}. Confirmed ledger links and inferred signals are labeled separately. Shared infrastructure supports review of a possible connection.','Возможные связи для {name}: {n}. Подтверждённые связи и косвенные признаки помечены отдельно. Общая инфраструктура позволяет проверить возможную связь.','{name} үшін ықтимал байланыстар: {n}. Расталған байланыстар мен болжамды белгілер бөлек көрсетілген. Ортақ инфрақұрылым ықтимал байланысты тексеруге негіз береді.'],
  ['{name} has {n} recorded transfers across {peers} counterparties, with USD-equivalent {credit} inbound and {debit} outbound.','Для {name} зарегистрировано {n} переводов. Контрагентов: {peers}. Поступления: {credit} USD, списания: {debit} USD в эквиваленте.','{name} шотында {n} аударым тіркелді. Контрагенттер: {peers}. Түсім: {credit} USD, шығыс: {debit} USD баламасында.'],
  ['{summary} Observed endpoint receipts include {receipts}.','{summary} Поступления на конечные счета: {receipts}.','{summary} Соңғы шоттардағы түсімдер: {receipts}.'],
  ['{name} received {currency} {amount}','{name} получил {amount} {currency}','{name} шотына {amount} {currency} түсті'],
  ['{name} is incident to {n} of the {total} observed transfers in this finding.','{name} участвует в {n} из {total} зарегистрированных переводов в этом наблюдении.','{name} осы байқауда тіркелген {total} аударымның {n}-іне қатысты.'],
  ['{summary} The evidence covers {n} transfers involving {entities} entities over {minutes} minutes, with USD-equivalent {amount} in gross transfer volume.','{summary} Записи охватывают {n} переводов с участием {entities} объектов за {minutes} мин. Валовой объём: {amount} USD в эквиваленте.','{summary} Жазбалар {minutes} минут ішінде {entities} нысан қатысқан {n} аударымды қамтиды. Жалпы көлем: {amount} USD баламасында.'],
  ['{from} to {to} · {currency} {amount} · {time} UTC','{from} → {to} · {amount} {currency} · {time} UTC','{from} → {to} · {amount} {currency} · {time} UTC'],
  ['{n} common counterparties · example {name}','Общих контрагентов: {n} · пример: {name}','Ортақ контрагенттер: {n} · мысал: {name}'],
  ['Behavior fingerprint similarity {n}/100','Сходство профилей счетов: {n}/100','Шот профильдерінің ұқсастығы: {n}/100'],
  ['Transaction community {n}','Группа переводов {n}','Аударымдар тобы {n}'],
  ['invalid transaction "{id}"','Некорректная операция «{id}»','Жарамсыз операция: «{id}»']
]
const fixed:Record<string,readonly [string,string]> = {
  'At least four recipients in 25 minutes, with each transfer at least 15,000 USD equivalent.':['Не менее четырёх получателей за 25 минут. Каждый перевод — от 15 000 USD в эквиваленте.','25 минутта кемінде төрт алушы. Әр аударым кемінде 15 000 USD баламасына тең.'],
  'At least five transfers to four recipients in 35 minutes, each from 9,000 to 9,999.99 USD equivalent.':['Не менее пяти переводов минимум четырём получателям за 35 минут. Каждый перевод — от 9 000 до 9 999,99 USD в эквиваленте.','35 минутта кемінде төрт алушыға бес аударым. Әр аударым 9 000–9 999,99 USD баламасы аралығында.'],
  'At least five recipients in 12 minutes, with each transfer at least 1,500 USD equivalent.':['Не менее пяти получателей за 12 минут. Каждый перевод — от 1 500 USD в эквиваленте.','12 минутта кемінде бес алушы. Әр аударым кемінде 1 500 USD баламасына тең.'],
  'An outgoing transfer reaches 11,000 USD equivalent and 14 times the account median.':['Исходящий перевод достигает 11 000 USD в эквиваленте и 14 медианных сумм по счёту.','Шығыс аударым кемінде 11 000 USD баламасына және шот медианасының 14 есесіне жетеді.'],
  'At least ten recorded transfers in the account history.':['В истории счёта есть не менее десяти зарегистрированных переводов.','Шот тарихында кемінде он аударым тіркелген.'],
  'Two account features reach 4.4 and 2.5 robust deviations from their peer medians, respectively.':['Два признака отличаются от медиан похожих счетов не менее чем на 4,4 и 2,5 робастной единицы соответственно.','Шоттың екі белгісі ұқсас шоттар медианасынан тиісінше кемінде 4,4 және 2,5 робаст бірлікке ауытқыған.'],
  'Isolation Forest percentile is at least 81 out of 100.':['Процентиль Isolation Forest — не ниже 81 из 100.','Isolation Forest процентилі 100-ден кемінде 81.'],
  'Two to five time-ordered transfers of at least 12,500 USD equivalent return to the opening account in two hours.':['От двух до пяти последовательных переводов возвращаются на исходный счёт за два часа. Каждый перевод — от 12 500 USD в эквиваленте.','Уақыт ретімен жасалған екіден беске дейінгі аударым екі сағатта бастапқы шотқа қайтады. Әр аударым кемінде 12 500 USD баламасына тең.'],
  'Two separate credits lead to at least two repeated routes. Within 30 minutes each distributes 60–115% of its credit.':['В двух эпизодах повторяются минимум два маршрута. За 30 минут после каждого поступления распределяется 60–115% его суммы.','Екі эпизодта кемінде екі бағыт қайталанады. Әр түсімнен кейін 30 минутта оның 60–115%-ы бөлінеді.'],
  'Each intermediary forwards 60–115% of its receipt within 30 minutes in both episodes.':['В обоих эпизодах каждый посредник переводит дальше 60–115% полученной суммы в течение 30 минут.','Екі эпизодта да әр делдал 30 минут ішінде алған сомасының 60–115%-ын әрі қарай аударады.'],
  "Transfer timing and amounts support review. The origin of the funds and the account holders' intent require separate evidence.":['Время и суммы переводов дают основание для проверки. Источник средств и намерения владельцев счетов требуют отдельных доказательств.','Аударым уақыты мен сомалары тексеруге негіз болады. Қаражаттың шығу тегі мен шот иелерінің ниетін анықтау үшін бөлек дәлелдер қажет.'],
  'A recurring payout arrangement could produce these routes. Compare account ownership, payment instructions, and cash-out records with the linked transfers.':['Такие маршруты могут возникать при регулярных выплатах. Сопоставьте переводы с данными о владельцах счетов, платёжными поручениями и записями о выводе средств.','Мұндай бағыттар тұрақты төлемдерден де туындауы мүмкін. Аударымдарды шот иелері, төлем нұсқаулары және қаражатты шығару туралы жазбалармен салыстырыңыз.'],
  'Multiple linked transfers reach the same downstream account':['Несколько связанных переводов поступают на один счёт на следующем этапе','Бірнеше байланысты аударым келесі кезеңде бір шотқа түседі'],
  'Gross transfer volume can count the same funds across multiple hops':['При расчёте валового объёма одни средства могут учитываться на каждом этапе','Жалпы көлемде бір қаражат бірнеше кезеңде қайта есептелуі мүмкін'],
  'Amount and timing similarity triggered the rule':['Правило сработало из-за сходства сумм и времени','Ереже сомалар мен уақыттың ұқсастығынан іске қосылды'],
  'The sequence alone does not establish intent':['По последовательности переводов нельзя установить намерение','Аударымдар реті ниетті анықтауға жеткіліксіз'],
  'Review whether the burst aligns with normal operating activity':['Проверьте, соответствует ли всплеск обычной активности счёта','Қарқынның өсуі шоттың әдеттегі әрекетіне сай ма, тексеріңіз'],
  'Comparison uses USD-equivalent values':['Для сравнения суммы приведены к эквиваленту USD','Салыстыру үшін сомалар USD баламасымен берілді'],
  'Ordered directed edges return to the opening account':['Последовательность направленных переводов возвращается на исходный счёт','Бағытталған аударымдар тізбегі бастапқы шотқа қайтады'],
  'All transfers occurred within two hours':['Все переводы прошли за два часа','Барлық аударым екі сағат ішінде жасалды'],
  'The ledger confirms transfers; it does not identify the same underlying funds':['Реестр подтверждает переводы. Определить, перемещались ли одни и те же средства, по нему нельзя','Тізілім аударымдарды растайды. Олардың бір қаражат екенін анықтау мүмкін емес'],
  'Transfer sequences support review. Intent and source of funds require separate evidence.':['Последовательность переводов помогает проверке. Для установления намерений и происхождения средств нужны отдельные доказательства.','Аударымдар реті тексеруге көмектеседі. Ниет пен қаражаттың шығу тегі бөлек дәлелдерді қажет етеді.'],
  'The cycle tool found no qualifying time-ordered circular sequence in this scope. It checks two to five high-value transfers within two hours.':['В выбранных данных не найдена циклическая цепочка по времени. Правило проверяет от двух до пяти крупных переводов за два часа.','Таңдалған деректерде уақыт ретіне сай айналмалы тізбек табылмады. Ереже екі сағаттағы екіден беске дейінгі ірі аударымды тексереді.'],
  'Name two accounts or include their IDs, in sender-to-receiver order.':['Укажите два счёта или их идентификаторы. Сначала отправителя, затем получателя.','Екі шотты не нөмірін көрсетіңіз. Алдымен жіберушіні, содан кейін алушыны жазыңыз.'],
  'There is no scored anomaly for this selection under the current detection rules.':['По текущим правилам для выбранных объектов нет аномалий с оценкой.','Ағымдағы ережелер бойынша таңдалған нысандарда бағаланған аномалия жоқ.'],
  'Select an account or a finding to investigate a bounded set of records.':['Выберите счёт или наблюдение, чтобы изучить связанные записи.','Байланысты жазбаларды зерттеу үшін шот немесе байқау таңдаңыз.'],
  "The tightly timed fan-out could reflect a scheduled settlement or a deliberate routing arrangement. Compare the transfer cadence with the account's operating records.":['Близкие по времени переводы могли быть плановым расчётом или частью выбранного маршрута. Сравните время операций с рабочими записями по счёту.','Жақын уақытта жасалған аударымдар жоспарлы есеп айырысуға немесе таңдалған бағытқа байланысты болуы мүмкін. Уақытын шоттың жұмыс жазбаларымен салыстырыңыз.'],
  'Reconciliation or treasury operations could account for the observed return to the opening account. Review the transfer references against the related instructions.':['Возврат на исходный счёт мог быть частью сверки или казначейской операции. Сопоставьте записи о переводах с платёжными поручениями.','Бастапқы шотқа қайту салыстырып тексеру немесе қазынашылық операция болуы мүмкін. Аударым жазбаларын тиісті төлем нұсқауларымен салыстырыңыз.'],
  'A payment batch could account for the similar amounts. Compare invoices and payment instructions before inferring why the amounts were chosen.':['Похожие суммы могли быть частью пакетного платежа. Прежде чем объяснять выбор сумм, сопоставьте счета и платёжные поручения.','Ұқсас сомалар топтамалық төлемнің бөлігі болуы мүмкін. Сомалардың таңдалу себебін болжаудан бұрын шоттар мен төлем нұсқауларын салыстырыңыз.'],
  'Seven-day exponential smoothing with an empirical residual range':['Экспоненциальное сглаживание за семь дней с эмпирическим диапазоном ошибок','Эмпирикалық қате аралығы бар жеті күндік экспоненциалды тегістеу']
}

const escaped=(literal:string)=>literal.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')
const token=/\{(\w+)\}/g
const formats=templates.map(([source,ru,kk])=>{
  const fields=[...source.matchAll(token)].map(match=>match[1])
  const regex=new RegExp('^'+source.split(token).map((part,index)=>index%2?'(.+?)':escaped(part)).join('')+'$')
  return {fields,regex,ru,kk}
})

const linkLabels=new Set(['registered signatory','registered organization','account institution','observed device','Shared device','Shared company','Shared person','Shared bank','Shared IP range','Shared phone'])
export function ledgerText(language:Locale,value:string):string {
  if(language==='en'||!value)return value
  const translation=label(language,value)
  if(translation!==value)return translation
  if(Object.hasOwn(fixed,value))return fixed[value][language==='ru'?0:1]
  const [prefix,...pieces]=value.split(' · ')
  if(linkLabels.has(prefix)&&pieces.length)return [label(language,prefix),...pieces].join(' · ')
  if(pieces.length===1&&pieces[0]==='bridge between components')return prefix+' · '+label(language,pieces[0])
  for(const format of formats){
    const match=format.regex.exec(value)
    if(!match)continue
    const args=Object.fromEntries(format.fields.map((field,i)=>[field,match[i+1]]))
    for(const field of ['summary','metric','kind'])if(args[field])args[field]=ledgerText(language,args[field])
    for(const field of ['start','end','time'])if(args[field])args[field]=ledgerTime(language,args[field])
    for(const field of ['n','accounts','minutes','afterAmount','beforeAmount','credit','debit','amount','median','threshold','first','second','shareA','shareB']){
      if(args[field])args[field]=ledgerNumber(args[field])
    }
    if(args.receipts)args.receipts=args.receipts.split('; ').map(item=>ledgerText(language,item)).join(', ')
    if(args.reasons)args.reasons=args.reasons.split('. ').map(item=>ledgerText(language,item).replace(/\.+$/,'')).join('. ')
    return interpolate(format[language],args)
  }
  return value
}
