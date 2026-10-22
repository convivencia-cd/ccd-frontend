const { readFileSync } = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

function load(file, imports = {}) {
  const source = readFileSync(path.join(__dirname, '../..', file), 'utf8')
  const { outputText } = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } })
  const module = { exports: {} }
  new Function('require', 'module', 'exports', outputText)(name => {
    if (name in imports) return imports[name]
    throw new Error(`Import no simulado: ${name}`)
  }, module, module.exports)
  return module.exports
}

module.exports = { load }
