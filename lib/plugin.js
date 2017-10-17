const postcss = require('postcss')
const path = require('path')
const has = require('has')
const stringHash = require('string-hash')

const CLASSNAME_REGEX = /^\.[^\s]+/

function lex(str) {
  const tokens = []
  const special = [',', '(', ')']
  let i = 0
  let name = ''
  let insideString = false
  for (; i < str.length; i += 1) {
    const char = str.charAt(i)
    if (char === '\'') {
      if (insideString) {
        tokens.push(`'${ name }'`)
      }
      insideString = !insideString
    } else if (!insideString && special.includes(char)) {
      if (name) {
        tokens.push(name)
        name = ''
      }

      tokens.push(char)
    } else if (!insideString && /\s/.test(char)) {
      if (name) {
        tokens.push(name)
        name = ''
      }
    } else {
      name += char
    }
  }

  return tokens
}

function readRef(tokens, index) {
  if (!CLASSNAME_REGEX.test(tokens[index])) {
    throw new Error(`Invalid className named ${ tokens[index] }`)
  }
  let newIndex = index
  const className = tokens[index].substr(1)
  let label = className

  if (tokens[newIndex + 1] === 'as') {
    newIndex += 2
    if (!CLASSNAME_REGEX.test(tokens[newIndex])) {
      throw new Error('Invalid className label')
    }

    label = tokens[newIndex].substr(1)
  }

  return {
    className,
    label,
    newIndex
  }
}

function dashesCamelCase(str) {
  return str.replace(/-+(\w)/g, (match, firstLetter) =>
    firstLetter.toUpperCase())
}

function parseNode(node, context) {
  const {
    options,
    translate,
    translations,
    dirpath
  } = context
  const { store } = options

  // Handle @use
  if (node.type === 'atrule' && node.name === 'use') {
    const { params } = node
    const tokens = lex(params)
    const refs = []
    let parenOpen = false
    let i = 0

    for (; i < tokens.length; i += 1) {
      if (tokens[i] === 'from') {
        if (parenOpen) {
          throw new Error('Expected \')\' found \'from\'')
        }

        if (i === 0) {
          throw new Error('Expected a class found \'from\'')
        }

        if (i !== tokens.length - 2) {
          throw new Error(`Expected end of rule but found ${ tokens[i + 2] }`)
        }

        let filename = tokens[i + 1].substr(1, tokens[i + 1].length - 2)

        // Checks if the filename has extension
        if (!/\.\w+$/.test(filename)) {
          filename = `${ filename }${ options.extension }`
        }

        const refFilepath = path.resolve(dirpath, filename)

        if (typeof store[refFilepath] === 'undefined') {
          const message = `'${ refFilepath }' not found or not imported yet`
          if (options.useNonImported === 'error') {
            throw new Error(message)
          } else if (options.useNonImported === 'warn') {
            console.warn(message)
          }
        }

        if (!has(store, refFilepath)) {
          store[refFilepath] = {}
        }

        let n = 0
        for (; n < refs.length; n += 1) {
          const ref = refs[n]
          translations[ref.label] = translate(
            ref.className,
            store[refFilepath],
            node
          )
        }

        break
      } else if (tokens[i] === ',') {
        if (i === 0 || tokens[i - 1] === ',') {
          throw new Error('Unexpected comma')
        }
      } else if (tokens[i] === '(') {
        if (i !== 0 || parenOpen) {
          throw new Error('Unexpected (')
        }

        parenOpen = true
      } else if (tokens[i] === ')') {
        if (i !== tokens.length - 3 || !parenOpen) {
          throw new Error('Unexpected )')
        }

        parenOpen = false
      } else if (tokens[i]) {
        const ref = readRef(tokens, i)
        refs.push(ref)
        i = ref.newIndex
      }
    }

    node.remove()
    return
  }

  // Handle children
  if (node.nodes && node.type !== 'rule') {
    node.nodes.forEach(childNode => parseNode(childNode, context))
    return
  }

  if (node.type === 'rule') {
    let isGlobal = !options.modules
    node.selector = node.selector.replace(
      /(?::(local|global)\s*\(([^)]+)\))|,|:(local|global)|\.([^\s.,#:()[\]]+)/g,
      (str, scopeName, content, scopeNameChanger, className) => {
        if (str === ',') {
          isGlobal = !options.modules
          return str
        }

        if (scopeNameChanger) {
          isGlobal = scopeNameChanger === 'global'
          return ''
        }

        if (scopeName) {
          if (scopeName === 'global') {
            return content
          }

          return content.replace(
            /\.([^\s.,#:()[\]]+)/g,
            (_, childClassName) =>
              `.${ translate(childClassName, translations, node) }`
          )
        }

        if (isGlobal) {
          return str
        }

        return str.replace(className, translate(className, translations, node))
      }
    )
  }
}

function defaultGenerateScopedName(name, css) {
  const i = css.indexOf(`.${ name }`)
  const lineNumber = css.substr(0, i).split(/[\r\n]/).length
  const hash = stringHash(css)
    .toString(36)
    .substr(0, 5)

  return `_${ name }_${ hash }_${ lineNumber }`
}

module.exports = postcss.plugin('cssm', (opts = {}) => {
  const options = Object.assign({}, {
    // Default options
    modules: true,
    store: {},
    extension: '.css',
    useNonImported: opts.useNonImported || 'error',
    camelCase: false,
    generateScopedName: defaultGenerateScopedName
  }, opts)

  const translate = (className, translations, node) => {
    if (typeof translations[className] === 'undefined') {
      translations[className] = options.generateScopedName(
        className,
        node.source.input.css
      )
    }

    return translations[className]
  }

  return (css, result) => {
    const translations = {}
    const dirpath = path.dirname(css.source.input.file)

    options.store[css.source.input.file] = translations

    css.each(node =>
      parseNode(node, {
        translate,
        translations,
        options,
        dirpath
      }))

    if (options.camelCase) {
      result.translations = {}
      Object.keys(translations).forEach((key) => {
        result.translations[dashesCamelCase(key)] = translations[key]
      })
    } else {
      result.translations = translations
    }
  }
})