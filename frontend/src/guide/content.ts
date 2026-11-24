import type {View} from '../types'

import {kkControls, kkTopics} from './kk'
import {local, type Locale, type Localized} from '../i18n/locales'
export {languages, local} from '../i18n/locales'
export type {Locale, Localized} from '../i18n/locales'
export type Level = 'beginner' | 'advanced'

export type Diagram = 'graph'|'flow'|'cycle'|'split'|'risk'|'simulation'
type Lesson = {title:string;what:string;why:string;how:string;advanced:string}
const lesson = ([title,what,why,how,advanced]:[string,string,string,string,string]):Lesson => ({title,what,why,how,advanced})
const translated = <T,>(en:T,ru:T,kk:T):Localized<T> => ({en,ru,kk})

export const topics = {
  start: {view:'universe', text:translated(lesson([
    'Getting Started','FFBI helps you see who transacts with whom and follow money through several accounts.',
    'Start with a finding so you have a small set of records to investigate.',
    'Open Anomaly Radar, select a finding, and use Explain this network or Play flow. Try the interactive tour to meet each tool.',
    'Cases preserve copies of the selected graph and transaction evidence for review.'
  ]),lesson([
    'Начало работы','FFBI показывает, кто с кем проводит платежи, и помогает проследить путь денег через несколько счетов.',
    'Начните с одного наблюдения, чтобы работать с небольшим набором записей.',
    'Откройте «Радар аномалий», выберите наблюдение и нажмите «Объяснить сеть» или «Воспроизвести переводы». Изучить инструменты можно в интерактивном туре.',
    'В деле сохраняются копии выбранной схемы и записей об операциях.'
  ]),lesson(kkTopics.start))},
  dashboard: {view:'overview', text:translated(lesson([
    'Understanding the Dashboard','Overview counts transfers, accounts, and patterns flagged for review. Active cases are cases still open or under review.',
    'Use it to see how much data is loaded and where to start reviewing.',
    'Compare the counts and priority groups. Select a row in Priority review to open its network.',
    'Gross volume sums transfers in USD equivalent and may count money more than once across hops. High-priority findings score 85 or above. Counts describe findings, including multiple findings on one account.'
  ]),lesson([
    'Обзор показателей','На странице «Обзор» показано число операций, счетов и наблюдений для проверки. Активные дела открыты или находятся на рассмотрении.',
    'Так проще оценить объём данных и выбрать, что проверить в первую очередь.',
    'Сравните показатели и уровни приоритета. Нажмите на строку в «Приоритетная проверка», чтобы открыть её связи.',
    'Валовой объём в эквиваленте USD может учитывать одни и те же средства на разных этапах. Высокий приоритет начинается с 85 баллов. У одного счёта может быть несколько наблюдений.'
  ]),lesson(kkTopics.dashboard))},
  graph: {view:'universe',diagram:'graph',text:translated(lesson([
    'Understanding the 3D Financial Universe','Each object has a 3D model. Cards represent accounts, offices represent companies, buildings with columns represent banks, figures represent people, and phones represent devices. A line, called an edge, shows a transfer route or recorded link.',
    'The graph helps you see which accounts connect and which transfers belong to the finding.',
    'Drag to rotate, scroll to zoom, and click a model to inspect it. Double-click to focus. Search for an account or choose a community to narrow the graph.',
    'Larger models generally have more links or are central to the finding. Thicker highlighted transfer lines encode larger combined amounts. Color distinguishes entity types, account groups, and highlighted findings. Arrowheads give transfer direction.'
  ]),lesson([
    'Как читать трёхмерную сеть','У каждого объекта своя 3D-модель. Счета выглядят как банковские карты, компании как офисы, банки как здания с колоннами, люди как фигурки, а устройства как смартфоны. Линия, или ребро, показывает маршрут перевода или связь из источника.',
    'На схеме видно, какие счета связаны и какие операции входят в наблюдение.',
    'Перетаскивайте схему для поворота и прокручивайте для масштаба. Нажмите на модель для просмотра, дважды — для фокусировки. Поиск и фильтр по группам помогают сократить схему.',
    'Крупные модели обычно имеют больше связей или важны для наблюдения. Более толстые выделенные линии означают больший суммарный объём. Цвет обозначает тип объекта, группу счёта или выделенное наблюдение. Стрелки показывают направление.'
  ]),lesson(kkTopics.graph))},
  account: {view:'universe',text:translated(lesson([
    'Inspecting an Account','The account panel shows its ledger ID, registered parties when available, incoming and outgoing amounts, connected accounts and recent transfers.',
    'You can see what an account received, sent, and who it transacted with before drawing a conclusion.',
    'Click an account or choose it from Search. Open a recent transfer to see its sender, receiver, amount, and time.',
    'Inbound and outbound totals use USD equivalents across the ledger. Connected findings are analysis leads. Registered signatories or organizations are confirmed source links.'
  ]),lesson([
    'Проверка счёта','Панель показывает идентификатор счёта, зарегистрированных участников, если они указаны, поступления, списания, контрагентов и последние переводы.',
    'Прежде чем делать выводы, выясните, какие суммы поступили и ушли и с кем проводились операции.',
    'Нажмите на счёт на схеме или найдите его через поиск. Откройте недавний перевод, чтобы увидеть отправителя, получателя, сумму и время.',
    'Итоги по поступлениям и списаниям приведены в эквиваленте USD по всему реестру. Связанные наблюдения служат поводом для проверки. Зарегистрированные подписанты и организации подтверждены источником.'
  ]),lesson(kkTopics.account))},
  flow: {view:'stories',diagram:'flow',text:translated(lesson([
    'Investigating Money Flows','A story puts linked transfers in time order, from the first sender through intermediate accounts to the observed destinations.',
    'Amounts and time gaps help you identify where a route branches and how quickly money moves.',
    'Choose Play flow or open Money Flow Stories. Pause and select a row to see its sender, receiver, amount and UTC timestamp.',
    'These are recorded transfers. Sequence and timing support a possible route, while the ledger alone cannot establish that the same underlying funds passed through every account.'
  ]),lesson([
    'Как проследить движение денег','История показывает связанные переводы по времени: от первого отправителя через промежуточные счета до получателей.',
    'Суммы и интервалы помогают увидеть, где маршрут раздваивается и как быстро движутся деньги.',
    'Нажмите «Воспроизвести переводы» или откройте «Истории движения денег». Приостановите воспроизведение и выберите строку, чтобы увидеть участников, сумму и время в UTC.',
    'Последовательность и время подтверждают возможный маршрут. По одному реестру нельзя установить, что через все счета прошли именно те же средства.'
  ]),lesson(kkTopics.flow))},
  behavior: {view:'behavior',text:translated(lesson([
    'Understanding Account Behavior','A fingerprint summarizes how often an account transacts, usual amounts, when it sends money, and how often it uses the same routes.',
    'Compare accounts to spot differences, such as a normally steady account that sends several large transfers in minutes.',
    'Open Behavior Intelligence with an account selected. Expand a peer match to see which traits are similar.',
    'The panel compares nine observed traits including inflow share, diversity of counterparties, off-hours use, and rapid pass-through. Similarity summarizes the strength of a match and does not establish fraud.'
  ]),lesson([
    'Сравнение поведения счетов','Профиль показывает частоту операций, обычные суммы и время переводов, а также повторяемость маршрутов.',
    'Сравнение помогает заметить отклонения. Например, обычно спокойный счёт внезапно отправляет несколько крупных переводов за минуты.',
    'Выберите счёт и откройте «Анализ поведения». Разверните совпадение, чтобы увидеть похожие признаки.',
    'Сравниваются девять признаков, включая долю поступлений, разнообразие контрагентов, операции вне обычных часов и быстрые списания после поступлений. Сходство само по себе не указывает на мошенничество.'
  ]),lesson(kkTopics.behavior))},
  relationships: {view:'relationships',text:translated(lesson([
    'Discovering Relationships','Verified links come from records. An inferred link is a possible connection suggested by clues such as a shared device, IP range, phone number, or similar behavior.',
    'Clues help you decide which connection to check and which records to request.',
    'Open Relationship Discovery, read the status on each match, and select a supporting reference.',
    'A confidence score combines available signals. Shared identifiers can belong to unrelated people or systems. Verify ownership independently if it matters.'
  ]),lesson([
    'Связи между участниками','Подтверждённые связи взяты из записей. Предполагаемая связь — возможное совпадение по устройству, диапазону IP, телефону или поведению.',
    'Такие подсказки помогают решить, какие связи и документы стоит проверить.',
    'Откройте «Поиск связей», посмотрите статус совпадения и выберите подтверждающую запись.',
    'Оценка уверенности объединяет доступные признаки. Общими идентификаторами могут пользоваться разные люди или системы. При необходимости проверьте владельца отдельно.'
  ]),lesson(kkTopics.relationships))},
  patterns: {view:'radar',diagram:'cycle',text:translated(lesson([
    'Understanding Financial Patterns','An anomaly stands out from expected activity. A pattern is several related actions, such as a chain of transfers that returns to its first account.',
    'A suspicious pattern is a lead worth examining. A risk indicator is a reason it was flagged. A confirmed fact is a recorded amount, date, or transfer.',
    'Pick a finding in Anomaly Radar and expand Why this was flagged and Verified ledger evidence.',
    'The same pattern can have ordinary explanations, including settlement or treasury work. FFBI surfaces evidence for review. An anomaly is not proof of criminal activity.'
  ]),lesson([
    'Как читать финансовые паттерны','Аномалия отличается от обычной активности. Паттерн — это несколько связанных действий, например цепочка переводов с возвратом на исходный счёт.',
    'Подозрительная схема — повод для проверки. Индикатор риска — причина отметки. Подтверждённый факт — сумма, дата или перевод из реестра.',
    'Выберите наблюдение в «Радар аномалий» и разверните «Причины отметки» и «Подтверждённые записи реестра».',
    'У схемы могут быть обычные объяснения, например расчёты или казначейские операции. FFBI показывает записи для проверки. Аномалия не доказывает преступление.'
  ]),lesson(kkTopics.patterns))},
  risk: {view:'universe',diagram:'risk',text:translated(lesson([
    'Understanding Risk Scores','An anomaly score from 0 to 100 ranks an unusual finding for review. It describes the available data.',
    'A higher score helps you decide what to review first.',
    'Read Why this was flagged, then check the amounts, timing and routes in the linked records.',
    'The score is not a probability of fraud. FFBI uses rule-specific scores and a peer baseline. The listed reasons explain the finding rather than fixed point contributions.'
  ]),lesson([
    'Что означает оценка риска','Оценка аномалии от 0 до 100 помогает расставить приоритеты по имеющимся данным.',
    'Чем выше оценка, тем раньше стоит рассмотреть наблюдение.',
    'Прочитайте «Причины отметки», затем проверьте суммы, время и маршруты по связанным записям.',
    'Оценка не показывает вероятность мошенничества. У правил свои баллы, также доступно сравнение с другими счетами. Причины объясняют наблюдение и не складываются в оценку по фиксированным весам.'
  ]),lesson(kkTopics.risk))},
  investigator: {view:'investigator',text:translated(lesson([
    'Using the AI Investigator','Ask plain-language questions about the selected account or finding. FFBI looks up ledger records and cites them in the answer.',
    'Start with a question, then check the references before using the answer in a case.',
    'Try “Where did the money go?”, “Which accounts are connected?”, or “What changed in the last 24 hours?”. Open a supporting reference to inspect it.',
    'Ask for a route between two named accounts or a reason for a risk flag. Answers come from bounded ledger queries. Clearly marked hypotheses require further review.'
  ]),lesson([
    'Как работать с ИИ-исследователем','Задайте вопрос о выбранном счёте или наблюдении обычными словами. FFBI ищет записи в реестре и ссылается на них.',
    'Сначала задайте вопрос, затем проверьте ссылки, прежде чем добавить ответ в дело.',
    'Попробуйте подсказки «Куда ушли деньги?» или «Что изменилось за последние 24 часа?». Откройте связанную запись для проверки.',
    'Укажите два счёта для поиска маршрута или спросите о причинах отметки риска. Ответы опираются на запросы к реестру. Помеченные гипотезы требуют дополнительной проверки.'
  ]),lesson(kkTopics.investigator))},
  history: {view:'universe',text:translated(lesson([
    'Understanding Financial History','The timeline shows how many transfers occurred each day. Its slider changes the day shown in the graph.',
    'Compare the network before and after an event to see which connections or volumes changed.',
    'Move the Historical snapshot slider or open Date range and enter two dates. Read the 24-hour comparison below the graph. Use Play to run the current sequence.',
    'The graph includes verified transfers in the chosen UTC period. The comparison uses two consecutive 24-hour intervals ending at the selected date. With a finding open, playback follows that finding’s exact sequence.'
  ]),lesson([
    'Анализ финансовой истории','Шкала показывает число переводов по дням. Ползунок меняет дату отображения схемы.',
    'Сравните сеть до и после события, чтобы заметить изменение связей и объёмов.',
    'Передвиньте ползунок «Снимок на дату» или задайте даты в «Диапазон дат». Под схемой появится сравнение за 24 часа. Кнопка воспроизведения запускает выбранную последовательность.',
    'В схеме учитываются подтверждённые переводы за выбранный период UTC. Сравниваются два соседних 24-часовых интервала. При открытом наблюдении проигрывается его точная последовательность.'
  ]),lesson(kkTopics.history))},
  simulation: {view:'simulation',diagram:'simulation',text:translated(lesson([
    'Running Simulations','A simulation temporarily removes a transfer or changes an account’s connections in a copy of the network.',
    'Compare the copies to see which paths depend on one account and what routes remain.',
    'Choose an action and target, then Run scenario. Switch between Original and Scenario to compare the results.',
    'The source ledger remains intact. The comparison counts surviving finding transfers and connected groups, and checks for an alternative time-ordered route where available.'
  ]),lesson([
    'Моделирование сценариев','Сценарий временно убирает перевод или меняет связи счёта в копии сети.',
    'Сравните версии, чтобы понять, какие пути зависят от одного счёта и какие маршруты остаются.',
    'Выберите действие и объект, затем нажмите «Запустить сценарий». Для сравнения переключайтесь между «Исходная сеть» и «Сценарий».',
    'Исходный реестр остаётся прежним. Сравнение учитывает оставшиеся переводы наблюдения, связанные группы и, если есть, альтернативный маршрут по времени.'
  ]),lesson(kkTopics.simulation))},
  cases: {view:'workspace',text:translated(lesson([
    'Managing Investigation Cases','A case keeps a finding, its references, notes and graph snapshots together.',
    'A reviewer can retrace your steps and see which conclusions are still open.',
    'Create a case from a finding. Attach ledger evidence, save your graph view, and add a note. Submit the case when it is ready for review.',
    'A senior analyst or administrator can record a conclusion after submission. Open and In review are active stages. A reviewed case is read-only.'
  ]),lesson([
    'Ведение дел','В деле хранятся наблюдение, ссылки, заметки и снимки графа.',
    'Проверяющий может восстановить ход работы и увидеть, какие выводы ещё обсуждаются.',
    'Создайте дело по наблюдению. Прикрепите запись, сохраните схему и добавьте заметку. Когда материалы готовы, отправьте дело на проверку.',
    'Итог после отправки записывает старший аналитик или администратор. «Открыто» и «На проверке» — активные стадии. Проверенное дело доступно для чтения.'
  ]),lesson(kkTopics.cases))},
  reports: {view:'workspace',text:translated(lesson([
    'Generating Reports','PDF gives you a readable case report. JSON exports the structured records and graph coordinates.',
    'Share the explanation together with the references, so another analyst can verify it.',
    'Open a saved case and select PDF or JSON. Look for the TX reference beside each recorded transfer.',
    'Exports include the available timeline, snapshot, model findings, attached evidence, hypotheses, notes, scenarios, and analyst conclusion. The case status indicates whether it has been reviewed.'
  ]),lesson([
    'Подготовка отчётов','PDF — читаемый отчёт по делу. JSON содержит структурированные записи и координаты схемы.',
    'Передавайте объяснение вместе со ссылками, чтобы другой аналитик мог проверить его.',
    'Откройте сохранённое дело и выберите PDF или JSON. У каждой операции есть ссылка TX.',
    'Выгрузка включает доступные хронологию, снимок, наблюдения модели, материалы, гипотезы, заметки, сценарии и вывод аналитика. Статус показывает, прошло ли дело проверку.'
  ]),lesson(kkTopics.reports))},
  data: {view:'data',text:translated(lesson([
    'Working with Data Sources','Data Sources shows the imported ledger and individual transfer records.',
    'Inspect the underlying record directly to confirm the details quoted by a finding.',
    'Select a transaction reference to inspect it. Use the page controls to browse older records.',
    'Analysts can upload CSV or JSON transactions. FFBI updates the graph and findings after each import.'
  ]),lesson([
    'Работа с источниками данных','Раздел «Источники данных» показывает загруженный реестр и отдельные операции.',
    'Проверьте исходную запись, чтобы сверить сведения из наблюдения.',
    'Выберите ссылку на операцию. Для просмотра более ранних записей используйте переключатели страниц.',
    'Аналитики могут загрузить операции в CSV или JSON. FFBI пересчитывает граф и наблюдения после импорта.'
  ]),lesson(kkTopics.data))},
  settings: {view:'settings',text:translated(lesson([
    'Settings and Accessibility','Settings controls graph motion, the keyboard-friendly list, and guide preferences.',
    'Choose the display and explanation level that helps you work.',
    'Enable Reduced motion or Accessible entity list. Restart the interactive tour here whenever you want.',
    'Guide preferences and progress are stored by this browser. Graph and case data follow the active account.'
  ]),lesson([
    'Настройки и доступность','В настройках можно уменьшить анимацию графа, включить список для клавиатуры и изменить параметры справки.',
    'Выберите удобное отображение и уровень пояснений.',
    'Включите «Меньше анимации» или «Доступный список объектов». Интерактивный тур можно запустить снова в этом разделе.',
    'Браузер хранит настройки и прогресс обучения. Граф и дела зависят от текущей учётной записи.'
  ]),lesson(kkTopics.settings))},
  faq: {view:'universe',text:translated(lesson([
    'FAQ','Find answers about evidence, the timeline, and working without 3D.',
    'Use these explanations when you are unsure what a number or view means.',
    'Search a question or browse the glossary and the verified record behind a finding.',
    'The accessible list shows the same current entities and visible routes. Use Settings to switch between the list and the 3D universe.'
  ]),lesson([
    'Частые вопросы','Здесь собраны ответы о записях, шкале времени и работе без трёхмерного графа.',
    'Эти пояснения помогут, если значение числа или вида схемы неясно.',
    'Найдите вопрос через поиск, откройте словарь или проверьте запись за наблюдением.',
    'В списке показаны те же текущие объекты и видимые маршруты. Переключиться между списком и графом можно в настройках.'
  ]),lesson(kkTopics.faq))}
} as const
export type Topic = keyof typeof topics

type ControlText = [title:string, what:string, how:string, advanced?:string]
const control = (topic:Topic,en:ControlText,ru:ControlText,kk:ControlText) => ({topic, text:translated(en,ru,kk)})
export const controls = {
  metrics: control('dashboard',['Network metrics','Counts cover the loaded data. Accounts are included in entities.','Compare accounts, transfers, flagged findings, and cases to scope your review.'],['Показатели сети','В расчёт входят загруженные данные. Счета входят в число объектов.','Сравните счета, операции, наблюдения и дела, чтобы определить объём проверки.'],kkControls.metrics),
  volume: control('dashboard',['Gross USD volume','The total of recorded amounts converted to USD equivalent.','Use it to compare activity between periods. A route can include multiple transfers of the same money.'],['Валовой объём в USD','Сумма зарегистрированных переводов в эквиваленте USD.','Сравнивайте активность по периодам. Один маршрут может включать несколько переводов одних и тех же денег.'],kkControls.volume),
  casesCount: control('dashboard',['Active investigations','Cases you can see that are open or in review.','Open Investigation Workspace to see the individual cases.'],['Активные дела','Доступные вам дела, которые открыты или находятся на проверке.','Откройте «Работа с делами», чтобы посмотреть отдельные дела.'],kkControls.casesCount),
  distribution: control('risk',['Review priority','Counts of flagged findings at each review priority.','Select a finding in Priority review to see why it received its score.'],['Приоритет проверки','Число наблюдений на каждом уровне приоритета.','Выберите наблюдение в «Приоритетная проверка», чтобы узнать причину оценки.'],kkControls.distribution),
  search: control('graph',['Find an account or transfer','Search by name, account ID, or transfer reference.','Choose a result to open it in the universe. Enter opens the first match.'],['Поиск счёта или операции','Поиск по названию, номеру счёта или ссылке на перевод.','Выберите результат, чтобы открыть его на схеме. Enter открывает первое совпадение.'],kkControls.search),
  community: control('graph',['Filter by community','A community is a group of related entities.','Choose one community to narrow the visible network. Choose All communities to clear the filter.'],['Фильтр по группе','Группа объединяет связанные объекты.','Выберите одну группу, чтобы сузить схему, или «Все группы», чтобы сбросить фильтр.'],kkControls.community),
  layout: control('graph',['Arrange the graph','The layout changes how the models are arranged in space.','Choose Communities, Geography, Risk, or another layout to see the network from a different angle.'],['Расположение графа','Раскладка меняет размещение моделей на схеме.','Выберите «Группы», «География», «Риск» или другой вариант, чтобы посмотреть на связи иначе.'],kkControls.layout),
  fullscreen: control('graph',['Fullscreen graph','Give the graph more room.','Press this button to enter or exit fullscreen. Escape also exits.'],['Граф на весь экран','Так для схемы будет больше места.','Нажмите кнопку для входа и выхода. Выйти также можно клавишей Escape.'],kkControls.fullscreen),
  explore: control('graph',['Explore the graph','Look around the financial network at your own pace.','Click a model to inspect it and drag the background to rotate.'],['Ручной просмотр','Изучайте финансовую сеть в удобном темпе.','Нажмите на модель для просмотра или перетащите фон для поворота.'],kkControls.explore),
  guided: control('graph',['Show an important finding','Focus the current finding and animate its observed flow.','Select Guided to start. Choose Explore when you want to navigate freely.'],['Показать важное наблюдение','Схема фокусируется на наблюдении и показывает движение денег.','Нажмите «С подсказками» для запуска или «Обзор» для ручного просмотра.'],kkControls.guided),
  zoom: control('graph',['Zoom the graph','Move the camera closer or farther from the network.','Use plus or minus, the scroll wheel, or a pinch on touch screens.'],['Масштаб графа','Приближает или отдаляет камеру.','Используйте плюс, минус, колёсико мыши или жест двумя пальцами.'],kkControls.zoom),
  reset: control('graph',['Return to overview','Clear the current graph focus and go back to the broader view.','Click Return to overview to reset the focus and graph filters.'],['Вернуться к обзору','Сбрасывает текущий фокус и возвращает общую схему.','Нажмите «Вернуться к общему виду», чтобы сбросить фокус и фильтры графа.'],kkControls.reset),
  camera: control('graph',['Change camera angle','Cycle through front, angled, and top views.','Press the camera button to switch views when models overlap.'],['Ракурс камеры','Переключает вид спереди, под углом и сверху.','Нажмите кнопку камеры, если модели перекрывают друг друга.'],kkControls.camera),
  list: control('graph',['Accessible entity list','A table shows the same visible entities and transfers.','Choose the list icon, then use Tab to inspect entries. Choose 3D view to switch back.'],['Доступный список объектов','Таблица показывает те же видимые объекты и переводы.','Включите список, перемещайтесь по записям клавишей Tab и нажмите «3D view» для возврата.'],kkControls.list),
  locator: control('graph',['Graph orientation','A small map shows where visible objects are arranged.','Choose a dot on the small map to focus it.'],['Ориентация на графе','Мини-карта показывает расположение видимых объектов.','Нажмите на точку мини-карты, чтобы навести фокус.'],kkControls.locator),
  legend: control('graph',['Graph key','Shapes and colors identify accounts, companies, people, devices, banks and highlighted objects.','Check the key before interpreting a new symbol.'],['Легенда графа','Формы и цвета обозначают счета, компании, людей, устройства, банки и выделенные объекты.','Сверяйтесь с легендой, если видите незнакомый символ.'],kkControls.legend),
  expand: control('account',['Expand links','Show more entities connected to the selected account.','Select an account and choose Expand links.','Each expansion brings in a bounded set of linked neighbors.'],['Развернуть связи','Показывает больше объектов, связанных с выбранным счётом.','Выберите счёт и нажмите «Развернуть связи».','За один раз добавляется ограниченное число связанных объектов.'],kkControls.expand),
  collapse: control('account',['Collapse a branch','Undo an expansion or hide the selected entity in the current view.','Choose Collapse when you want to simplify the displayed network.'],['Свернуть ветвь','Отменяет разворачивание или скрывает выбранный объект на текущей схеме.','Нажмите «Свернуть», чтобы упростить схему.'],kkControls.collapse),
  focus: control('account',['Focus on the entity','Center the camera near the selected entity.','Click Focus camera or double-click the entity on the graph.'],['Фокус на объекте','Приближает и направляет камеру к выбранному объекту.','Нажмите «Фокус камеры» или дважды щёлкните по объекту.'],kkControls.focus),
  transfer: control('flow',['Inspect a transfer','The underlying record gives the sender, receiver, amount and time.','Click a transfer reference or choose the sender or receiver to inspect their account.'],['Просмотр перевода','Исходная запись показывает отправителя, получателя, сумму и время.','Нажмите на ссылку операции или выберите участника для просмотра счёта.'],kkControls.transfer),
  story: control('flow',['Play the flow','Animate the selected finding one transfer at a time.','Press Play flow. Pause or choose a story row to examine a specific transfer.'],['Проиграть движение денег','Показывает переводы выбранного наблюдения по очереди.','Нажмите «Воспроизвести переводы». Приостановите или выберите строку, чтобы изучить перевод.'],kkControls.story),
  playback: control('history',['Playback controls','Play, pause, restart, or step through the current sequence.','With a finding selected, step through transfers. From the broad view, playback advances by day.'],['Кнопки воспроизведения','Запуск, пауза, возврат в начало и переход по шагам.','При выбранном наблюдении шаги идут по переводам, в общем обзоре — по дням.'],kkControls.playback),
  scrub: control('history',['Change the snapshot date','Show the network as of a selected day.','Drag the slider or move it with the arrow keys. A 24-hour comparison appears below the graph.'],['Дата снимка','Показывает сеть на выбранный день.','Передвиньте ползунок мышью или стрелками. Под графом появится сравнение за 24 часа.'],kkControls.scrub),
  dateRange: control('history',['Filter by date range','Limit graph transfers to an inclusive period in UTC.','Choose a start and end date, then Apply range. Clear range returns to the full ledger.'],['Диапазон дат','Ограничивает переводы на графе включительным диапазоном дат в UTC.','Задайте две даты и нажмите «Применить диапазон». «Сбросить диапазон» возвращает весь период.'],kkControls.dateRange),
  finding: control('patterns',['Open a finding','A finding groups records that meet a rule or stand out from a baseline.','Select the row to open its network, explanation and references.'],['Открыть наблюдение','Наблюдение объединяет записи, совпавшие с правилом или отличающиеся от обычных.','Нажмите на строку, чтобы открыть схему, объяснение и ссылки.'],kkControls.finding),
  anomalyFilter: control('patterns',['Filter finding type','Show findings with the same kind of unusual activity.','Choose a type to focus on it or All finding types to see every result.'],['Фильтр типа наблюдения','Показывает наблюдения с одинаковым видом отклонения.','Выберите тип для просмотра или «Все типы наблюдений» для всех результатов.'],kkControls.anomalyFilter),
  riskScore: control('risk',['Anomaly score','A score from 0 to 100 ranks the selected finding for review.','Read Why this was flagged and check the linked transactions. The score is not proof of fraud.'],['Оценка аномалии','Оценка от 0 до 100 определяет приоритет проверки.','Прочитайте «Причины отметки» и проверьте ссылки. Оценка не доказывает мошенничество.'],kkControls.riskScore),
  evidence: control('investigator',['Supporting reference','A reference points to a record or entity used in the explanation.','Select the reference to inspect the item and compare it with the claim.'],['Подтверждающая ссылка','Указывает на запись или объект, использованный в объяснении.','Выберите ссылку и сверяйте сведения с выводом.'],kkControls.evidence),
  explain: control('investigator',['Explain this network','Ask FFBI to summarize the current finding using ledger evidence.','Open the answer and expand supporting references to check it.'],['Объяснить сеть','FFBI кратко описывает выбранное наблюдение по данным реестра.','Откройте ответ и разверните ссылки для проверки.'],kkControls.explain),
  ask: control('investigator',['Ask a question','Query the current account or finding.','Choose a suggested question or type your own, then send it. Read supporting references below the answer.'],['Задать вопрос','Запрос о текущем счёте или наблюдении.','Выберите подсказку или введите свой вопрос и отправьте. Под ответом будут ссылки.'],kkControls.ask),
  saveAnswer: control('cases',['Save an answer for review','Prepare the current answer to attach to a case.','Select an existing case or create one, then choose Save finding.'],['Сохранить ответ для проверки','Готовит текущий ответ для добавления в дело.','Откройте или создайте дело, затем нажмите «Сохранить наблюдение».'],kkControls.saveAnswer),
  similarity: control('behavior',['Compare a peer match','See which account traits contributed to a similarity match.','Open a matching account to read the trait-by-trait scores.'],['Сравнить похожие счета','Показывает, какие черты повлияли на сходство.','Разверните совпадение, чтобы увидеть совпадение по отдельным признакам.'],kkControls.similarity),
  confidence: control('relationships',['Relationship confidence','A score summarizes how strongly available clues suggest a connection.','Open the supporting signals and check which are verified and which are inferred.'],['Уверенность в связи','Оценка показывает силу признаков предполагаемой связи.','Откройте признаки и проверьте, какие подтверждены, а какие предполагаются.'],kkControls.confidence),
  scenarioAction: control('simulation',['Choose scenario and target','Select which change to study and which account or transfer it applies to.','Choose remove, disconnect or exclude, and pick the target before you run it.'],['Действие и объект сценария','Выбирает изменение и счёт или перевод, к которому оно относится.','Задайте действие и объект перед запуском.'],kkControls.scenarioAction),
  run: control('simulation',['Run a simulation','Calculate a temporary network after the change you chose.','Run the scenario and compare links, surviving transfers, and connected groups.'],['Запустить сценарий','Вычисляет временную схему после выбранного изменения.','Запустите сценарий и сравните связи, оставшиеся операции и группы.'],kkControls.run),
  compare: control('simulation',['Original and scenario','Switch which copy is shown in the graph.','Compare totals, disconnected groups, and remaining routes in the result.'],['Исходная схема и сценарий','Переключает отображаемую версию графа.','Сравните итоги, группы и сохранившиеся маршруты.'],kkControls.compare),
  saveScenario: control('cases',['Save a scenario for review','Prepare this comparison to attach to a case.','Open or create a case, then attach the scenario from the case panel.'],['Сохранить сценарий для проверки','Готовит результаты сравнения к добавлению в дело.','Откройте или создайте дело и прикрепите сценарий из панели дела.'],kkControls.saveScenario),
  caseCreate: control('cases',['Create an investigation case','Store the current finding and its source evidence together.','Enter a case title and choose Create case. You can then add notes and evidence.'],['Создать дело','Сохраняет текущее наблюдение вместе с исходными записями.','Введите название и нажмите «Создать дело». Затем можно добавить заметки и материалы.'],kkControls.caseCreate),
  caseOpen: control('cases',['Open a saved case','View its findings, notes, status and report exports.','Select a case from the list to see its details.'],['Открыть сохранённое дело','Показывает наблюдения, заметки, статус и выгрузки.','Выберите дело из списка, чтобы открыть подробности.'],kkControls.caseOpen),
  snapshot: control('cases',['Save current graph view','Capture the selected layout, date range and visible graph as evidence.','Select Save current graph view. Open the saved view inside the case to see the snapshot.'],['Сохранить вид графа','Фиксирует раскладку, даты и видимую схему как материал дела.','Нажмите «Сохранить текущий вид графа». Снимок можно открыть в самом деле.'],kkControls.snapshot),
  attach: control('cases',['Attach ledger evidence','Save a verified transfer reference in the case.','Choose a reference from the list and select Attach.'],['Прикрепить запись','Сохраняет в деле ссылку на подтверждённую операцию.','Выберите ссылку и нажмите «Прикрепить».'],kkControls.attach),
  note: control('cases',['Add an analyst note','Record an observation or a next step in the case.','Write a note and choose Add note. It appears with your name and date.'],['Добавить заметку аналитика','Сохраняет наблюдение или следующий шаг в деле.','Напишите заметку и нажмите «Добавить заметку». Она появится с вашим именем и датой.'],kkControls.note),
  review: control('cases',['Submit or complete review','Update the case status as work moves through review.','Submit an open case when it is ready. A senior analyst or administrator can then record a conclusion.'],['Передать или завершить проверку','Меняет статус дела в ходе рассмотрения.','Отправьте готовое открытое дело. Итог указывает старший аналитик или администратор.'],kkControls.review),
  pdf: control('reports',['Download a PDF report','Create a formatted report for reading and review.','Open a saved case, then select PDF to download it.'],['Скачать отчёт PDF','Подготавливает оформленный отчёт для чтения и проверки.','Откройте сохранённое дело и нажмите «PDF».'],kkControls.pdf),
  json: control('reports',['Download case data as JSON','Export structured case data for use in other tools.','Open a saved case, then select JSON to download it.'],['Скачать данные дела в JSON','Выгружает структурированные данные для других инструментов.','Откройте сохранённое дело и нажмите «JSON».'],kkControls.json),
  reload: control('data',['Reload the synthetic dataset','Rebuild the baseline teaching ledger.','Use this to restore the demo data before starting a new investigation.'],['Перезагрузить учебные данные','Восстанавливает исходный учебный реестр.','Используйте для возврата к исходным данным перед новым разбором.'],kkControls.reload),
  display: control('settings',['Graph accessibility','Change the graph display and reduce movement.','Choose Reduced motion or Accessible entity list to suit your needs.'],['Доступность графа','Меняет вид схемы и уменьшает анимацию.','Включите «Меньше анимации» или «Доступный список объектов» по своим потребностям.'],kkControls.display)
} as const
export type Control = keyof typeof controls
export type Feature = Topic|Control
export const topicFor = (id:Feature):Topic => id in controls ? controls[id as Control].topic : id as Topic
export function featureCopy(id:Feature,language:Locale):Lesson {
  const base=local(topics[topicFor(id)].text,language)
  if(!(id in controls)) return base
  const [title,what,how,advanced]=local<ControlText>(controls[id as Control].text,language)
  return {...base,title,what,how,advanced:advanced??base.advanced}
}

export function helpAttrs(feature:Feature,target?:string) {
  return {'data-help':feature,...(target?{'data-guide-target':target}:{})}
}
