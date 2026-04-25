require('dotenv').config({ path: './server/.env' });
const neo4j = require('neo4j-driver');
const driver = neo4j.driver(process.env.NEO4J_URI, neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD));

async function run() {
  const session = driver.session({ database: 'system' });
  try {
    const res = await session.run('SHOW DATABASES');
    console.log(res.records.map(r => r.get('name')));
  } catch(e) {
    console.error('system error:', e);
  } finally {
    await session.close();
    await driver.close();
  }
}
run();
