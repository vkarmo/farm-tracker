const fs = require('fs');
let code = fs.readFileSync('index.js', 'utf8');

// The best way to safely inject lastUpdatedBy into every MERGE SET is to find all queries and append it to SET.
// We can use regex to find: `SET x.something = ... \n` and append `, x.lastUpdatedBy = $userEmail`
// It is easier to match `RETURN ` and prepend `SET alias.lastUpdatedBy = $userEmail ` but we don't always know the alias.
// Wait, we can find `RETURN x` and replace with `SET x.lastUpdatedBy = $userEmail RETURN x`.
// And for relationships: `MERGE (x)-[:REL]->(y)` -> `MERGE (x)-[r:REL]->(y) SET r.lastUpdatedBy = $userEmail`
// But wait, what if `r` is already used? 
// It's safer to use a custom python or JS script that iterates over queries and injects correctly.

let lines = code.split('\n');
let modified = [];

let inQuery = false;
let queryAlias = '';

for (let i = 0; i < lines.length; i++) {
  let line = lines[i];

  if (line.includes('MERGE (')) {
    // try to extract alias
    let m = line.match(/MERGE \(([a-z]+):[A-Za-z]+ \{/);
    if (m) queryAlias = m[1];
  }

  // Handle FOREACH relationships:
  // e.g. FOREACH (ignore IN CASE WHEN f IS NOT NULL THEN [1] ELSE [] END | MERGE (c)-[:PLANTED_IN]->(f))
  // -> FOREACH (... | MERGE (c)-[r_new:PLANTED_IN]->(f) SET r_new.lastUpdatedBy = $userEmail)
  if (line.includes('FOREACH (ignore') && line.includes('MERGE (')) {
    // extract relation part
    let relMatch = line.match(/(MERGE \([a-z]\)-\[)(:[A-Z_]+)(\]-\>\([a-z]\))\)/);
    if (relMatch) {
      line = line.replace(relMatch[0], `${relMatch[1]}rel_new${relMatch[2]}${relMatch[3]} SET rel_new.lastUpdatedBy = $userEmail)`);
    } else {
      let relMatch2 = line.match(/(MERGE \([a-z]\)-\[)([a-z]+:[A-Z_]+)(\]-\>\([a-z]\))/);
      if (relMatch2) {
         let relAlias = relMatch2[2].split(':')[0];
         line = line.replace(relMatch2[0] + ')', `${relMatch2[0]} SET ${relAlias}.lastUpdatedBy = $userEmail)`);
      }
    }
  }

  // Handle core/updateNode which is slightly different
  if (line.includes('SET n += $properties')) {
    line = line.replace('SET n += $properties', 'SET n += $properties, n.lastUpdatedBy = $userEmail');
  }

  // Handle SET alias.lastUpdatedBy before RETURN alias
  if (line.match(/RETURN [a-z]\s*$/) || line.match(/RETURN [a-z]\s*`/)) {
    let m = line.match(/RETURN ([a-z])/);
    if (m && !line.includes('lastUpdatedBy')) {
       // if we are inside a query, replace RETURN x with SET x.lastUpdatedBy = $userEmail RETURN x
       line = line.replace(`RETURN ${m[1]}`, `SET ${m[1]}.lastUpdatedBy = $userEmail RETURN ${m[1]}`);
    }
  }
  
  if (line.match(/RETURN DISTINCT ([a-z])/)) {
    let m = line.match(/RETURN DISTINCT ([a-z])/);
    if (m && !line.includes('lastUpdatedBy')) {
       line = line.replace(`RETURN DISTINCT ${m[1]}`, `SET ${m[1]}.lastUpdatedBy = $userEmail RETURN DISTINCT ${m[1]}`);
    }
  }

  modified.push(line);
}

fs.writeFileSync('index.js', modified.join('\n'));
