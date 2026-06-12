const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..')

function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) {
    console.error(`Missing build output: ${src}`)
    process.exit(1)
  }
  fs.cpSync(src, dest, { recursive: true })
}

const staticSrc = path.join(root, '.next', 'static')
const staticDest = path.join(root, '.next', 'standalone', '.next', 'static')
const publicSrc = path.join(root, 'public')
const publicDest = path.join(root, '.next', 'standalone', 'public')

copyRecursive(staticSrc, staticDest)
copyRecursive(publicSrc, publicDest)

const serverSrc = path.join(root, 'server.js')
const serverDest = path.join(root, '.next', 'standalone', 'server.js')
fs.cpSync(serverSrc, serverDest)

console.log('Copied .next/static, public/, and server.js into .next/standalone/')
