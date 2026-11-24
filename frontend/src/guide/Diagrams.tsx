import {useState} from 'react'
import {ArrowRight, CornerDownLeft, GitBranch, Timer, Waypoints} from 'lucide-react'
import {local,type Diagram,type Localized} from './content'
import {useGuide} from './state'
import {strings} from './strings'

type Frame = [label:string, explanation:string]
const frames:Record<Diagram,Localized<Frame[]>> = {
  graph:{
    en:[['Entities','A, B, and C stand for accounts. A larger dot can represent more links.'],['Transfers','The arrow from A to B shows that A sent funds to B.'],['Group','These accounts form a group because transfers connect them.']],
    ru:[['Объекты','A, B и C — счета. Более крупная точка может означать больше связей.'],['Переводы','Стрелка от A к B означает перевод со счёта A на B.'],['Группа','Счета образуют группу, потому что их связывают переводы.']],
    kk:[['Нысандар','A, B және C — шоттар. Үлкен нүктенің байланыстары көбірек болуы мүмкін.'],['Аударымдар','A-дан B-ға бағытталған жебе A шотынан B шотына ақша жіберілгенін көрсетеді.'],['Топ','Бұл шоттарды аударымдар байланыстыратындықтан, олар бір топ құрайды.']]
  },
  flow:{
    en:[['Starts at A','A sends $120 to B at 09:00.'],['Through B','B receives the first transfer and later sends $110 to C.'],['Arrives at C','C receives $110 at 09:08. The gap is eight minutes.']],
    ru:[['Начало в A','A отправляет 120 USD на B в 09:00.'],['Через B','B получает первый перевод, затем отправляет 110 USD на C.'],['Получатель C','C получает 110 USD в 09:08. Интервал — восемь минут.']],
    kk:[['A шотынан басталады','A шоты 09:00-де B шотына 120 USD жібереді.'],['B шоты арқылы','B шоты алғашқы аударымды алып, кейін C шотына 110 USD жібереді.'],['C шотына түседі','C шотына 09:08-де 110 USD түседі. Аралық — сегіз минут.']]
  },
  cycle:{
    en:[['A to B','The first transfer moves from A to B.'],['B to C','The next transfer moves from B to C.'],['C back to A','A later transfer returns to A. The records show a loop and leave its purpose open.']],
    ru:[['A → B','Первый перевод проходит от A к B.'],['B → C','Следующий перевод проходит от B к C.'],['C → A','Поздний перевод возвращается на A. Записи показывают круг, причина требует проверки.']],
    kk:[['A → B','Алғашқы аударым A шотынан B шотына өтеді.'],['B → C','Келесі аударым B шотынан C шотына өтеді.'],['C → A','Кейін қаражат A шотына қайтады. Жазбалар айналымды көрсетеді, ал мақсатын тексеру қажет.']]
  },
  split:{
    en:[['One credit','A receives one incoming transfer worth $900.'],['First branch','A sends $450 to B.'],['Second branch','A sends $450 to C. These branches show how a payment may be distributed.']],
    ru:[['Одно поступление','A получает один перевод на 900 USD.'],['Первая ветвь','A отправляет 450 USD на B.'],['Вторая ветвь','A отправляет 450 USD на C. Так платёж может распределиться по ветвям.']],
    kk:[['Бір түсім','A шотына 900 USD көлемінде бір аударым түседі.'],['Бірінші тармақ','A шоты B шотына 450 USD жібереді.'],['Екінші тармақ','A шоты C шотына 450 USD жібереді. Тармақтар төлемнің қалай бөлінетінін көрсетеді.']]
  },
  risk:{
    en:[['Timing','Several transfers were close together. Check the timestamps and compare the account’s usual pace.'],['Recipients','Several distinct accounts received funds. Check their IDs against the records.'],['Route','Downstream transfers converged. Compare the references. These reasons explain a flag without assigning a fixed points total.']],
    ru:[['Время','Переводы прошли близко друг к другу. Сверьте время и обычный темп операций по счёту.'],['Получатели','Деньги получили разные счета. Сверьте их номера с записями.'],['Маршрут','Следующие переводы сошлись. Проверьте ссылки. Эти признаки объясняют отметку, но не складываются в фиксированное число баллов.']],
    kk:[['Уақыт','Аударымдар бір-біріне жақын уақытта жасалды. Уақыт белгілерін шоттың әдеттегі қарқынымен салыстырыңыз.'],['Алушылар','Әртүрлі шоттар қаражат алды. Нөмірлерін жазбалармен салыстырыңыз.'],['Бағыт','Кейінгі аударымдар тоғысты. Сілтемелерді салыстырыңыз. Себептер белгілеуді түсіндіреді, бірақ тұрақты балға қосылмайды.']]
  },
  simulation:{
    en:[['Original','A reaches C through B in this example.'],['Remove B','After excluding B from this copy, A and C have no surviving connection in the example.']],
    ru:[['Исходная сеть','В примере A связан с C через B.'],['Убрать B','После исключения B из копии в примере не остаётся связи между A и C.']],
    kk:[['Бастапқы желі','Бұл мысалда A шоты B арқылы C шотына байланысады.'],['B шотын алып тастау','Көшірмеден B алынып тасталған соң, A мен C арасында байланыс қалмайды.']]
  }
}

export function LearningDiagram({kind}:{kind:Diagram}) {
  const language=useGuide(s=>s.language)
  const messages=local(strings,language)
  const [index,setIndex]=useState(0)
  const choices=local(frames[kind],language)
  const current=Math.min(index,choices.length-1)
  const [label,description]=choices[current]
  const removed=kind==='simulation'&&current===1
  const loop=kind==='cycle'
  const split=kind==='split'
  return <figure className="learn-diagram" aria-label={messages.diagram}>
    <figcaption>{messages.example}</figcaption>
    <div className="learn-diagram-choices" aria-label={messages.diagram}>{choices.map(([name],i)=><button className={current===i?'current':''} type="button" key={i} aria-pressed={current===i} onClick={()=>setIndex(i)}>{name}</button>)}</div>
    {kind==='risk'?<div className="learn-factors" aria-hidden="true">{[Timer,Waypoints,GitBranch].map((Icon,i)=><span key={i} className={i===current?'lit':''}><Icon size={22}/>{choices[i][0]}</span>)}</div>:
      split?<div className="learn-network" aria-hidden="true">
        <span className="learn-dot">S</span><ArrowRight className={current===0?'lit':''} size={20}/><span className="learn-dot">A</span>
        <div className="learn-branch">{['B','C'].map((id,i)=><span key={id}><ArrowRight className={current===i+1?'lit':''} size={18}/><span className="learn-dot">{id}</span></span>)}</div>
      </div>:<div className={'learn-network '+(removed?'removed':'')} aria-hidden="true">
        <span className="learn-dot">A</span><ArrowRight className={current===0?'lit':''} size={22}/>
        <span className="learn-dot">B</span>
        <ArrowRight className={current===1?'lit':''} size={22}/>
        <span className="learn-dot">C</span>
        {loop&&<span className={'learn-loop '+(current===2?'lit':'')}><CornerDownLeft size={16}/> C → A</span>}
      </div>}
    <p aria-live="polite"><strong>{label}</strong> {description}</p>
  </figure>
}
