/* Cross-platform helper: copy static assets + public into the Next.js
   standalone output. Replaces the old `cp -r` commands that failed on
   Windows CI (Git Bash ships BSD `cp` without `-r`). */
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const standalone = path.join(root, '.next', 'standalone')
const standaloneNext = path.join(standalone, '.next')

fs.cpSync(path.join(root, '.next', 'static'), path.join(standaloneNext, 'static'), { recursive: true, force: true })
fs.cpSync(path.join(root, 'public'), path.join(standalone, 'public'), { recursive: true, force: true })
console.log('standalone assets copied')
