require('dotenv').config();
const neo4j = require('neo4j-driver');
const driver = neo4j.driver(process.env.NEO4J_URI, neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD));

async function run() {
  const session = driver.session(); 
  try {
    const res1 = await session.run('MATCH (f:Field) RETURN count(f) as count');
    console.log("Count Query SUCCESS:", res1.records[0].get('count').toNumber());
    
    const res2 = await session.run('MATCH (f:Field) RETURN f LIMIT 1');
    console.log("Node Query SUCCESS", res2.records.length);
  } catch(e) {
    console.error("Query FAILED: ", e);
  } finally {
    await session.close();
    await driver.close();
  }
}
run();
