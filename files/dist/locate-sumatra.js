// Run this with: node locate-sumatra.js
// It finds the SumatraPDF.exe binary that pdf-to-printer installed,
// so build.bat can copy it next to the compiled .exe.
const fs = require('fs');
const path = require('path');

function findExe(dir) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return null;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = findExe(full);
      if (found) return found;
    } else if (/sumatra.*\.exe$/i.test(entry.name)) {
      return full;
    }
  }
  return null;
}

try {
  const pkgJsonPath = require.resolve('pdf-to-printer/package.json');
  const dir = path.dirname(pkgJsonPath);
  const exePath = findExe(dir);
  if (exePath) {
    console.log(exePath);
    process.exit(0);
  } else {
    console.error('Could not find SumatraPDF.exe inside node_modules/pdf-to-printer.');
    console.error('Searched under: ' + dir);
    process.exit(1);
  }
} catch (e) {
  console.error('pdf-to-printer not found. Run "npm install" first.');
  process.exit(1);
}
