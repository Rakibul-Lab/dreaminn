/**
 * cPanel startup file — upload the full cpanel-deploy/ folder.
 */
const fs = require('fs')
const path = require('path')

const appDir = __dirname
const requiredFiles = path.join(appDir, '.next', 'required-server-files.json')

if (!fs.existsSync(requiredFiles)) {
  console.error('Build missing. Use GitHub Actions → Build cPanel package, then upload cpanel-deploy/')
  process.exit(1)
}

process.env.NODE_ENV = 'production'
process.chdir(appDir)

const { config } = require(requiredFiles)
process.env.__NEXT_PRIVATE_STANDALONE_CONFIG = JSON.stringify(config)
require('next')

const { startServer } = require('next/dist/server/lib/start-server')

startServer({
  dir: appDir,
  isDev: false,
  config,
  hostname: process.env.HOSTNAME || '0.0.0.0',
  port: parseInt(process.env.PORT, 10) || 3000,
  allowRetry: false,
}).catch((err) => {
  console.error(err)
  process.exit(1)
})
