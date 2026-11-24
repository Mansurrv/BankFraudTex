import type {Localized} from './content'

export const strings = {
  en:{
    help:'Help', center:'Help Center', close:'Close help', preferences:'Guide preferences', language:'Guide language',
    level:'Explanation level', beginner:'Beginner', advanced:'Advanced', welcome:'Welcome to {brand}',
    intro:'Explore financial relationships, understand how money moves, and discover unusual patterns through an interactive financial intelligence platform.',
    start:'Start Interactive Tour', restart:'Restart interactive tour', demo:'Explore Demo Investigation',
    skip:'Skip Introduction', resume:'Resume tour', resumeDemo:'Resume investigation', restartDemo:'Restart demo',
    demoName:'Rapid Fund Dispersion', demoDescription:'Follow the recorded transfers through Meridian Trading and export a case.',
    demoUnavailable:'The Rapid Fund Dispersion finding is unavailable in this dataset.',
    search:'Search help', searchPlaceholder:'Try risk, transfers, or export', topics:'Help topics',
    noResults:'No topics match. Try a feature name or a term from the glossary.', glossary:'Glossary',
    what:'What it does', why:'Why it matters', how:'How to use it', more:'Advanced explanation',
    next:'Next', previous:'Previous', finish:'Finish', pause:'Pause guide', returnToStep:'Show step again',
    locate:'Locate control', step:'Step', of:'of', tour:'Interactive tour', task:'Try this', result:'What happens next',
    waiting:'This control is not visible in the current view. Show the step again or continue.',
    done:'Guide complete. You can start it again from Help or Settings.', example:'Illustrative example',
    explanation:'Explain {feature}', diagram:'Learning diagram', first:'First step', last:'Last step',
    route:'Related topics', morePatterns:'Transaction splitting', helpMenu:'Open Help Center', pick:'Explain a control', pickNotice:'Select a control or metric to read its explanation.', cancelPick:'Cancel'
  },
  ru:{
    help:'Справка', center:'Центр справки', close:'Закрыть справку', preferences:'Настройки обучения', language:'Язык интерфейса',
    level:'Уровень объяснений', beginner:'Начальный', advanced:'Подробный', welcome:'Добро пожаловать в {brand}',
    intro:'Изучайте финансовые связи, отслеживайте движение денег и находите необычные схемы с помощью интерактивной платформы финансового анализа.',
    start:'Начать интерактивный тур', restart:'Начать тур заново', demo:'Посмотреть учебное расследование',
    skip:'Пропустить введение', resume:'Продолжить тур', resumeDemo:'Продолжить расследование', restartDemo:'Начать разбор заново',
    demoName:'Быстрое распределение средств', demoDescription:'Проследите зарегистрированные переводы через Meridian Trading и выгрузите дело.',
    demoUnavailable:'В этом наборе нет наблюдения «Быстрое распределение средств».',
    search:'Поиск по справке', searchPlaceholder:'Например, риск, переводы или отчёт', topics:'Темы справки',
    noResults:'Совпадений нет. Попробуйте название инструмента или термин из словаря.', glossary:'Словарь',
    what:'Что это', why:'Зачем это нужно', how:'Как пользоваться', more:'Подробное объяснение',
    next:'Далее', previous:'Назад', finish:'Завершить', pause:'Приостановить обучение', returnToStep:'Показать шаг снова',
    locate:'Показать элемент', step:'Шаг', of:'из', tour:'Интерактивный тур', task:'Попробуйте', result:'Что произойдёт',
    waiting:'Этот элемент не виден в текущем разделе. Покажите шаг снова или продолжите.',
    done:'Обучение завершено. Его можно снова запустить из справки или настроек.', example:'Учебный пример',
    explanation:'Пояснение: {feature}', diagram:'Учебная схема', first:'Первый шаг', last:'Последний шаг',
    route:'Связанные темы', morePatterns:'Дробление переводов', helpMenu:'Открыть центр справки', pick:'Пояснить элемент', pickNotice:'Выберите кнопку или показатель, чтобы прочитать пояснение.', cancelPick:'Отмена'
  },
  kk:{
    help:'Анықтама', center:'Анықтама орталығы', close:'Анықтаманы жабу', preferences:'Оқу баптаулары', language:'Интерфейс тілі',
    level:'Түсіндіру деңгейі', beginner:'Бастапқы', advanced:'Толық', welcome:'{brand} жүйесіне қош келдіңіз',
    intro:'Интерактивті қаржылық талдау платформасында байланыстарды зерттеңіз, ақшаның қозғалысын бақылаңыз және әдеттен тыс үлгілерді табыңыз.',
    start:'Интерактивті турды бастау', restart:'Турды қайта бастау', demo:'Оқу тергеуін бастау',
    skip:'Кіріспені өткізіп жіберу', resume:'Турды жалғастыру', resumeDemo:'Тергеуді жалғастыру', restartDemo:'Тергеуді қайта бастау',
    demoName:'Қаражаттың жедел бөлінуі', demoDescription:'Meridian Trading арқылы өткен аударымдарды бақылап, істі жүктеп алыңыз.',
    demoUnavailable:'Бұл жинақта қаражаттың жедел бөлінуі туралы байқау жоқ.',
    search:'Анықтамадан іздеу', searchPlaceholder:'Мысалы, тәуекел, аударым немесе есеп', topics:'Анықтама тақырыптары',
    noResults:'Сәйкестік табылмады. Құрал атауын немесе сөздік терминін іздеп көріңіз.', glossary:'Сөздік',
    what:'Бұл не істейді', why:'Неге маңызды', how:'Қалай қолдану керек', more:'Толық түсіндірме',
    next:'Келесі', previous:'Алдыңғы', finish:'Аяқтау', pause:'Оқуды кідірту', returnToStep:'Қадамды қайта көрсету',
    locate:'Элементті көрсету', step:'Қадам', of:'/', tour:'Интерактивті тур', task:'Көріп көріңіз', result:'Әрі қарай не болады',
    waiting:'Бұл элемент ағымдағы көріністе жоқ. Қадамды қайта көрсетіңіз немесе жалғастырыңыз.',
    done:'Оқу аяқталды. Оны анықтамадан немесе баптаулардан қайта бастауға болады.', example:'Оқу мысалы',
    explanation:'Түсіндірме: {feature}', diagram:'Оқу схемасы', first:'Алғашқы қадам', last:'Соңғы қадам',
    route:'Қатысты тақырыптар', morePatterns:'Аударымдарды бөлшектеу', helpMenu:'Анықтама орталығын ашу',
    pick:'Элементті түсіндіру', pickNotice:'Түсіндірмесін оқу үшін түймені немесе көрсеткішті таңдаңыз.', cancelPick:'Бас тарту'
  }
} satisfies Localized<Record<string,string>>

export const glossary:Localized<[string,string][]> = {
  en:[
    ['Entity / node','A 3D model for an account, company, bank, person, or device.'],
    ['Connection / edge','A line for a transfer route or another recorded relationship. An arrow shows which way a transfer goes.'],
    ['Community / cluster','A group of objects with related transfers or records.'],
    ['Confirmed fact','A detail present in a verified source record, such as a transfer date, amount, or recorded signatory.'],
    ['Anomaly','An observation that stands out from normal or expected activity.'],
    ['Suspicious pattern','A group of observations that should be reviewed. The same pattern can have legitimate explanations.'],
    ['Risk indicator','A reason for a flag, such as several large transfers within minutes.'],
    ['Anomaly score','A 0–100 review priority. It does not estimate the probability of fraud.'],
    ['Inferred relationship','A possible connection suggested by data, such as two accounts sharing a device.'],
    ['Confidence score','A summary of the clues behind a possible link. It does not confirm ownership.'],
    ['Counterparty','The other person, business or account involved in a transfer.'],
    ['Gross volume','Total recorded transfer amounts. Counting each hop can include the same money more than once.']
  ],
  ru:[
    ['Объект / узел','Трёхмерная модель счёта, компании, банка, человека или устройства.'],
    ['Связь / ребро','Линия маршрута перевода или другой зарегистрированной связи. Стрелка показывает направление.'],
    ['Группа / кластер','Набор объектов, связанных переводами или другими записями.'],
    ['Подтверждённый факт','Сведения из проверенной записи, например дата или сумма перевода либо указанный подписант.'],
    ['Аномалия','Наблюдение, которое отличается от обычной или ожидаемой активности.'],
    ['Подозрительная схема','Группа наблюдений, которую нужно изучить. У неё могут быть законные объяснения.'],
    ['Индикатор риска','Причина отметки, например несколько крупных переводов за минуты.'],
    ['Оценка аномалии','Приоритет проверки от 0 до 100. Он не показывает вероятность мошенничества.'],
    ['Предполагаемая связь','Возможная связь по данным, например общее устройство у двух счетов.'],
    ['Оценка уверенности','Сводная оценка признаков возможной связи. Она не подтверждает владельца.'],
    ['Контрагент','Другой человек, организация или счёт, участвующий в переводе.'],
    ['Валовой объём','Сумма зарегистрированных переводов. При подсчёте каждого этапа одни деньги могут учитываться несколько раз.']
  ],
  kk:[
    ['Нысан / түйін','Шотты, компанияны, банкті, адамды немесе құрылғыны білдіретін 3D модель.'],
    ['Байланыс / қыр','Аударым бағытын немесе басқа тіркелген байланысты көрсететін сызық. Жебе аударым бағытын көрсетеді.'],
    ['Топ / кластер','Аударымдармен немесе басқа жазбалармен байланысқан нысандар жиыны.'],
    ['Расталған факт','Тексерілген жазбадағы дерек, мысалы, аударым күні, сомасы немесе тіркелген қол қоюшы.'],
    ['Аномалия','Әдеттегі немесе күтілетін әрекеттен ерекшеленетін байқау.'],
    ['Күмәнді үлгі','Тексеруді қажет ететін байқаулар жиыны. Оның заңды түсіндірмелері болуы мүмкін.'],
    ['Тәуекел белгісі','Белгілеу себебі. Мысалы, бірнеше минуттағы бірнеше ірі аударым.'],
    ['Аномалия бағасы','0–100 аралығындағы тексеру басымдығы. Алаяқтық ықтималдығын көрсетпейді.'],
    ['Болжамды байланыс','Деректер көрсеткен ықтимал байланыс, мысалы, екі шотқа ортақ құрылғы.'],
    ['Сенімділік бағасы','Ықтимал байланыс белгілерінің жиынтық бағасы. Ол иесін растамайды.'],
    ['Контрагент','Аударымға қатысқан екінші адам, ұйым немесе шот.'],
    ['Жалпы көлем','Тіркелген аударым сомаларының жиынтығы. Әр кезеңді санағанда бір ақша бірнеше рет есептелуі мүмкін.']
  ]
}

export const questions:Localized<[string,string][]> = {
  en:[
    ['Does a high score prove fraud?','No. It ranks leads for review. Check the recorded transfers and consider explanations before reaching a conclusion.'],
    ['Why did the graph change when I chose a date?','The graph now shows transfers that occurred in the selected UTC period. Clear the range to return to all dates.'],
    ['Can I use FFBI without a 3D view?','Yes. Open Settings, turn on Accessible entity list, and select entities from the table. The guide can use the same list.'],
    ['Does a scenario edit the original transactions?','No. It compares a temporary copy with the current finding.'],
    ['Can I continue the guide later?','Yes. Pause it and reopen Help to resume the saved step in this browser.']
  ],
  ru:[
    ['Доказывает ли высокая оценка мошенничество?','Нет. Она определяет приоритет проверки. Изучите записи и возможные объяснения, прежде чем делать вывод.'],
    ['Почему схема изменилась после выбора даты?','Сейчас показаны переводы за выбранный период UTC. Сбросьте диапазон, чтобы вернуться ко всем датам.'],
    ['Можно ли работать без 3D-графа?','Да. Включите «Доступный список объектов» в настройках и выбирайте объекты из таблицы. Справка работает и со списком.'],
    ['Меняет ли сценарий исходные переводы?','Нет. Он сравнивает временную копию с текущим наблюдением.'],
    ['Можно ли продолжить обучение позже?','Да. Приостановите его и откройте справку в этом браузере, чтобы продолжить с сохранённого шага.']
  ],
  kk:[
    ['Жоғары баға алаяқтықты дәлелдей ме?','Жоқ. Баға тексеру кезегін белгілейді. Қорытынды жасамай тұрып, жазбалар мен ықтимал түсіндірмелерді қараңыз.'],
    ['Күнді таңдағанда граф неге өзгерді?','Граф таңдалған UTC кезеңіндегі аударымдарды көрсетеді. Толық кезеңге оралу үшін аралықты тазалаңыз.'],
    ['FFBI-ті 3D көрініссіз қолдануға бола ма?','Иә. Баптаулардан нысандардың қолжетімді тізімін қосып, нысандарды кестеден таңдаңыз. Нұсқаулық тізіммен де жұмыс істейді.'],
    ['Сценарий бастапқы аударымдарды өзгерте ме?','Жоқ. Уақытша көшірме ағымдағы байқаумен салыстырылады.'],
    ['Оқуды кейін жалғастыруға бола ма?','Иә. Оқуды кідіртіңіз, кейін сақталған қадамды жалғастыру үшін осы браузерден анықтаманы ашыңыз.']
  ]
}
