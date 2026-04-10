const express = require('express');
const cors = require('cors');
const neo4j = require('neo4j-driver');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Initialize Neo4j Driver
const driver = neo4j.driver(
  process.env.NEO4J_URI || 'bolt://localhost:7687',
  neo4j.auth.basic(
    process.env.NEO4J_USER || 'neo4j',
    process.env.NEO4J_PASSWORD || 'password'
  )
);

// Standard CRUD routes for basic queries (legacy and global system mappings)

app.get('/api/users', async (req, res) => {
  const session = driver.session();
  try {
    const result = await session.run('MATCH (u:User) RETURN u');
    const users = result.records.map(record => record.get('u').properties);
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch authorized users' });
  } finally {
    await session.close();
  }
});

// Get all fields
app.get('/api/fields', async (req, res) => {
  const session = driver.session();
  try {
    const result = await session.run('MATCH (f:Field) RETURN f');
    const fields = result.records.map(r => r.get('f').properties);
    res.json(fields);
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    await session.close();
  }
});

// Create a field
app.post('/api/fields', async (req, res) => {
  const session = driver.session();
  try {
    const { id, name, area, soil_type, irrigation, status, year, polygon } = req.body;
    const result = await session.run(
      'CREATE (f:Field {id: $id, name: $name, area: $area, soil_type: $soil_type, irrigation: $irrigation, status: $status, year: $year, polygon: $polygon}) RETURN f',
      { id, name, area, soil_type, irrigation, status, year, polygon }
    );
    const field = result.records[0].get('f').properties;
    res.json(field);
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    await session.close();
  }
});

// Process Offline Actions Sync Queue
app.post('/api/sync', async (req, res) => {
  const { queue } = req.body;
  if (!queue || !Array.isArray(queue)) {
    return res.status(400).json({ error: 'Invalid queue format' });
  }

  const session = driver.session();
  try {
    const results = [];
    // Run all actions sequentially to maintain order and data integrity
    for (const action of queue) {
      if (action.type === 'fields/addField') {
        const { id, name, area, soil_type, irrigation, status, year, polygon } = action.payload;
        // Merge so we don't recreate if it exists somehow
        await session.run(
          'MERGE (f:Field {id: $id}) SET f.name = $name, f.area = $area, f.soil_type = $soil_type, f.irrigation = $irrigation, f.status = $status, f.year = $year, f.polygon = $polygon RETURN f',
          { id, name, area, soil_type, irrigation, status, year, polygon }
        );
        results.push({ actionId: action.meta?.id, status: 'success' });
      }
      else if (action.type === 'nurseries/addBed') {
        const { id, name, capacity, status } = action.payload;
        await session.run(
          'MERGE (n:NurseryBed {id: $id}) SET n.name = $name, n.capacity = $capacity, n.status = $status RETURN n',
          { id, name, capacity, status }
        );
        results.push({ actionId: action.meta?.id, status: 'success' });
      }
      else if (action.type === 'activities/addActivity') {
        const { id, type, date, notes, fieldId } = action.payload;
        const r = await session.run(
          `
          MATCH (f:Field {id: $fieldId})
          MERGE (a:Activity {id: $id})
          SET a.type = $type, a.date = $date, a.notes = $notes
          MERGE (a)-[:OCCURRED_ON]->(f)
          RETURN a
          `,
          { id, type, date, notes, fieldId }
        );
        results.push({ actionId: action.meta?.id, status: 'success' });
      }
      else if (action.type === 'assets/addCrop') {
        const { id, name, variety, fieldId, plantingDate, expectedHarvest, seedingRate, targetYield, sowType } = action.payload;
        
        if (sowType === 'Nursery') {
          await session.run(`
            MERGE (c:Crop {id: $id}) 
            SET c.name = $name, c.variety = $variety, 
                c.sowing_date = $plantingDate, c.expected_harvest = $expectedHarvest, 
                c.seeding_rate = $seedingRate, c.target_yield = $targetYield
            WITH c 
            MATCH (n:NurseryBed {id: $fieldId}) 
            MERGE (c)-[:SOWN_IN]->(n)
            RETURN c
          `, { id, name, variety, fieldId, plantingDate, expectedHarvest, seedingRate, targetYield });
        } else {
           await session.run(`
            MERGE (c:Crop {id: $id}) 
            SET c.name = $name, c.variety = $variety, 
                c.planting_date = $plantingDate, c.expected_harvest = $expectedHarvest, 
                c.seeding_rate = $seedingRate, c.target_yield = $targetYield
            WITH c 
            MATCH (f:Field {id: $fieldId}) 
            MERGE (c)-[:PLANTED_IN]->(f)
            RETURN c
          `, { id, name, variety, fieldId, plantingDate, expectedHarvest, seedingRate, targetYield });
        }
        
        results.push({ actionId: action.meta?.id, status: 'success' });
      }
      else if (action.type === 'assets/transplantCrop') {
        const { id, fieldId, transplantDate } = action.payload;
        await session.run(`
          MATCH (c:Crop {id: $id})
          MATCH (f:Field {id: $fieldId})
          MERGE (c)-[r:TRANSPLANTED_TO]->(f)
          SET r.date = $transplantDate
          RETURN c
        `, { id, fieldId, transplantDate });
        results.push({ actionId: action.meta?.id, status: 'success' });
      }
      else if (action.type === 'assets/addLivestock') {
        const { id, fieldId, type: animalType, breed, birthDate, tagNumber, healthStatus } = action.payload;
        await session.run(`
          MERGE (l:Livestock {id: $id})
          SET l.type = $animalType, l.breed = $breed, l.birth_date = $birthDate, 
              l.tag_number = $tagNumber, l.health_status = $healthStatus
          WITH l
          OPTIONAL MATCH (f:Field {id: $fieldId})
          FOREACH (ignoreMe IN CASE WHEN f IS NOT NULL THEN [1] ELSE [] END |
            MERGE (l)-[:GRAZES_IN]->(f)
          )
          RETURN l
        `, { id, animalType, breed, birthDate, tagNumber, healthStatus, fieldId });
        results.push({ actionId: action.meta?.id, status: 'success' });
      }
      else if (action.type === 'assets/addHarvest') {
        const { id, amount, unit, date, cropId } = action.payload;
        await session.run(`
          MERGE (h:Harvest {id: $id})
          SET h.amount = toFloat($amount), h.unit = $unit, h.date = $date
          WITH h
          MATCH (c:Crop {id: $cropId})
          MERGE (h)-[:HARVESTED_FROM]->(c)
          RETURN h
        `, { id, amount, unit, date, cropId });
        results.push({ actionId: action.meta?.id, status: 'success' });
      }
      else if (action.type === 'financials/addTransaction') {
        const { id, txType: transactionType, category, amount, date, vendor, notes, assetId } = action.payload;
        await session.run(`
          MERGE (t:Transaction {id: $id})
          SET t.type = $transactionType, t.category = $category, t.amount = $amount, 
              t.date = $date, t.vendor = $vendor, t.notes = $notes
          WITH t
          OPTIONAL MATCH (asset {id: $assetId})
          FOREACH (ignoreMe IN CASE WHEN asset IS NOT NULL THEN [1] ELSE [] END |
            MERGE (t)-[:RELATED_TO]->(asset)
          )
          RETURN t
        `, { id, transactionType, category, amount, date, vendor, notes, assetId });
        results.push({ actionId: action.meta?.id, status: 'success' });
      }
      else if (action.type === 'activities/addActivity') {
        const { id, type: activityType, targetId, date, notes } = action.payload;
        await session.run(`
          MERGE (a:Activity {id: $id})
          SET a.type = $activityType, a.date = $date, a.notes = $notes
          WITH a
          MATCH (target {id: $targetId})
          MERGE (a)-[:PERFORMED_ON]->(target)
          RETURN a
        `, { id, activityType, targetId, date, notes });
        results.push({ actionId: action.meta?.id, status: 'success' });
      }
      else if (action.type === 'users/upsertUser') {
        const { id, email, name, role, profilePic } = action.payload;
        await session.run(`
          MERGE (u:User {email: $email})
          ON CREATE SET u.id = $id
          SET u.name = $name, u.role = $role, u.profile_pic = $profilePic
          RETURN u
        `, { id, email, name, role, profilePic });
        results.push({ actionId: action.meta?.id, status: 'success' });
      }
      else if (action.type === 'core/deleteNode') {
        const { id } = action.payload;
        await session.run('MATCH (n {id: $id}) DETACH DELETE n', { id });
        results.push({ actionId: action.meta?.id, status: 'success' });
      }
      else if (action.type === 'core/updateNode') {
        const { id, properties } = action.payload;
        await session.run('MATCH (n {id: $id}) SET n += $properties RETURN n', { id, properties });
        results.push({ actionId: action.meta?.id, status: 'success' });
      }
      else {
        console.warn('Unknown sync action:', action.type);
        results.push({ actionId: action.meta?.id, status: 'ignored' });
      }
    }
    
    res.json({ success: true, processed: results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    await session.close();
  }
});

app.listen(port, () => {
  console.log(`Node Server proxy running on port ${port}`);
});

// Cleanup driver gracefully
process.on('SIGINT', async () => {
  await driver.close();
  process.exit(0);
});
