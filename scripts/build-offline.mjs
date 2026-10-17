import { readFileSync, writeFileSync, readdirSync, statSync, copyFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { createHash } from 'node:crypto'
copyFileSync('assets/share/icon.png', 'dist/app-icon.png')
const walk = path => readdirSync(path).flatMap(name => { const p = join(path, name); return statSync(p).isDirectory() ? walk(p) : [p] })
const files = walk('dist').filter(p => !p.endsWith('sw.js') && !p.endsWith('offline-assets.json'))
const fingerprint = createHash('sha256').update(files.map(p => readFileSync(p)).map(b => b.toString('base64')).join('')).digest('hex').slice(0, 12)
let sw = readFileSync('dist/sw.js', 'utf8').replace("'green-empire-v1'", `'green-empire-${fingerprint}'`)
writeFileSync('dist/sw.js', sw)
writeFileSync('dist/offline-assets.json', JSON.stringify(files.map(p => './' + relative('dist', p))))
console.log(`offline: ${files.length} files, cache ${fingerprint}`)
