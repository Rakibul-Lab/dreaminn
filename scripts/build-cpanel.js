const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..')
const standalone = path.join(root, '.next', 'standalone')
const output = path.join(root, 'cpanel-deploy')
const zipPath = path.join(root, 'cpanel-deploy.zip')

function run(cmd) {
  execSync(cmd, { cwd: root, stdio: 'inherit', shell: true })
}

function removeEnvFiles(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      removeEnvFiles(full)
    } else if (entry.name === '.env' || entry.name.startsWith('.env.')) {
      fs.rmSync(full)
    }
  }
}

function createZip() {
  if (!fs.existsSync(output)) return
  if (fs.existsSync(zipPath)) fs.rmSync(zipPath)

  if (process.platform === 'win32') {
    run(
      `powershell -NoProfile -Command "Compress-Archive -Path '${path.join(output, '*')}' -DestinationPath '${zipPath}' -Force"`
    )
  } else if (fs.existsSync('/usr/bin/zip')) {
    run(`cd "${output}" && zip -rq "${zipPath}" .`)
  }
}

function packageDeploy() {
  const required = [
    'server.js',
    'package.json',
    path.join('.next', 'required-server-files.json'),
    path.join('.next', 'static'),
    'public',
    'node_modules',
  ]

  for (const rel of required) {
    if (!fs.existsSync(path.join(standalone, rel))) {
      console.error(`Missing .next/standalone/${rel} — run build first`)
      process.exit(1)
    }
  }

  fs.rmSync(output, { recursive: true, force: true })
  fs.cpSync(standalone, output, { recursive: true })
  removeEnvFiles(output)

  fs.mkdirSync(path.join(output, 'tmp'), { recursive: true })
  fs.writeFileSync(path.join(output, 'tmp', 'restart.txt'), new Date().toISOString())

  createZip()

  console.log('')
  console.log('Upload to cPanel → /home/rrpdream/dreaminn/')
  console.log(`  Folder: ${output}`)
  if (fs.existsSync(zipPath)) console.log(`  Zip:    ${zipPath}`)
  console.log('')
  console.log('Startup file: server.js')
  console.log('Set NODE_ENV, DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL in cPanel')
  console.log('Then Restart the Node.js app.')
}

if (process.platform === 'win32' && process.env.BUILD_CPANEL_LOCAL !== '1') {
  console.error('')
  console.error('On Windows, build the Linux package via GitHub:')
  console.error('  Actions → Build cPanel package → Run workflow')
  console.error('  Download cpanel-deploy.zip and upload to cPanel')
  console.error('')
  process.exit(1)
}

run('npm run build')
packageDeploy()
