require('dotenv').config();
const neo4j = require('neo4j-driver');
const driver = neo4j.driver(process.env.NEO4J_URI, neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD));

async function run() {
  const session = driver.session(); 
  try {
    const res = await session.run('SHOW DATABASES YIELD name, currentStatus, default');
    console.log("Databases: ", res.records.map(r => ({ name: r.get('name'), status: r.get('currentStatus'), default: r.get('default') })));
  } catch(e) {
    console.error("Query FAILED: ", e);
  } finally {
    await session.close();
    await driver.close();
  }
}
run();
