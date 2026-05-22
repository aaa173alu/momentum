const fs = require('fs')
const path = require('path')

function walk(dir) {
  const results = []
  fs.readdirSync(dir).forEach((name) => {
    const p = path.join(dir, name)
    const stat = fs.statSync(p)
    if (stat && stat.isDirectory()) results.push(...walk(p))
    else if (/\.(tsx|ts)$/.test(name)) results.push(p)
  })
  return results
}

const root = path.join(__dirname, '..', 'src')
const files = walk(root)
let updatedCount = 0
files.forEach((file) => {
  let content = fs.readFileSync(file, 'utf8')
  const original = content
  // replace fontSize: '14px' or "14px"
  content = content.replace(/fontSize:\s*'([0-9]+(?:\.[0-9]+)?)px'/g, (_, px) => {
    const rem = (Number(px) / 16).toFixed(4).replace(/\.0+$/, '')
    return `fontSize: '${rem}rem'`
  })
  content = content.replace(/fontSize:\s*"([0-9]+(?:\.[0-9]+)?)px"/g, (_, px) => {
    const rem = (Number(px) / 16).toFixed(4).replace(/\.0+$/, '')
    return `fontSize: "${rem}rem"`
  })
  // also handle numeric values: fontSize: 14px (without quotes)
  content = content.replace(/fontSize:\s*([0-9]+(?:\.[0-9]+)?)px/g, (_, px) => {
    const rem = (Number(px) / 16).toFixed(4).replace(/\.0+$/, '')
    return `fontSize: ${rem}rem`
  })

  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8')
    updatedCount++
    console.log('Updated', file)
  }
})
console.log('Done. Updated files:', updatedCount)
