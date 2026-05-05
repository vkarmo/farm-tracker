const fs = require('fs');
let code = fs.readFileSync('index.js', 'utf8');

// Global replacement: first, ensure we extract userEmail at the top of the loop
code = code.replace(
  'for (const action of queue) {',
  `for (const action of queue) {\n      const userEmail = (action.payload && action.payload.lastUpdatedBy) ? action.payload.lastUpdatedBy : 'system';`
);

// Add userEmail to the parameters of session.run calls inside the loop.
// Note: Some have `{ id, name...` and some have `{ properties }` or `{ email...`
// A regex to match `, { ` followed by variable declarations until ` }` at the end of session.run.
code = code.replace(/,\s*\{\s*id,/g, ", { userEmail, id,");
code = code.replace(/,\s*\{\s*budgetId,/g, ", { userEmail, budgetId,");
code = code.replace(/,\s*\{\s*email,/g, ", { userEmail, email,");
code = code.replace(/,\s*\{\s*properties\s*\}/g, ", { userEmail, properties }");

// Now we need to append lastUpdatedBy to the SET statements.
// We can find `SET [a-z]\.[\w]+ = ` and append it to the end of the SET clause.
// It's safer to use a regex to match `SET ` ... up to `\n` or `WITH` or `RETURN`
// Actually, it's easier to manually replace the specific queries since they are known.
fs.writeFileSync('index.js', code);
console.log('Parameters updated. Need manual string replacement for SET and FOREACH.');
