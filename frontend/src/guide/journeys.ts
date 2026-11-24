import {kkJourneys} from './kk'
import type {View} from '../types'
import type {Feature, Localized} from './content'

export type Journey = 'tour'|'demo'
type Setup = 'overview'|'finding'|'account'|'credit'|'debit'|'intermediary'|'story'|'history'|'ask'|'simulation'|'case'
export type TourStep = {
  id:string
  view:View
  target:string
  fallback?:string
  feature:Feature
  setup:Setup
  copy:Localized<[title:string, action:string, next:string]>
}
function step(id:string,view:View,target:string,feature:Feature,setup:Setup,en:TourStep['copy']['en'],ru:TourStep['copy']['ru'],kk:readonly [string,string,string],fallback?:string):TourStep {
  return {id,view,target,feature,setup,copy:{en,ru,kk:[...kk]},fallback}
}

export const journeys:Record<Journey,TourStep[]> = {
  tour:[
    step('overview','overview','priority-review','dashboard','overview',
      ['Your Financial Overview','Select a row in Priority review.','The finding opens in the 3D universe with its records and reasons.'],
      ['Обзор финансовой сети','Выберите строку в «Приоритетная проверка».','Откроются связи, записи и причины отметки.'],kkJourneys.tour.overview,'overview-metrics'),
    step('universe','universe','graph','graph','finding',
      ['Explore the Financial Universe','Drag to rotate, scroll to zoom, or double-click an account. Try searching for an account ID.','The camera focuses on the account. The side panel shows what is known about it.'],
      ['Исследуйте финансовую сеть','Перетащите схему, измените масштаб или дважды нажмите на счёт. Попробуйте найти счёт по идентификатору.','Камера приблизится к счёту, а сбоку появятся его данные.'],kkJourneys.tour.universe),
    step('account','universe','account','account','account',
      ['Understand Any Account','Open a row under Latest transfers, or try Expand links.','The row opens its verified transfer. Expand links shows more connected entities.'],
      ['Изучите любой счёт','Откройте запись в «Последние переводы» или нажмите «Развернуть связи».','Запись откроет подтверждённый перевод. Разворачивание добавит связи.'],kkJourneys.tour.account),
    step('story','stories','story-sequence','flow','story',
      ['Follow the Movement of Money','Play the sequence, pause it, and select a row.','The graph highlights that transfer and the panel shows the original amount, UTC time, and both parties.'],
      ['Проследите путь денег','Запустите историю, поставьте на паузу и выберите строку.','Перевод выделится на графе. Панель покажет исходную сумму, время UTC и участников.'],kkJourneys.tour.story),
    step('behavior','behavior','behavior','behavior','account',
      ['Understand Unusual Financial Behavior','Expand a peer match to compare amounts, frequency, timing and repeated routes.','The trait scores explain what makes the accounts similar.'],
      ['Разберитесь в необычном поведении','Разверните похожий счёт и сравните суммы, частоту, время и повторяющиеся пути.','Оценки по признакам покажут, в чём сходство.'],kkJourneys.tour.behavior),
    step('relationships','relationships','relationships','relationships','account',
      ['Discover Connections','Read the Verified and Inferred labels, then open a signal.','You can inspect the source reference or see which records suggested the possible link.'],
      ['Найдите связи','Посмотрите метки «Подтверждено» и «Предполагается», затем откройте признак.','Вы увидите исходную запись или сведения, которые подсказали возможную связь.'],kkJourneys.tour.relationships),
    step('radar','radar','radar','patterns','finding',
      ['Find Unusual Activity','Filter by finding type or open a high-priority row.','The finding shows which rule fired and which ledger facts support a review.'],
      ['Найдите необычную активность','Выберите тип наблюдения или откройте строку с высоким приоритетом.','Наблюдение покажет сработавшее правило и связанные записи.'],kkJourneys.tour.radar),
    step('investigator','investigator','ask','investigator','ask',
      ['Ask Questions About Your Financial Network','Try “Where did the money go?” or type your own question. Expand the supporting references.','The answer cites the ledger records that you can open to verify it.'],
      ['Задайте вопрос о финансовой сети','Выберите «Куда ушли деньги?» или введите свой вопрос. Разверните ссылки.','Ответ укажет записи, которые можно открыть для проверки.'],kkJourneys.tour.investigator),
    step('history','universe','timeline','history','history',
      ['Travel Through Financial History','Move the date slider or select a start and end date in Date range.','The graph filters to that time and a 24-hour comparison appears below it.'],
      ['Вернитесь к прошлым операциям','Передвиньте ползунок или задайте начало и конец в «Диапазон дат».','Схема покажет нужный период. Ниже появится сравнение за 24 часа.'],kkJourneys.tour.history),
    step('simulation','simulation','scenario-run','simulation','simulation',
      ['Test Different Scenarios','Remove the selected account and run a scenario. Switch between Original and Scenario.','The comparison shows surviving transfers and connected groups. The ledger stays intact.'],
      ['Проверьте разные сценарии','Уберите выбранный счёт и запустите сценарий. Переключитесь между «Исходная сеть» и «Сценарий».','Сравнение покажет оставшиеся переводы и группы. Реестр останется прежним.'],kkJourneys.tour.simulation),
    step('case','workspace','case-create','cases','case',
      ['Organize Your Investigation','Name a case and choose Create case. In the case, attach evidence, save a snapshot, or add a note.','The case keeps those materials and shows whether it has been submitted for review.'],
      ['Соберите материалы дела','Назовите дело и нажмите «Создать дело». Прикрепите запись, снимок или заметку.','Материалы сохранятся вместе со статусом проверки.'],kkJourneys.tour.case,'case-list'),
    step('report','workspace','exports','reports','case',
      ['Turn Findings Into a Report','Open a saved case and choose PDF or JSON.','The download contains the case materials and references another analyst can verify.'],
      ['Подготовьте отчёт','Откройте сохранённое дело и нажмите «PDF» или «JSON».','Выгрузка содержит материалы и ссылки, которые может проверить другой аналитик.'],kkJourneys.tour.report,'case-list')
  ],
  demo:[
    step('source','universe','account','account','account',
      ['Identify the starting account','Read the account name and verified identifier.','Meridian Trading is the account at the center of the flagged pattern. The first credit shows who sent money to it.'],
      ['Найдите центральный счёт','Прочитайте название и подтверждённый идентификатор.','Meridian Trading — центральный счёт наблюдения. Первое поступление покажет отправителя.'],kkJourneys.demo.source),
    step('incoming','universe','transaction','transfer','credit',
      ['Observe money coming in','Read the sender, amount, and time on this recorded transfer.','The receiver is the account in focus. Use this transfer as a reference for the later outflows.'],
      ['Посмотрите поступление','В записи прочитайте отправителя, сумму и время.','Получатель — счёт в фокусе. Эту запись можно сопоставить с последующими списаниями.'],kkJourneys.demo.incoming),
    step('outgoing','universe','transaction','transfer','debit',
      ['Follow an outgoing transfer','Compare this sender and UTC time with the previous record.','The central account now sends money to another account. Its recipient is the next point to check.'],
      ['Проследите исходящий перевод','Сравните отправителя и время UTC с предыдущей записью.','Центральный счёт отправляет деньги дальше. Следующий шаг — изучить получателя.'],kkJourneys.demo.outgoing),
    step('intermediary','universe','account','account','intermediary',
      ['Inspect an intermediary','Review Inbound, Outbound and Latest transfers, or choose Expand links.','The account panel helps you see which accounts received transfers from this intermediary.'],
      ['Изучите промежуточный счёт','Посмотрите «Поступления», «Списания» и «Последние переводы» или нажмите «Развернуть связи».','Панель помогает выяснить, куда посредник отправлял переводы.'],kkJourneys.demo.intermediary),
    step('timing','stories','story-sequence','flow','story',
      ['Measure the time between transfers','Choose two neighboring rows and compare their UTC times or the gap shown in the full sequence.','Related transfers completed minutes apart are worth checking against the account’s usual activity.'],
      ['Сравните время переводов','Выберите соседние строки и сравните их время UTC или показанный интервал.','Близкие по времени переводы стоит сопоставить с обычной активностью счёта.'],kkJourneys.demo.timing),
    step('play','stories','story-sequence','flow','story',
      ['Play the money flow','Choose Play sequence and watch the transfers branch and later join.','You see the order and direction of the recorded routes through the network.'],
      ['Проиграйте движение денег','Нажмите «Воспроизвести последовательность» и посмотрите, как маршруты расходятся и сходятся.','Будут видны порядок и направление зарегистрированных переводов.'],kkJourneys.demo.play),
    step('ask','investigator','ask','investigator','ask',
      ['Ask FFBI to explain the pattern','Choose “Where did the money go?” and expand the references. You can prepare the answer for a case.','The answer cites the transfers you just followed. The references let you verify the explanation.'],
      ['Попросите FFBI объяснить схему','Выберите «Куда ушли деньги?» и разверните ссылки. Ответ можно подготовить для дела.','Ответ опирается на просмотренные операции. Ссылки позволяют проверить объяснение.'],kkJourneys.demo.ask),
    step('scenario','simulation','scenario-run','simulation','simulation',
      ['Run a What-If simulation','Choose Remove account, select Meridian Trading, and run the scenario. Compare Original and Scenario.','You can see which transfers and connections depend on the central account.'],
      ['Смоделируйте изменение','Выберите «Исключить счёт» и Meridian Trading, затем запустите сценарий. Сравните версии.','Будет видно, какие переводы и связи зависят от центрального счёта.'],kkJourneys.demo.scenario),
    step('save','workspace','case-create','cases','case',
      ['Save the investigation','Create a case and attach one ledger reference or write a note.','The case keeps an evidence trail and is ready to export.'],
      ['Сохраните расследование','Создайте дело и прикрепите ссылку на перевод или добавьте заметку.','Материалы сохранятся в деле, которое можно выгрузить.'],kkJourneys.demo.save,'case-list'),
    step('export','workspace','exports','reports','case',
      ['Generate a report','Select PDF for a readable report or JSON for the structured case data.','Open the downloaded file and find a transfer reference you inspected earlier.'],
      ['Подготовьте отчёт','Нажмите «PDF» для чтения или «JSON» для выгрузки структурированных данных.','Откройте файл и найдите ссылку на операцию, которую уже изучили.'],kkJourneys.demo.export,'case-list')
  ]
}
