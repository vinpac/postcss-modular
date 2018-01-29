import postcss from 'postcss'
import fs from 'fs'
import path from 'path'
import plugin from '../lib/plugin'

const fixturesPath = path.resolve(__dirname, './fixtures')

function readFile(folder, fileName) {
  const filePath = path.join(fixturesPath, folder, `${fileName}.css`)
  return {
    path: filePath,
    css: fs.readFileSync(filePath).toString(),
  }
}

function readInAndOut(fileName) {
  return {
    source: readFile('in', fileName),
    expected: readFile('out', fileName),
  }
}

describe('Basics', () => {
  it('should handle basic hashing and scoping', async () => {
    const { source, expected } = readInAndOut('basics')

    const result = await postcss([plugin()]).process(source.css, { from: source.path })

    expect(result.css).toEqual(expected.css)
    expect(result.translations).toEqual({
      className: '_className_1wre7_h4',
      subClass: '_subClass_kp1bo_b',
    })
  })

  it('should have different translations based on sourcePath', async () => {
    const { source } = readInAndOut('basics')

    const result = await postcss([plugin()]).process(source.css, { from: source.path })

    const result2 = await postcss([plugin()]).process(source.css, { from: `${source.path}.` })

    expect(result.translations).not.toEqual(result2.translations)
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
      className: '_className_1iqoc_tu',
      subClass: '_subClass_1ix19_4h',
    })
  })
})
