require('dotenv').config({ path: './server/.env' });
const neo4j = require('neo4j-driver');

const neo4jUri = process.env.NEO4J_URI || 'bolt://localhost:7687';
const neo4jUser = process.env.NEO4J_USER || 'neo4j';
const neo4jPassword = process.env.NEO4J_PASSWORD || 'password';

console.info(`[Migration] Connecting to ${neo4jUri}...`);
const driver = neo4j.driver(neo4jUri, neo4j.auth.basic(neo4jUser, neo4jPassword));

function parseJsonArray(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  try {
    return JSON.parse(val);
  } catch (e) {
    return [];
  }
}

async function run() {
  const session = driver.session();
  try {
    // 1. Migrate Crops
    console.info('[Migration] Processing Crops...');
    const cropsResult = await session.run('MATCH (c:Crop) RETURN c');
    let cropCount = 0;
    for (const record of cropsResult.records) {
      const crop = record.get('c').properties;
      const { id, fieldId, sowType, pestIds } = crop;
      const parsedPestIds = parseJsonArray(pestIds);

      // Clean relationships
      await session.run(`
        MATCH (c:Crop {id: $id})
        OPTIONAL MATCH (c)-[r1:SOWN_IN]->() DELETE r1
        WITH c
        OPTIONAL MATCH (c)-[r2:PLANTED_IN]->() DELETE r2
        WITH c
        OPTIONAL MATCH (c)-[r3:AFFECTED_BY]->() DELETE r3
      `, { id });

      // SOWN_IN / PLANTED_IN
      if (fieldId) {
        if (sowType === 'Nursery') {
          await session.run(`
            MATCH (c:Crop {id: $id})
            MATCH (n:NurseryBed {id: $fieldId})
            MERGE (c)-[:SOWN_IN]->(n)
          `, { id, fieldId });
        } else {
          await session.run(`
            MATCH (c:Crop {id: $id})
            MATCH (f:Field {id: $fieldId})
            MERGE (c)-[:PLANTED_IN]->(f)
          `, { id, fieldId });
        }
      }

      // AFFECTED_BY (pests)
      for (const pestId of parsedPestIds) {
        await session.run(`
          MATCH (c:Crop {id: $id})
          MATCH (p:Pest {id: $pestId})
          MERGE (c)-[:AFFECTED_BY]->(p)
        `, { id, pestId });
      }
      cropCount++;
    }
    console.info(`[Migration] Rebuilt relationships for ${cropCount} Crops.`);

    // 2. Migrate Livestock
    console.info('[Migration] Processing Livestock...');
    const livestockResult = await session.run('MATCH (l:Livestock) RETURN l');
    let livestockCount = 0;
    for (const record of livestockResult.records) {
      const livestock = record.get('l').properties;
      const { id, fieldId } = livestock;

      await session.run(`
        MATCH (l:Livestock {id: $id})
        OPTIONAL MATCH (l)-[r:LOCATED_IN]->() DELETE r
      `, { id });

      if (fieldId) {
        await session.run(`
          MATCH (l:Livestock {id: $id})
          MATCH (f:Field {id: $fieldId})
          MERGE (l)-[:LOCATED_IN]->(f)
        `, { id, fieldId });
      }
      livestockCount++;
    }
    console.info(`[Migration] Rebuilt relationships for ${livestockCount} Livestock.`);

    // 3. Migrate LivestockKits
    console.info('[Migration] Processing LivestockKits...');
    const kitsResult = await session.run('MATCH (k:LivestockKit) RETURN k');
    let kitCount = 0;
    for (const record of kitsResult.records) {
      const kit = record.get('k').properties;
      const { id, motherId, fieldId } = kit;

      await session.run(`
        MATCH (k:LivestockKit {id: $id})
        OPTIONAL MATCH (k)-[r1:BORN_FROM]->() DELETE r1
        WITH k
        OPTIONAL MATCH (k)-[r2:LOCATED_IN]->() DELETE r2
      `, { id });

      if (motherId) {
        await session.run(`
          MATCH (k:LivestockKit {id: $id})
          MATCH (m:Livestock {id: $motherId})
          MERGE (k)-[:BORN_FROM]->(m)
        `, { id, motherId });
      }
      if (fieldId) {
        await session.run(`
          MATCH (k:LivestockKit {id: $id})
          MATCH (f:Field {id: $fieldId})
          MERGE (k)-[:LOCATED_IN]->(f)
        `, { id, fieldId });
      }
      kitCount++;
    }
    console.info(`[Migration] Rebuilt relationships for ${kitCount} LivestockKits.`);

    // 4. Migrate BreedingEvents
    console.info('[Migration] Processing BreedingEvents...');
    const breedingResult = await session.run('MATCH (b:BreedingEvent) RETURN b');
    let breedingCount = 0;
    for (const record of breedingResult.records) {
      const breeding = record.get('b').properties;
      const { id, motherId, fatherId } = breeding;

      await session.run(`
        MATCH (b:BreedingEvent {id: $id})
        OPTIONAL MATCH (b)-[r1:HAS_MOTHER]->() DELETE r1
        WITH b
        OPTIONAL MATCH (b)-[r2:HAS_FATHER]->() DELETE r2
      `, { id });

      if (motherId) {
        await session.run(`
          MATCH (b:BreedingEvent {id: $id})
          MATCH (m:Livestock {id: $motherId})
          MERGE (b)-[:HAS_MOTHER]->(m)
        `, { id, motherId });
      }
      if (fatherId) {
        await session.run(`
          MATCH (b:BreedingEvent {id: $id})
          MATCH (f:Livestock {id: $fatherId})
          MERGE (b)-[:HAS_FATHER]->(f)
        `, { id, fatherId });
      }
      breedingCount++;
    }
    console.info(`[Migration] Rebuilt relationships for ${breedingCount} BreedingEvents.`);

    // 5. Migrate Harvests
    console.info('[Migration] Processing Harvests...');
    const harvestResult = await session.run('MATCH (h:Harvest) RETURN h');
    let harvestCount = 0;
    for (const record of harvestResult.records) {
      const harvest = record.get('h').properties;
      const { id, cropId } = harvest;

      await session.run(`
        MATCH (h:Harvest {id: $id})
        OPTIONAL MATCH (h)-[r:HARVESTED_FROM]->() DELETE r
      `, { id });

      if (cropId) {
        await session.run(`
          MATCH (h:Harvest {id: $id})
          MATCH (c:Crop {id: $cropId})
          MERGE (h)-[:HARVESTED_FROM]->(c)
        `, { id, cropId });
      }
      harvestCount++;
    }
    console.info(`[Migration] Rebuilt relationships for ${harvestCount} Harvests.`);

    // 6. Migrate Transactions
    console.info('[Migration] Processing Transactions...');
    const txResult = await session.run('MATCH (t:Transaction) RETURN t');
    let txCount = 0;
    for (const record of txResult.records) {
      const tx = record.get('t').properties;
      const { id, category, assetId } = tx;

      await session.run(`
        MATCH (t:Transaction {id: $id})
        OPTIONAL MATCH (t)-[r1:OF_CATEGORY]->() DELETE r1
        WITH t
        OPTIONAL MATCH (t)-[r2:RELATED_TO]->() DELETE r2
      `, { id });

      if (category) {
        await session.run(`
          MATCH (t:Transaction {id: $id})
          MERGE (c:TransactionCategory {name: $category})
          MERGE (t)-[:OF_CATEGORY]->(c)
        `, { id, category });
      }
      if (assetId) {
        await session.run(`
          MATCH (t:Transaction {id: $id})
          MATCH (asset {id: $assetId})
          MERGE (t)-[:RELATED_TO]->(asset)
        `, { id, assetId });
      }
      txCount++;
    }
    console.info(`[Migration] Rebuilt relationships for ${txCount} Transactions.`);

    // 7. Migrate Activities
    console.info('[Migration] Processing Activities...');
    const activityResult = await session.run('MATCH (a:Activity) RETURN a');
    let activityCount = 0;
    for (const record of activityResult.records) {
      const activity = record.get('a').properties;
      const { id, targetId } = activity;

      await session.run(`
        MATCH (a:Activity {id: $id})
        OPTIONAL MATCH (a)-[r:PERFORMED_ON]->() DELETE r
      `, { id });

      if (targetId) {
        await session.run(`
          MATCH (a:Activity {id: $id})
          MATCH (target {id: $targetId})
          MERGE (a)-[:PERFORMED_ON]->(target)
        `, { id, targetId });
      }
      activityCount++;
    }
    console.info(`[Migration] Rebuilt relationships for ${activityCount} Activities.`);

    // 8. Migrate TaskAssignments
    console.info('[Migration] Processing TaskAssignments...');
    const assignmentResult = await session.run('MATCH (a:TaskAssignment) RETURN a');
    let assignmentCount = 0;
    for (const record of assignmentResult.records) {
      const assignment = record.get('a').properties;
      const { id, fieldId, equipmentId, planningId, workerIds } = assignment;
      const parsedWorkerIds = parseJsonArray(workerIds);

      await session.run(`
        MATCH (a:TaskAssignment {id: $id})
        OPTIONAL MATCH (a)-[r1:ON_FIELD]->() DELETE r1
        WITH a
        OPTIONAL MATCH (a)-[r2:USES_EQUIPMENT]->() DELETE r2
        WITH a
        OPTIONAL MATCH (a)-[r3:PART_OF_PLAN]->() DELETE r3
        WITH a
        OPTIONAL MATCH (a)-[r4:ASSIGNED_TO]->() DELETE r4
      `, { id });

      if (fieldId) {
        await session.run(`
          MATCH (a:TaskAssignment {id: $id})
          MATCH (f:Field {id: $fieldId})
          MERGE (a)-[:ON_FIELD]->(f)
        `, { id, fieldId });
      }
      if (equipmentId) {
        await session.run(`
          MATCH (a:TaskAssignment {id: $id})
          MATCH (e:Equipment {id: $equipmentId})
          MERGE (a)-[:USES_EQUIPMENT]->(e)
        `, { id, equipmentId });
      }
      if (planningId) {
        await session.run(`
          MATCH (a:TaskAssignment {id: $id})
          MATCH (p {id: $planningId}) WHERE p:Goal OR p:Objective
          MERGE (a)-[:PART_OF_PLAN]->(p)
        `, { id, planningId });
      }
      for (const workerId of parsedWorkerIds) {
        await session.run(`
          MATCH (a:TaskAssignment {id: $id})
          MATCH (w:Employee {id: $workerId})
          MERGE (a)-[:ASSIGNED_TO]->(w)
        `, { id, workerId });
      }
      assignmentCount++;
    }
    console.info(`[Migration] Rebuilt relationships for ${assignmentCount} TaskAssignments.`);

    // 9. Migrate SoilTests
    console.info('[Migration] Processing SoilTests...');
    const soilResult = await session.run('MATCH (s:SoilTest) RETURN s');
    let soilCount = 0;
    for (const record of soilResult.records) {
      const test = record.get('s').properties;
      const { id, fieldId } = test;

      await session.run(`
        MATCH (s:SoilTest {id: $id})
        OPTIONAL MATCH (s)-[r:TESTED_ON]->() DELETE r
      `, { id });

      if (fieldId) {
        await session.run(`
          MATCH (s:SoilTest {id: $id})
          MATCH (f:Field {id: $fieldId})
          MERGE (s)-[:TESTED_ON]->(f)
        `, { id, fieldId });
      }
      soilCount++;
    }
    console.info(`[Migration] Rebuilt relationships for ${soilCount} SoilTests.`);

    // 10. Migrate Goals
    console.info('[Migration] Processing Goals...');
    const goalResult = await session.run('MATCH (g:Goal) RETURN g');
    let goalCount = 0;
    for (const record of goalResult.records) {
      const goal = record.get('g').properties;
      const { id, parentGoalId, workerIds } = goal;
      const parsedWorkerIds = parseJsonArray(workerIds);

      await session.run(`
        MATCH (g:Goal {id: $id})
        OPTIONAL MATCH (g)-[r1:PARENT_GOAL]->() DELETE r1
        WITH g
        OPTIONAL MATCH (g)-[r2:ASSIGNED_TO]->() DELETE r2
      `, { id });

      if (parentGoalId) {
        await session.run(`
          MATCH (g:Goal {id: $id})
          MATCH (p:Goal {id: $parentGoalId})
          MERGE (g)-[:PARENT_GOAL]->(p)
        `, { id, parentGoalId });
      }
      for (const workerId of parsedWorkerIds) {
        await session.run(`
          MATCH (g:Goal {id: $id})
          MATCH (w:Employee {id: $workerId})
          MERGE (g)-[:ASSIGNED_TO]->(w)
        `, { id, workerId });
      }
      goalCount++;
    }
    console.info(`[Migration] Rebuilt relationships for ${goalCount} Goals.`);

    // 11. Migrate Objectives
    console.info('[Migration] Processing Objectives...');
    const objResult = await session.run('MATCH (o:Objective) RETURN o');
    let objCount = 0;
    for (const record of objResult.records) {
      const obj = record.get('o').properties;
      const { id, goalId, workerIds } = obj;
      const parsedWorkerIds = parseJsonArray(workerIds);

      await session.run(`
        MATCH (o:Objective {id: $id})
        OPTIONAL MATCH ()-[r1:HAS_OBJECTIVE]->(o) DELETE r1
        WITH o
        OPTIONAL MATCH (o)-[r2:ASSIGNED_TO]->() DELETE r2
      `, { id });

      if (goalId) {
        await session.run(`
          MATCH (o:Objective {id: $id})
          MATCH (g:Goal {id: $goalId})
          MERGE (g)-[:HAS_OBJECTIVE]->(o)
        `, { id, goalId });
      }
      for (const workerId of parsedWorkerIds) {
        await session.run(`
          MATCH (o:Objective {id: $id})
          MATCH (w:Employee {id: $workerId})
          MERGE (o)-[:ASSIGNED_TO]->(w)
        `, { id, workerId });
      }
      objCount++;
    }
    console.info(`[Migration] Rebuilt relationships for ${objCount} Objectives.`);

    console.info('[Migration] Database relationships migration completed successfully!');
  } catch (err) {
    console.error('[Migration] Migration FAILED:', err);
  } finally {
    await session.close();
    await driver.close();
  }
}

run();
