const fs = require('fs');
let code = fs.readFileSync('index.js', 'utf8');

// We want to add category linking to financials/addTransaction
const txTarget = `          MERGE (t:Transaction {id: $id})
          SET t.txType = $txType, t.category = $category, t.amount = $amount, 
              t.amountLd = $amountLd, t.exchangeRate = $exchangeRate,
              t.date = $date, t.vendor = $vendor, t.notes = $notes, t.assetId = $assetId`;
const txReplacement = `          MERGE (t:Transaction {id: $id})
          SET t.txType = $txType, t.category = $category, t.amount = $amount, 
              t.amountLd = $amountLd, t.exchangeRate = $exchangeRate,
              t.date = $date, t.vendor = $vendor, t.notes = $notes, t.assetId = $assetId
          WITH t
          OPTIONAL MATCH (c:TransactionCategory {name: $category})
          FOREACH (ignore IN CASE WHEN c IS NULL AND $category <> "" THEN [1] ELSE [] END | MERGE (newC:TransactionCategory {name: $category}) MERGE (t)-[:OF_CATEGORY]->(newC))
          FOREACH (ignore IN CASE WHEN c IS NOT NULL THEN [1] ELSE [] END | MERGE (t)-[:OF_CATEGORY]->(c))`;
code = code.replace(txTarget, txReplacement);

// Now let's inject lastUpdatedBy into every MERGE SET statement inside the queue.
// A simpler way is to just do a regex replace on all queries in index.js:
// `RETURN ` -> `SET x.lastUpdatedBy = $userEmail RETURN ` where x is the alias.
// Wait, the alias isn't always single character, but it usually is. 
// Also FOREACH (ignore IN ... | MERGE (x)-[r:REL]->(y) ...) -> `... MERGE (x)-[r:REL]->(y) SET r.lastUpdatedBy = $userEmail )`

fs.writeFileSync('index.js', code);
