import assert from 'node:assert/strict'
import {test} from 'node:test'
import {chromium} from 'playwright'

const origin = process.env.ORBIT_TEST_URL || 'http://127.0.0.1:5173'

test('local analyst uploads a bank export and reviews a flagged transfer pattern', {timeout:45_000}, async () => {
  const browser = await chromium.launch({channel:process.env.ORBIT_TEST_CHROME_CHANNEL || undefined})
  try {
    const page = await browser.newPage({viewport:{width:1350,height:900}})
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(origin)
    await page.getByLabel('Corporate email').fill('analyst@northstar.example')
    await page.getByLabel('Password',{exact:true}).fill('FFBI-Local-Analyst-2026!')
    await page.getByRole('button',{name:'Sign in',exact:true}).click()
    await page.getByRole('button',{name:'Skip Introduction'}).click()
    await page.getByText('No transactions have been imported yet.').waitFor()

    const recipients = ['north','east','south','west']
    const transfers = recipients.map((to,i) => `wire-${i},sender,${to},20000,USD,wire,2026-08-03T09:0${i}:00Z`)
    const csv = ['id,from,to,amount,currency,kind,time', ...transfers].join('\n')
    await page.getByLabel('Bank export file').setInputFiles({
      name:'wire-fixture.csv', mimeType:'text/csv', buffer:Buffer.from(csv)
    })
    await page.getByRole('button',{name:'Import and analyze'}).click()
    const analysis = page.getByRole('region',{name:'Analysis results'})
    await analysis.waitFor()
    assert.match(await analysis.textContent(), /4 new transactions\. [1-9][0-9]* findings/)

    await analysis.getByRole('button',{name:'Anomaly Radar'}).click()
    await page.getByRole('button',{name:/Rapid fund dispersion/}).waitFor()
    assert.deepEqual(errors,[])
  } finally {
    await browser.close()
  }
})
