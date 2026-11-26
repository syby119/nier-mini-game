import fs from 'node:fs'
import path from 'node:path'
import postcss from 'postcss'
import ts from 'typescript'

const check = process.argv.includes('--check')
const settings = {
  ...ts.getDefaultFormatCodeSettings('\n'),
  indentSize: 2,
  tabSize: 2,
  semicolons: ts.SemicolonPreference.Remove,
}
const printer = ts.createPrinter({ neverAsciiEscape: true })

function formatScript(file, source) {
  const snapshot = ts.ScriptSnapshot.fromString(source)
  const service = ts.createLanguageService({
    getCompilationSettings: () => ({ allowJs: true, jsx: ts.JsxEmit.Preserve, noResolve: true }),
    getScriptFileNames: () => [file],
    getScriptVersion: () => '1',
    getScriptSnapshot: () => snapshot,
    getCurrentDirectory: process.cwd,
    getDefaultLibFileName: ts.getDefaultLibFilePath,
    fileExists: ts.sys.fileExists,
    readFile: ts.sys.readFile,
  }, undefined, ts.LanguageServiceMode.Syntactic)

  try {
    const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true)
    const edits = service.getFormattingEditsForDocument(file, settings)
    function visit(node) {
      if (ts.isStringLiteral(node)) {
        const raw = node.getText(tree)
        const attribute = ts.isJsxAttribute(node.parent)
        // JSX attributes encode literal quotes as HTML entities, JavaScript strings use escapes.
        const single = !attribute && (!node.text.includes("'") || node.text.includes('"'))
        const quote = single ? "'" : '"'
        if (raw[0] !== quote) {
          const newText = attribute
            ? '"' + raw.slice(1, -1).replaceAll('"', '&quot;') + '"'
            : printer.printNode(ts.EmitHint.Expression, ts.factory.createStringLiteral(node.text, single), tree)
          edits.push({ span: { start: node.getStart(tree), length: node.getWidth(tree) }, newText })
        }
      }
      ts.forEachChild(node, visit)
    }
    visit(tree)
    for (const { span, newText } of edits.sort((a, b) => b.span.start - a.span.start || b.span.length - a.span.length)) {
      source = source.slice(0, span.start) + newText + source.slice(span.start + span.length)
    }
    return source
  } finally {
    service.dispose()
  }
}

function formatCss(file, source) {
  const root = postcss.parse(source, { from: file })
  function indent(container, depth) {
    container.each((node, index) => {
      const topLevel = depth === 0
      node.raws.before = topLevel && !index ? '' : (topLevel ? '\n\n' : '\n') + '  '.repeat(depth)
      if (node.type === 'decl') node.raws.between = ': '
      if (node.nodes) {
        node.raws.between = ' '
        node.raws.after = '\n' + '  '.repeat(depth)
        node.raws.semicolon = true
        indent(node, depth + 1)
      }
    })
  }
  indent(root, 0)
  return root.toString()
}

function formatFile(file) {
  const original = fs.readFileSync(file, 'utf8')
  const source = original.replace(/\r\n?/g, '\n')
  let formatted
  if (file.endsWith('.css')) formatted = formatCss(file, source)
  else if (file.endsWith('.json')) formatted = JSON.stringify(JSON.parse(source), null, 2)
  else formatted = formatScript(file, source)
  formatted = formatted.trimEnd() + '\n'
  if (original === formatted) return 0
  if (check) console.error(path.relative(process.cwd(), file))
  else fs.writeFileSync(file, formatted)
  return 1
}

function sourceFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(file)
    return /\.(?:tsx?|css|json|m?js)$/.test(file) ? [file] : []
  })
}

const files = [
  ...['src', 'messages', 'scripts'].flatMap(sourceFiles),
  'next.config.js', 'postcss.config.mjs', 'tailwind.config.js', 'package.json', 'tsconfig.json',
]
const changed = files.reduce((count, file) => count + formatFile(path.resolve(file)), 0)
console.log(check ? `${files.length} files checked, ${changed} need formatting.` : `Formatted ${changed} of ${files.length} files.`)
if (check && changed) process.exitCode = 1
