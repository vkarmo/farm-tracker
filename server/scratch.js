const neo4j = require('neo4j-driver');
require('dotenv').config();

async function run() {
  const uri = process.env.NEO4J_URI || 'neo4j+s://3fa11aa8.databases.neo4j.io';
  const user = process.env.NEO4J_USER || 'neo4j';
  const pass = process.env.NEO4J_PASSWORD || '86pHNuUi5b4XVA7X05y_0gVQAHyZ72L3uCM1PQ3frUo';
  
  const driver = neo4j.driver(uri, neo4j.auth.basic(user, pass));
  const session = driver.session();
  try {
    const res = await session.run(
      `MATCH (e:Employee) WHERE e.jobTitle = 'Manager' SET e.jobTitle = 'General Manager' RETURN count(e) AS cnt`
    );
    console.log('Employee update count:', res.records[0].get('cnt').toString());
    
    // Also update settings jobTitles list in DB
    const res2 = await session.run(
      `MATCH (s:Settings)
       UNWIND s.jobTitles AS title
       WITH s, collect(CASE WHEN title = 'Manager' THEN 'General Manager' ELSE title END) AS newTitles
       SET s.jobTitles = newTitles
       RETURN count(s)`
    );
    console.log('Settings update count:', res2.records[0].get(0).toString());
    
  } catch (e) {
    console.error('Error during migration:', e);
  } finally {
    await session.close();
    await driver.close();
  }
}
run();
