import postcss from 'postcss'
import fs from 'fs'
import path from 'path'
import plugin from '../lib/plugin'

const fixturesPath = path.resolve(__dirname, './fixtures')

function readFile(folder, fileName) {
  const filePath = path.join(fixturesPath, folder, `${ fileName }.css`)
  return {
    path: filePath,
    css: fs.readFileSync(filePath).toString()
  }
}

function readInAndOut(fileName) {
  return {
    source: readFile('in', fileName),
    expected: readFile('out', fileName)
  }
}

describe('Basics', () => {
  it('should handle basic hashing and scoping', async () => {
    const { source, expected } = readInAndOut('basics')

    const result = await postcss([plugin()])
      .process(source.css, { from: source.path })

    expect(result.css).toEqual(expected.css)
    expect(result.translations).toEqual({
      className: '_className_wo9uw_1',
      subClass: '_subClass_wo9uw_3'
    })
  })

  it('should handle @use', async () => {
    const basics = readFile('in', 'basics')
    const { source, expected } = readInAndOut('use')
    const pipeline = postcss([plugin()])

    // Process basics.css
    await pipeline.process(basics.css, { from: basics.path })
    const result = await pipeline.process(source.css, { from: source.path })

    expect(result.css).toEqual(expected.css)
    expect(result.translations).toEqual({
      basicClassName: '_className_wo9uw_1',
      className: '_className_c6lnr_1'
    })
  })
})
