const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, 'src/components');

const files = fs.readdirSync(dir).filter(f => f.endsWith('.jsx') && f !== 'CrudTable.jsx');

files.forEach(file => {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');

  // Check if it uses CrudTable
  if (content.includes('<CrudTable')) {
    // Determine the state variable name
    let activeVar = null;
    if (content.includes('[editingId, setEditingId]')) activeVar = 'editingId';
    else if (content.includes('[editingGoalId,')) activeVar = 'editingGoalId';
    else if (content.includes('[editingPoiId,')) activeVar = 'editingPoiId';

    if (activeVar) {
      // Add activeRowId prop to CrudTable
      // We look for "<CrudTable" and insert activeRowId={activeVar}
      content = content.replace(/<CrudTable/g, `<CrudTable activeRowId={${activeVar}}`);
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Updated ${file} with ${activeVar}`);
    } else {
      console.log(`Skipped ${file} - no editing state found`);
    }
  }
});
