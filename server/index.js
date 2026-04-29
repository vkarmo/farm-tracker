const express = require('express');
const cors = require('cors');
const neo4j = require('neo4j-driver');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Essential headers to allow Google OAuth popups to function correctly when embedded in iframes like Replit
app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  res.setHeader('Cross-Origin-Embedder-Policy', 'unsafe-none');
  next();
});

// Initialize Neo4j Driver
let neo4jUri = process.env.NEO4J_URI || 'bolt://localhost:7687';
// Automatically upgrade bolt+s to neo4j+s for AuraDB routing compatibility
if (neo4jUri.includes('.databases.neo4j.io') && neo4jUri.startsWith('bolt+s://')) {
  neo4jUri = neo4jUri.replace('bolt+s://', 'neo4j+s://');
}
const neo4jUser = process.env.NEO4J_USER || 'neo4j';
const neo4jPassword = process.env.NEO4J_PASSWORD || 'password';
const neo4jDatabase = process.env.NEO4J_DATABASE || undefined;

const driver = neo4j.driver(
  neo4jUri,
  neo4j.auth.basic(neo4jUser, neo4jPassword)
);

driver.verifyConnectivity()
  .then(() => {
    console.info(`[Neo4j Database] Attempting connection to ${neo4jUri} with username: ${neo4jUser} and password: ${neo4jPassword}`);
    console.info('[Neo4j Database] Connection SUCCESSFUL.');
  })
  .catch((err) => {
    console.error(`[Neo4j Database] Attempting connection to ${neo4jUri} with username: ${neo4jUser} and password: ${neo4jPassword}`);
    console.error(`[Neo4j Database] xx Connection FAILED: ${err.message}`);
  });

// Standard CRUD routes for basic queries (legacy and global system mappings)

// SECURITY WARNING: This endpoint exposes the database credentials in plaintext.
// It is intended for admin debugging only. In production, this must be secured with strict authentication middleware!
app.get('/api/admin/db-config', (req, res) => {
  res.json({
    NEO4J_URI: process.env.NEO4J_URI || 'bolt://localhost:7687',
    NEO4J_USER: process.env.NEO4J_USER || 'neo4j',
    NEO4J_PASSWORD: process.env.NEO4J_PASSWORD || 'password',
  });
});

app.get('/api/users', async (req, res) => {
  const session = driver.session();
  try {
    const result = await session.run('MATCH (u:User) RETURN u');
    const users = result.records.map(record => {
      const props = record.get('u').properties;
      if (props.allowedTabs) {
        try { props.allowedTabs = JSON.parse(props.allowedTabs); } catch(e){}
      }
      return props;
    });
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

// Global Data Hydration
app.get('/api/all-data', async (req, res) => {
  const session = driver.session();
  try {
    const collections = {
       fields: 'MATCH (n:Field) RETURN n',
       nurseries: 'MATCH (n:NurseryBed) RETURN n',
       crops: 'MATCH (n:Crop) RETURN n',
       livestock: 'MATCH (n:Livestock) RETURN n',
       equipment: 'MATCH (n:Equipment) RETURN n',
       assignments: 'MATCH (n:TaskAssignment) RETURN n',
       employees: 'MATCH (n:Employee) RETURN n',
       financials: 'MATCH (n:FinancialRecord) RETURN n',
       budgets: 'MATCH (n:BudgetRecord) RETURN n',
       incidents: 'MATCH (n:Incident) RETURN n',
       deadlines: 'MATCH (n:Deadline) RETURN n',
       gps: 'MATCH (n:GpsLocation) RETURN n',
       audit: 'MATCH (n:AuditLog) RETURN n',
       users: 'MATCH (n:User) RETURN n',
       settings: "MATCH (n:GlobalSettings {id: 'default'}) RETURN n"
    };

    const data = {};
    for (const [key, query] of Object.entries(collections)) {
       const result = await session.run(query);
       data[key] = result.records.map(r => {
           const props = r.get('n').properties;
           // Parse JSON strings back to objects (e.g. polygon)
           if (props.polygon) {
               try { props.polygon = JSON.parse(props.polygon); } catch(e){}
           }
           if (props.boundary) {
               try { props.boundary = JSON.parse(props.boundary); } catch(e){}
           }
           if (props.tags) {
               try { props.tags = JSON.parse(props.tags); } catch(e){}
           }
           if (props.metadata) {
               try { props.metadata = JSON.parse(props.metadata); } catch(e){}
           }
           if (props.allowedTabs) {
               try { props.allowedTabs = JSON.parse(props.allowedTabs); } catch(e){}
           }
           if (key === 'settings') {
               ['units', 'jobTitles', 'kmlUrls', 'mapCenter'].forEach(field => {
                   if (props[field] && typeof props[field] === 'string') {
                       try { props[field] = JSON.parse(props[field]); } catch(e) {}
                   }
               });
           }
           return props;
       });
    }

    res.json(data);
  } catch (err) {
    console.error('Failed to fetch all data:', err);
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
          { id, name, area, soil_type, irrigation, status, year, polygon: polygon ? JSON.stringify(polygon) : null }
        );
        results.push({ actionId: action.meta?.id, status: 'success' });
      }
      else if (action.type === 'nurseries/addBed') {
        const { id, name, capacity, status, polygon } = action.payload;
        await session.run(
          'MERGE (n:NurseryBed {id: $id}) SET n.name = $name, n.capacity = $capacity, n.status = $status, n.polygon = $polygon RETURN n',
          { id, name, capacity, status, polygon: polygon ? JSON.stringify(polygon) : null }
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
        const { id, type: activityType, targetId, date, plannedDate, personResponsible, notes } = action.payload;
        await session.run(`
          MERGE (a:Activity {id: $id})
          SET a.type = $activityType, a.date = $date, a.plannedDate = $plannedDate, a.personResponsible = $personResponsible, a.notes = $notes
          WITH a
          MATCH (target {id: $targetId})
          MERGE (a)-[:PERFORMED_ON]->(target)
          RETURN a
        `, { id, activityType, targetId, date, plannedDate, personResponsible, notes });
        results.push({ actionId: action.meta?.id, status: 'success' });
      }
      else if (action.type === 'budgets/upsertBudget') {
        const { id, name, description, exchangeRate } = action.payload;
        await session.run(`
          MERGE (b:Budget {id: $id})
          SET b.name = $name, b.description = $description, b.exchangeRate = $exchangeRate
          RETURN b
        `, { id, name, description, exchangeRate });
        results.push({ actionId: action.meta?.id, status: 'success' });
      }
      else if (action.type === 'budgets/upsertBudgetItem') {
        const { budgetId, item } = action.payload;
        await session.run(`
          MERGE (i:BudgetItem {id: $item.id})
          SET i.category = $item.category, i.description = $item.description, 
              i.amount = toFloat($item.amount), i.currency = $item.currency, i.status = $item.status
          WITH i
          MATCH (b:Budget {id: $budgetId})
          MERGE (b)-[:CONTAINS]->(i)
          RETURN i
        `, { budgetId, item });
        results.push({ actionId: action.meta?.id, status: 'success' });
      }
      else if (action.type === 'users/upsertUser') {
        const { id, email, name, role, profilePic, allowedTabs } = action.payload;
        await session.run(`
          MERGE (u:User {email: $email})
          ON CREATE SET u.id = $id
          SET u.name = $name, u.role = $role, u.profile_pic = $profilePic
          ${allowedTabs !== undefined ? ', u.allowedTabs = $allowedTabs' : ''}
          RETURN u
        `, { id, email, name, role, profilePic, allowedTabs: allowedTabs !== undefined ? JSON.stringify(allowedTabs) : null });
        results.push({ actionId: action.meta?.id, status: 'success' });
      }
      else if (action.type === 'users/updateUserAccess') {
        const { email, allowedTabs } = action.payload;
        await session.run(`
          MATCH (u:User {email: $email})
          SET u.allowedTabs = $allowedTabs
          RETURN u
        `, { email, allowedTabs: JSON.stringify(allowedTabs) });
        results.push({ actionId: action.meta?.id, status: 'success' });
      }
      else if (action.type === 'employees/upsertEmployee') {
        const { id, firstName, lastName, address, phone, jobTitle, type, skills, startDate, endDate, isTerminated, terminationReason, dailyRateLD, twoWeekPayUSD } = action.payload;
        await session.run(`
          MERGE (e:Employee {id: $id})
          SET e.firstName = $firstName, e.lastName = $lastName, e.address = $address, e.phone = $phone, 
              e.jobTitle = $jobTitle, e.type = $type, e.skills = $skills, e.startDate = $startDate, 
              e.endDate = $endDate, e.isTerminated = $isTerminated, e.terminationReason = $terminationReason, 
              e.dailyRateLD = toFloat($dailyRateLD), e.twoWeekPayUSD = toFloat($twoWeekPayUSD)
          RETURN e
        `, {
          id,
          firstName: firstName || null,
          lastName: lastName || null,
          address: address || null,
          phone: phone || null,
          jobTitle: jobTitle || null,
          type: type || null,
          skills: skills || null,
          startDate: startDate || null,
          endDate: endDate || null,
          isTerminated: isTerminated || false,
          terminationReason: terminationReason || null,
          dailyRateLD: dailyRateLD || 0,
          twoWeekPayUSD: twoWeekPayUSD || 0
        });
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
      else if (action.type === 'gps/addLocation') {
        const { id, lat, lng, timestamp, userEmail } = action.payload;
        await session.run(`
          MERGE (g:GpsLog {id: $id})
          SET g.lat = $lat, g.lng = $lng, g.timestamp = $timestamp, g.userEmail = $userEmail
          WITH g
          OPTIONAL MATCH (u:User {email: $userEmail})
          FOREACH (ignoreMe IN CASE WHEN u IS NOT NULL THEN [1] ELSE [] END |
            MERGE (u)-[:LOGGED_LOCATION]->(g)
          )
          RETURN g
        `, { id, lat, lng, timestamp, userEmail });
        results.push({ actionId: action.meta?.id, status: 'success' });
      }
      else if (action.type === 'settings/updateGlobal') {
        const payload = action.payload;
        const properties = {};
        for (const [k, v] of Object.entries(payload)) {
           if (Array.isArray(v)) {
               properties[k] = JSON.stringify(v);
           } else {
               properties[k] = v;
           }
        }
        await session.run(`
          MERGE (s:GlobalSettings {id: 'default'})
          SET s += $properties
          RETURN s
        `, { properties });
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

// Serve client dist conditionally in production
const path = require('path');
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/dist'), {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('sw.js') || filePath.endsWith('registerSW.js')) {
        res.setHeader('Cache-Control', 'max-age=0, no-cache, no-store, must-revalidate');
      }
    }
  }));
  app.get(/(.*)/, (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
  });
}

app.listen(port, '0.0.0.0', () => {
  console.log(`Node Server proxy running on port ${port}`);
});

// Cleanup driver gracefully
process.on('SIGINT', async () => {
  await driver.close();
  process.exit(0);
});
