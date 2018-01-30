const postcss = require('postcss')
const path = require('path')
const has = require('has')
const stringHash = require('string-hash')

const IMPORT_SELECTOR = ':import'

function dashesCamelCase(str) {
  return str.replace(/-+(\w)/g, (match, firstLetter) => firstLetter.toUpperCase())
}

function parseNode(node, params) {
  const { context, imports, translate, translations, resolvePath } = params

  // Handle children
  if (node.nodes && node.type !== 'rule') {
    node.nodes.forEach(childNode => parseNode(childNode, params))
    return
  }

  if (node.type === 'rule') {
    // Handle import
    if (node.selector === IMPORT_SELECTOR) {
      node.nodes.forEach(childNode => {
        let { value } = childNode
        value = value.replace(/^\s*from\s+/, '').trim()

        const quoteCode = value.charCodeAt(0)
        if (value[0] !== value[value.length - 1] && (quoteCode !== 39 || quoteCode !== 34)) {
          throw new Error('Module path must be a string')
        }

        imports[childNode.prop] = resolvePath(`${value.substr(1, value.length - 2)}`)
      })

      node.remove()
      return
    }

    let isGlobal = !context.modules
    node.selector = node.selector.replace(
      // eslint-disable-next-line max-len
      /(\.?[\w-_]+::[\w-_]+)|(\(\.?[\w-_]+::[\w-_]+\))|(?::(local|global)\s*\(([^)]+)\))|,|:(local|global)|\.([\w-_]+)/g,
      (str, ref, moduleRefInParen, scopeName, content, scopeNameChanger, className) => {
        let moduleRef = ref
        if (moduleRefInParen) {
          moduleRef = moduleRefInParen.substr(1, moduleRefInParen.length - 2)
        }

        if (moduleRef) {
          const [moduleId, moduleClassName] = moduleRef.replace(/^\./, '').split('::')
          if (has(imports, moduleId)) {
            if (!context.store[imports[moduleId]]) {
              context.store[imports[moduleId]] = {}
            }

            return `.${translate(
              moduleClassName,
              context.store[imports[moduleId]],
              imports[moduleId],
            )}`
          }

          // ignore
          return moduleRef
        }

        if (str === ',') {
          isGlobal = !context.modules
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
              `.${translate(childClassName, translations, node.source.input.file)}`,
          )
        }

        if (isGlobal) {
          return str
        }

        return str.replace(className, translate(className, translations, node.source.input.file))
      },
    )
  }
}

function defaultGenerateScopedName(name, fileName) {
  const hash = stringHash(`${name}${fileName}`).toString(36)

  return `_${name}_${hash.substr(0, 5)}_${hash.substr(5, 8)}`
}

function defaultResolvePath(filepath, dirpath, context) {
  let filepathWithExt = filepath

  // Checks if the filename has extension
  if (!/\.\w+$/.test(filepath)) {
    filepathWithExt = `${filepath}${context.extension}`
  }

  return path.resolve(dirpath, filepathWithExt)
}

module.exports = postcss.plugin('cssm', (opts = {}) => {
  const context = Object.assign(
    {},
    {
      // Default context
      modules: true,
      store: {},
      extension: '.css',
      useNoImported: opts.useNoImported || 'error',
      camelCase: false,
      generateScopedName: defaultGenerateScopedName,
    },
    opts,
  )

  const translate = (className, translations, filePath) => {
    if (!has(translations, className)) {
      translations[className] = context.generateScopedName(className, filePath)
    }

    return translations[className]
  }

  return (css, result) => {
    const translations = {}
    const dirpath = path.dirname(css.source.input.file)
    const imports = {}
    const resolvePath = filepath =>
      (opts.resolvePath || defaultResolvePath)(filepath, dirpath, context)

    context.store[css.source.input.file] = translations

    css.each(node =>
      parseNode(node, {
        translate,
        translations,
        context,
        dirpath,
        imports,
        resolvePath,
      }),
    )

    if (context.camelCase) {
      result.translations = {}
      Object.keys(translations).forEach(key => {
        result.translations[dashesCamelCase(key)] = translations[key]
      })
    } else {
      result.translations = translations
    }
  }
})
