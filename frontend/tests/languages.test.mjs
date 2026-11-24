import {strict as assert} from 'node:assert'
import {test} from 'node:test'
import {chromium} from 'playwright'

const origin=process.env.ORBIT_TEST_URL||'http://127.0.0.1:5173'
const launch=()=>chromium.launch({
  channel:process.env.ORBIT_TEST_CHROME_CHANNEL||undefined,headless:true,
  args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']
})

test('the FFBI interface switches between English, Kazakh and Russian without resetting graph state',{timeout:50000},async()=>{
  const browser=await launch()
  try{
    const page=await browser.newPage({viewport:{width:1440,height:920}})
    const errors=[]
    page.on('pageerror',error=>errors.push(error.message))
    page.setDefaultTimeout(10000)
    await page.goto(origin,{waitUntil:'domcontentloaded'})
    await page.getByRole('combobox',{name:'Guide language'}).selectOption('kk')
    await page.getByRole('heading',{name:'FFBI жүйесіне қош келдіңіз'}).waitFor()
    await page.getByRole('button',{name:'Кіріспені өткізіп жіберу'}).click()
    await page.getByRole('heading',{name:'Қаржы желісінің картасы',exact:true}).waitFor()
    await page.getByRole('heading',{name:'Қаражаттың жедел бөлінуі',exact:true}).waitFor()
    await page.getByText(/Meridian Trading ірі аударымдарды алып/).waitFor()
    await page.getByRole('combobox',{name:'Графтың орналасуы'}).selectOption('Geography')
    await page.getByRole('combobox',{name:'Тіл',exact:true}).selectOption('ru')
    await page.getByRole('heading',{name:'Карта финансовой сети',exact:true}).waitFor()
    assert.equal(await page.getByRole('combobox',{name:'Раскладка графа'}).inputValue(),'Geography')
    await page.getByRole('heading',{name:'Быстрое распределение средств',exact:true}).waitFor()
    await page.getByText(/Meridian Trading получил и быстро перераспределил/).waitFor()
    const nav=page.getByRole('navigation',{name:'Навигация по приложению'})
    await nav.getByRole('button',{name:'ИИ-аналитик',exact:true}).click()
    await page.getByRole('textbox',{name:'Вопрос ИИ-аналитику'}).fill('Куда ушли деньги?')
    await page.getByRole('button',{name:'Отправить вопрос'}).click()
    await page.getByRole('heading',{name:'Зафиксированное движение денег'}).waitFor()
    await page.getByText(/Поступления на конечные счета/).waitFor()
    await page.getByText('Подтверждающие ссылки: 12').click()
    await page.getByRole('button',{name:/TX-10421.*нояб/}).waitFor()
    await page.getByRole('combobox',{name:'Язык',exact:true}).selectOption('kk')
    await page.getByRole('heading',{name:'Тіркелген ақша қозғалысы'}).waitFor()
    await page.getByText(/Соңғы шоттардағы түсімдер/).waitFor()
    await page.getByRole('button',{name:/TX-10421.*162[\s\u00a0]000 USD.*12 қар\./}).waitFor()
    assert.equal(await page.locator('html').getAttribute('lang'),'kk')
    if(process.env.ORBIT_TEST_KAZAKH)await page.screenshot({path:process.env.ORBIT_TEST_KAZAKH})
    await page.reload({waitUntil:'domcontentloaded'})
    await page.getByRole('heading',{name:'Қаржы желісінің картасы',exact:true}).waitFor()
    assert.equal(await page.getByRole('combobox',{name:'Тіл',exact:true}).inputValue(),'kk')
    await page.getByRole('button',{name:'Анықтама',exact:true}).click()
    const help=page.getByRole('dialog',{name:'Анықтама орталығы'})
    await help.getByRole('searchbox',{name:'Анықтамадан іздеу'}).fill('тәуекел бағасын түсіну')
    await help.getByRole('heading',{name:'Тәуекел бағасын түсіну'}).waitFor()
    await help.getByRole('combobox',{name:'Интерфейс тілі'}).selectOption('en')
    await page.getByRole('dialog',{name:'Help Center'}).waitFor()
    await page.getByRole('button',{name:'Close help'}).click()
    await page.getByRole('heading',{name:'Universe Explorer',exact:true}).waitFor()
    assert.deepEqual(errors,[])
  }finally{await browser.close()}
})

test('Kazakh navigation and the interactive tour fit a phone screen',{timeout:35000},async()=>{
  const browser=await launch()
  try{
    const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'})
    page.setDefaultTimeout(10000)
    await page.goto(origin,{waitUntil:'domcontentloaded'})
    await page.getByRole('combobox',{name:'Guide language'}).selectOption('kk')
    await page.getByRole('button',{name:'Интерактивті турды бастау'}).click()
    await page.getByRole('heading',{name:'Қаржы желісіне шолу',exact:true}).waitFor()
    const tour=page.locator('.guide-tour-card')
    await tour.getByRole('button',{name:'Келесі',exact:true}).click()
    await tour.getByRole('heading',{name:'Қаржы желісін зерттеңіз',exact:true}).waitFor()
    await tour.getByRole('button',{name:'Оқуды кідірту'}).click()
    await page.getByRole('button',{name:'Мәзірді ашу'}).click()
    await page.getByRole('navigation',{name:'Қолданба мәзірі'}).getByRole('button',{name:'Дереккөздер',exact:true}).click()
    await page.getByRole('heading',{name:'Оқу аударымдарының тізілімі'}).waitFor()
    await page.getByText(/14 қаз\. – 12 қар\. 2026 ж\./).waitFor()
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth)
    assert.equal(overflow,false)
    if(process.env.ORBIT_TEST_KAZAKH_MOBILE)await page.screenshot({path:process.env.ORBIT_TEST_KAZAKH_MOBILE})
  }finally{await browser.close()}
})
