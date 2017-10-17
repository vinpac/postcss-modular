import test from 'ava'
import postcss from 'postcss'
import fs from 'fs'
import path from 'path'
import plugin from '../lib/plugin'

const fixturesPath = path.resolve(__dirname, './fixtures')


test('Basics', async (t) => {
  const sourceFile = path.join(fixturesPath, 'in', 'basics.css')
  const expectedFile = path.join(fixturesPath, 'out', 'basics.css')
  const sourceCSS = fs.readFileSync(sourceFile).toString()
  const expectedCSS = fs.readFileSync(expectedFile).toString()

  const result = await postcss([plugin])
    .process(sourceCSS, { from: sourceFile })

  t.deepEqual(result.css, expectedCSS)
})

test('Use', async (t) => {
  const basicsSourceFile = path.join(fixturesPath, 'in', 'basics.css')
  const basicsSourceCSS = fs.readFileSync(basicsSourceFile).toString()
  const sourceFile = path.join(fixturesPath, 'in', 'use.css')
  const expectedFile = path.join(fixturesPath, 'out', 'use.css')
  const sourceCSS = fs.readFileSync(sourceFile).toString()
  const expectedCSS = fs.readFileSync(expectedFile).toString()

  const pipeline = await postcss([plugin])
  await pipeline.process(basicsSourceCSS, { from: basicsSourceFile })
  const result = await pipeline.process(sourceCSS, { from: sourceFile })

  t.deepEqual(result.css, expectedCSS)
})
