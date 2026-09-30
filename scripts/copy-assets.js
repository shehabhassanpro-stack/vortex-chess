const fs = require("fs")
const path = require("path")

const rootDir = path.resolve(__dirname, "..")
const sourceDir = path.join(rootDir, "assets")

const targetDirs = [
  path.join(rootDir, "build", "chrome-mv3-prod", "assets"),
  path.join(rootDir, "build", "chrome-mv3-dev", "assets"),
  path.join(rootDir, ".plasmo", "chrome-mv3-dev", "assets"),
]

if (!fs.existsSync(sourceDir)) {
  console.error(`[copy-assets] Error: Source assets directory not found at ${sourceDir}`)
  process.exit(1)
}

let copiedCount = 0

for (const target of targetDirs) {
  const parentDir = path.dirname(target)
  if (fs.existsSync(parentDir)) {
    fs.mkdirSync(target, { recursive: true })
    fs.cpSync(sourceDir, target, { recursive: true, force: true })
    console.log(`[copy-assets] ✅ Copied assets to: ${path.relative(rootDir, target)}`)
    copiedCount++
  }
}

if (copiedCount === 0) {
  // If target build directories don't exist yet, ensure build/chrome-mv3-prod/assets is prepared
  const defaultTarget = targetDirs[0]
  fs.mkdirSync(defaultTarget, { recursive: true })
  fs.cpSync(sourceDir, defaultTarget, { recursive: true, force: true })
  console.log(`[copy-assets] ✅ Created and copied assets to: ${path.relative(rootDir, defaultTarget)}`)
}
