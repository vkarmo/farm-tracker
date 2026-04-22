const neo4j = require('neo4j-driver');

async function testAuth(user, pass) {
  const driver = neo4j.driver('neo4j+s://3fa11aa8.databases.neo4j.io', neo4j.auth.basic(user, pass));
  try {
    const serverInfo = await driver.getServerInfo();
    console.log(`Success with ${user}! Server:`, serverInfo);
  } catch (e) {
    console.log(`Failed with ${user}:`, e.message);
  } finally {
    await driver.close();
  }
}

async function run() {
  await testAuth('3fa11aa8', '86pHNuUi5b4XVA7X05y_0gVQAHyZ72L3uCM1PQ3frUo');
  await testAuth('neo4j', '86pHNuUi5b4XVA7X05y_0gVQAHyZ72L3uCM1PQ3frUo');
}
run();
