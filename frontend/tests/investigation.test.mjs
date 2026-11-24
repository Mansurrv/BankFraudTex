import {strict as assert} from 'node:assert'
import {readFile} from 'node:fs/promises'
import {test} from 'node:test'
import {chromium} from 'playwright'

const origin=process.env.ORBIT_TEST_URL||'http://127.0.0.1:5173'
const launch=()=>chromium.launch({
  channel:process.env.ORBIT_TEST_CHROME_CHANNEL||undefined,
  headless:true,
  args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']
})

test('the synthetic investigation runs from ledger reload through case export',{timeout:70000},async()=>{
  const browser=await launch()
  try {
    const page=await browser.newPage({viewport:{width:1440,height:920},acceptDownloads:true})
    const errors=[]
    page.on('pageerror',e=>errors.push(e.message))
    page.setDefaultTimeout(9000)
    await page.goto(origin,{waitUntil:'domcontentloaded'})
    await page.getByRole('button',{name:'Skip Introduction'}).click()
    await page.getByRole('heading',{name:'Rapid fund dispersion',exact:true}).waitFor()
    await page.locator('.scene canvas').waitFor()
    await page.locator('.node-tag.selected').filter({hasText:'Meridian Trading'}).waitFor()
    if(process.env.ORBIT_TEST_SCREENSHOT)await page.screenshot({path:process.env.ORBIT_TEST_SCREENSHOT})

    const nav=page.getByRole('navigation',{name:'Workspace navigation'})
    await nav.getByRole('button',{name:'Data Sources',exact:true}).click()
    await page.getByRole('button',{name:'Reload synthetic data'}).click()
    await page.getByRole('status').filter({hasText:'Synthetic data loaded'}).waitFor()
    await nav.getByRole('button',{name:'Anomaly Radar'}).click()
    await page.getByRole('button',{name:/Rapid fund dispersion/}).click()
    await page.getByRole('heading',{name:'Rapid fund dispersion',exact:true}).waitFor()
    await page.getByRole('button',{name:'Explain this network'}).click()
    await page.getByRole('heading',{name:'Network explanation'}).waitFor()
    await page.getByText('12 supporting references',{exact:true}).click()
    await page.getByRole('button',{name:/TX-10421/}).waitFor()
    await page.getByRole('button',{name:'Save response to a case'}).click()
    await nav.getByRole('button',{name:'Universe Explorer'}).click()
    await page.getByRole('button',{name:'Explain this network'}).click()
    await page.getByText('12 supporting references',{exact:true}).click()
    await page.getByRole('button',{name:/TX-10421/}).click()
    await page.getByRole('heading',{name:'$162,000',exact:true}).waitFor()
    await page.getByRole('button',{name:'Return to investigation brief'}).click()
    await page.getByRole('button',{name:'Play flow',exact:true}).click()
    await page.getByText('Step 1 · Funds enter',{exact:true}).waitFor()
    await page.getByRole('button',{name:'Pause playback'}).click()

    await nav.getByRole('button',{name:'Simulation Lab'}).click()
    await page.getByRole('button',{name:'Run scenario'}).click()
    await page.getByRole('heading',{name:'Network comparison'}).waitFor()
    assert.match(await page.locator('.comparison').textContent(),/Transfers12\s*6/)
    await page.getByRole('button',{name:'Save scenario to a case'}).click()

    await page.getByRole('textbox',{name:'Case title'}).fill('Browser verification case')
    await page.getByRole('button',{name:'Create case',exact:true}).click()
    await page.getByRole('heading',{name:'Browser verification case'}).waitFor()
    await page.getByRole('button',{name:'Attach scenario ACC-001'}).click()
    await page.getByRole('heading',{name:'Saved scenarios'}).waitFor()
    await page.getByRole('button',{name:'Save finding',exact:true}).click()
    await page.getByRole('heading',{name:'Network explanation',exact:true}).waitFor()
    await page.getByRole('button',{name:'Save current graph view'}).click()
    await page.getByText(/Saved network view/).waitFor()
    await page.getByRole('button',{name:'Attach',exact:true}).click()
    const note=page.getByRole('textbox',{name:'Analyst note'})
    await note.fill('Reviewed the synthetic timing window. Қаржы есебі.')
    await page.getByRole('button',{name:'Add note'}).click()
    await page.getByText('Reviewed the synthetic timing window. Қаржы есебі.',{exact:true}).waitFor()
    await page.getByRole('button',{name:'Submit for review'}).click()
    await page.locator('.case-detail').getByText('In review',{exact:true}).waitFor()

    const pdfPromise=page.waitForEvent('download')
    await page.getByRole('link',{name:'PDF',exact:true}).click()
    const pdf=await pdfPromise
    const pdfPath=await pdf.path()
    assert.equal((await readFile(pdfPath)).subarray(0,5).toString(),'%PDF-')
    if(process.env.ORBIT_TEST_PDF)await pdf.saveAs(process.env.ORBIT_TEST_PDF)
    const jsonPromise=page.waitForEvent('download')
    await page.getByRole('link',{name:'JSON',exact:true}).click()
    const report=JSON.parse(await readFile(await (await jsonPromise).path(),'utf8'))
    assert.equal(report.timeline.steps.length,12)
    assert.equal(report.evidence[0].id,'TX-10421')
    assert.equal(report.graph.nodes.length,38)
    assert.equal(report.scenarios.length,1)
    assert.equal(report.savedFindings.length,1)
    assert.equal(report.snapshots.length,1)
    assert.equal(report.status,'In review')
    await page.getByText('Saved graph snapshot · 38 entities',{exact:true}).click()
    await page.getByRole('table').getByRole('button',{name:/Northline Exports/}).click()
    await page.getByRole('heading',{name:'Northline Exports',exact:true}).waitFor()
    assert.deepEqual(errors,[])
  }finally{await browser.close()}
})

test('an analyst can discover and inspect entities in the accessible list',{timeout:35000},async()=>{
  const browser=await launch()
  try {
    const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'})
    page.setDefaultTimeout(9000)
    await page.goto(origin,{waitUntil:'domcontentloaded'})
    await page.getByRole('button',{name:'Skip Introduction'}).click()
    await page.getByRole('heading',{name:'Universe Explorer'}).waitFor()
    const search=page.getByRole('textbox',{name:'Search entities or transactions'})
    await search.fill('Northline')
    await page.getByRole('button',{name:/Northline Exports/}).waitFor()
    await search.press('Enter')
    await page.getByRole('heading',{name:'Northline Exports'}).waitFor()
    await page.getByRole('button',{name:'Switch to accessible entity list'}).click()
    await page.getByRole('table').getByRole('button',{name:/Northline Exports/}).waitFor()
    await page.getByRole('button',{name:'Expand links'}).click()
    await page.waitForFunction(()=>document.querySelectorAll('.graph-list tbody tr').length===46)
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth)
    assert.equal(overflow,false)
    if(process.env.ORBIT_TEST_MOBILE_SCREENSHOT)await page.screenshot({path:process.env.ORBIT_TEST_MOBILE_SCREENSHOT,fullPage:true})
  }finally{await browser.close()}
})
