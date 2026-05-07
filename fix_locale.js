const fs = require('fs');
const path = require('path');

const dir = 'client/src/components';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.jsx'));

for (const file of files) {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;

  // Replace standard object property comparisons
  // e.g. a.name.localeCompare(b.name)
  // Be careful not to replace already safe ones like (a.name || '').localeCompare
  content = content.replace(/\b([a-zA-Z_0-9]+)\.([a-zA-Z_0-9]+)\.localeCompare\(([a-zA-Z_0-9]+)\.\2\)/g, '($1.$2 || \'\').localeCompare($3.$2 || \'\')');

  // Replace primitive variables
  // e.g. a.localeCompare(b) if it's not already safe
  content = content.replace(/(?<!\(\)\s*|\bString\()\b([a-zA-Z_0-9]+)\.localeCompare\(([a-zA-Z_0-9]+)\)/g, '($1 || \'\').localeCompare($2 || \'\')');

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${file}`);
  }
}
