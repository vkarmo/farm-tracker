require('dotenv').config();
const neo4j = require('neo4j-driver');
const driver = neo4j.driver(process.env.NEO4J_URI, neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD));

async function run() {
  const session = driver.session({ database: 'neo4j' }); 
  try {
    const result = await session.run(
      'MERGE (f:Field {id: $id}) SET f.name = $name, f.area = $area, f.soil_type = $soil_type, f.irrigation = $irrigation, f.status = $status, f.year = $year, f.polygon = $polygon RETURN f',
      { id: "test", name: "test", area: 1, soil_type: "clay", irrigation: "none", status: "active", year: 2026, polygon: null }
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
