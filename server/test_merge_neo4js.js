require('dotenv').config();
const neo4j = require('neo4j-driver');
// Force neo4j+s protocol
const uri = process.env.NEO4J_URI.replace('bolt+s', 'neo4j+s');
const driver = neo4j.driver(uri, neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD));

async function run() {
  const session = driver.session(); 
  try {
    const result = await session.run(
      'MERGE (f:Field {id: $id}) SET f.name = $name RETURN f',
      { id: "test", name: "test_neo4js" }
    );
    console.log("Merge SUCCESS", result.records.length);
  } catch(e) {
    console.error("Query FAILED: ", e.message);
  } finally {
    await session.close();
    await driver.close();
  }
}
run();
