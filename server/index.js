const express = require('express');
const cors = require('cors');
const neo4j = require('neo4j-driver');
require('dotenv').config();
const ee = require('@google/earthengine');
const https = require('https');

function makeHttpsRequest(url, options, postData) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });
    req.on('error', (e) => { reject(e); });
    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

let currentGeeCredsStr = '';
let geeInitialized = false;

function initializeGee(creds) {
  const credsStr = JSON.stringify(creds);
  if (geeInitialized && currentGeeCredsStr === credsStr) {
    return Promise.resolve();
  }
  
  return new Promise((resolve, reject) => {
    if (!creds.client_email || !creds.private_key || !creds.project_id) {
      return reject(new Error('Missing GEE credentials in App Settings.'));
    }
    
    const perfectPrivateKey = creds.private_key;
    
    ee.data.authenticateViaPrivateKey(
      {
        client_email: creds.client_email,
        private_key: perfectPrivateKey
      },
      () => {
        ee.initialize(
          null,
          creds.project_id,
          () => {
            console.log('Earth Engine initialized successfully.');
            geeInitialized = true;
            currentGeeCredsStr = credsStr;
            resolve();
          },
          (err) => {
            console.error('Earth Engine initialization failed:', err);
            reject(new Error(`Earth Engine initialization failed: ${err.message || err}`));
          }
        );
      },
      (err) => {
        console.error('Earth Engine authentication failed:', err);
        reject(new Error(`Earth Engine authentication failed: ${err.message || err}`));
      }
    );
  });
}

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
// Increase body limit so large sync queues (with GeoJSON polygons) don't get rejected
app.use(express.json({ limit: '50mb' }));

// Gracefully handle body-parser errors (like aborted requests during slow mobile syncs)
app.use((err, req, res, next) => {
  if (err && err.type === 'request.aborted') {
    console.warn(`[Express] Ignored aborted request from ${req.ip} during body parsing.`);
    return res.status(400).end();
  }
  next(err);
});

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

function sanitizeIncoming(val) {
  if (val === null || val === undefined) {
    return val;
  }
  if (
    typeof val === 'object' &&
    val.low !== undefined &&
    val.high !== undefined &&
    Object.keys(val).length === 2
  ) {
    return val.low;
  }
  if (
    typeof val === 'object' &&
    val.year !== undefined &&
    val.month !== undefined &&
    val.day !== undefined &&
    (val.hour !== undefined || val.minute !== undefined)
  ) {
    const getVal = (v) => {
      if (v && typeof v === 'object' && v.low !== undefined) return v.low;
      return typeof v === 'number' ? v : 0;
    };
    const year = getVal(val.year);
    const month = String(getVal(val.month)).padStart(2, '0');
    const day = String(getVal(val.day)).padStart(2, '0');
    const hour = String(getVal(val.hour)).padStart(2, '0');
    const minute = String(getVal(val.minute)).padStart(2, '0');
    const second = String(getVal(val.second)).padStart(2, '0');
    const nanosecond = getVal(val.nanosecond || val.nano || 0);
    const ms = String(Math.floor(nanosecond / 1000000)).padStart(3, '0');
    return `${year}-${month}-${day}T${hour}:${minute}:${second}.${ms}Z`;
  }
  if (Array.isArray(val)) {
    return val.map(sanitizeIncoming);
  }
  if (typeof val === 'object') {
    const sanitizedObj = {};
    for (const [k, v] of Object.entries(val)) {
      sanitizedObj[k] = v === undefined ? null : sanitizeIncoming(v);
    }
    return sanitizedObj;
  }
  return val;
}

function sanitizeOutgoing(val) {
  if (val === null || val === undefined) {
    return val;
  }
  if (neo4j.isInt(val)) {
    return val.toNumber();
  }
  if (
    neo4j.isDateTime(val) ||
    neo4j.isDate(val) ||
    neo4j.isTime(val) ||
    neo4j.isLocalTime(val) ||
    neo4j.isLocalDateTime(val) ||
    neo4j.isDuration(val)
  ) {
    return val.toString();
  }
  if (typeof val === 'object') {
    const constructorName = val.constructor ? val.constructor.name : '';
    if (constructorName === 'Node' || (val.labels !== undefined && val.properties !== undefined)) {
      if (val.identity) val.identity = sanitizeOutgoing(val.identity);
      if (val.properties) val.properties = sanitizeOutgoing(val.properties);
      return val;
    }
    if (constructorName === 'Relationship' || (val.type !== undefined && val.properties !== undefined && val.start !== undefined)) {
      if (val.identity) val.identity = sanitizeOutgoing(val.identity);
      if (val.start) val.start = sanitizeOutgoing(val.start);
      if (val.end) val.end = sanitizeOutgoing(val.end);
      if (val.properties) val.properties = sanitizeOutgoing(val.properties);
      return val;
    }
    if (Array.isArray(val)) {
      return val.map(sanitizeOutgoing);
    }
    const sanitizedObj = {};
    for (const [k, v] of Object.entries(val)) {
      sanitizedObj[k] = sanitizeOutgoing(v);
    }
    return sanitizedObj;
  }
  return val;
}

// Monkey-patch session.run to automatically sanitize 'undefined' values to 'null'
// and convert Neo4j types (Integers, DateTime) to/from native JS values to prevent GQL type errors.
const originalSession = driver.session.bind(driver);
driver.session = function(config) {
  const session = originalSession(config);
  const originalRun = session.run.bind(session);
  session.run = function(query, parameters, runConfig) {
    const sanitizedParams = parameters ? sanitizeIncoming(parameters) : parameters;
    const resultPromise = originalRun(query, sanitizedParams, runConfig);
    
    const originalThen = resultPromise.then.bind(resultPromise);
    resultPromise.then = function(onFulfilled, onRejected) {
      return originalThen(result => {
        if (result && result.records) {
          result.records = result.records.map(record => {
            if (record._fields) {
              record._fields = record._fields.map(sanitizeOutgoing);
            }
            return record;
          });
        }
        if (onFulfilled) {
          return onFulfilled(result);
        }
        return result;
      }, onRejected);
    };
    
    return resultPromise;
  };
  return session;
};

async function checkFarmAccess(session, email, farmId) {
  if (!email) return true;
  if (email === 'vkarmo@gmail.com') return true;
  if (farmId === 'dev_farm') return true;
  const fId = farmId || 'default_farm';
  const result = await session.run(`
    MATCH (u:User {email: $email})-[:BELONGS_TO]->(f:Farm {id: $fId})
    RETURN count(u) > 0 AS hasAccess
  `, { email, fId });
  return result.records[0].get('hasAccess');
}

// Helper to get or create settings node for a specific farm
async function getSettingsNode(session, farmId) {
  const fId = farmId || 'default_farm';
  const sId = 'settings_' + fId;

  // Ensure farm and linked settings node exist
  await session.run(`
    MERGE (f:Farm {id: $fId})
    ON CREATE SET f.name = 'NMK Farm'
    MERGE (s:GlobalSettings {id: $sId})
    MERGE (s)-[:BELONGS_TO]->(f)
  `, { fId, sId });

  const result = await session.run(`
    MATCH (s:GlobalSettings)-[:BELONGS_TO]->(:Farm {id: $fId})
    RETURN s
  `, { fId });

  return result.records.length > 0 ? result.records[0].get('s').properties : {};
}

const REMEDIES_CATALOG = [
  {
    id: 'remedy_neem_oil',
    name: 'Neem Oil Extract',
    type: 'Natural',
    description: 'Diluted organic neem oil spray (30-50ml per liter of water) targeting the undersides of leaves as an organic repellent and growth regulator.',
    keywords: ['mosaic', 'armyworm', 'mite', 'bunchy top', 'aphid', 'whitefly']
  },
  {
    id: 'remedy_copper_fungicide',
    name: 'Copper-based Fungicides',
    type: 'Chemical',
    description: 'Fungicidal spray made of copper sulfate and slaked lime (Bordeaux mixture) or copper hydroxide to prevent or treat fungal pathogens.',
    keywords: ['black pod', 'sigatoka', 'phytophthora']
  },
  {
    id: 'remedy_bt_spray',
    name: 'Bacillus thuringiensis (Bt)',
    type: 'Natural',
    description: 'Biological insecticidal spray containing natural Bt bacterial spores, highly effective against chewing caterpillar larvae.',
    keywords: ['caterpillar', 'armyworm']
  },
  {
    id: 'remedy_crop_rotation',
    name: 'Crop Rotation',
    type: 'Natural',
    description: 'Rotate susceptible crops with non-host crops (e.g. marigolds, cowpeas, sudangrass) to break pest reproduction cycles.',
    keywords: ['nematode', 'blast', 'cycle']
  },
  {
    id: 'remedy_soil_solarization',
    name: 'Soil Solarization',
    type: 'Natural',
    description: 'Cover moist soil with clear plastic sheets during hot months to heat-kill soilborne pathogens, weed seeds, and nematodes.',
    keywords: ['nematode', 'soil solarization']
  },
  {
    id: 'remedy_ash_chili',
    name: 'Ash and Chili Powder Whorl Mix',
    type: 'Natural',
    description: 'Traditional organic mix of wood ash and ground chili powder applied directly into maize/cereal whorls to deter chewing pests.',
    keywords: ['fall armyworm', 'whorl']
  },
  {
    id: 'remedy_emamectin',
    name: 'Emamectin benzoate / Chlorantraniliprole',
    type: 'Chemical',
    description: 'Targeted modern systemic insecticides applied directly to leaf whorls/surfaces for managing aggressive chewing pests.',
    keywords: ['fall armyworm', 'chlorantraniliprole', 'emamectin']
  },
  {
    id: 'remedy_pyrethroid',
    name: 'Lambda-cyhalothrin (Karate)',
    type: 'Chemical',
    description: 'Fast-acting synthetic pyrethroid contact insecticide for severe outbreaks of crawling caterpillars and armyworms.',
    keywords: ['armyworm', 'lambda-cyhalothrin', 'karate']
  },
  {
    id: 'remedy_blast_fungicide',
    name: 'Tricyclazole / Isoprothiolane Fungicides',
    type: 'Chemical',
    description: 'Systemic fungicides specific to Pyricularia oryzae (rice blast), applied at the first sign of leaf lesions to prevent neck blast.',
    keywords: ['blast', 'tricyclazole', 'isoprothiolane']
  },
  {
    id: 'remedy_mirid_insecticide',
    name: 'Imidacloprid / Alphacypermethrin',
    type: 'Chemical',
    description: 'Systemic neonicotinoids or contact pyrethroids targeted at leaf undersides to manage sucking capsid and mirid bugs.',
    keywords: ['mirid', 'pod borer', 'imidacloprid', 'alphacypermethrin']
  },
  {
    id: 'remedy_glyphosate_injection',
    name: 'Glyphosate Injection',
    type: 'Chemical',
    description: 'Stem injection of systemic herbicide to rapidly kill infected plants and prevent aphid vector dispersal.',
    keywords: ['bunchy top', 'glyphosate']
  },
  {
    id: 'remedy_traps',
    name: 'Pheromone and Pseudostem Traps',
    type: 'Natural',
    description: 'Trapping adults using species-specific pheromones (rhinoceros beetles) or split pseudostem traps placed face down.',
    keywords: ['rhinoceros beetle', 'weevil', 'trap']
  },
  {
    id: 'remedy_predatory_mites',
    name: 'Predatory Mites (Typhlodromalus aripo)',
    type: 'Natural',
    description: 'Biological control agent introduced to feed on and suppress cassava green mite populations on cassava shoot tips.',
    keywords: ['green mite', 'typhlodromalus', 'biocontrol']
  },
  {
    id: 'remedy_spacing_pruning',
    name: 'Plant Spacing & Canopy Pruning',
    type: 'Natural',
    description: 'Maintain proper crop spacing and prune canopy leaves to improve air circulation and reduce humidity (which deters fungal growth).',
    keywords: ['sigatoka', 'black pod', 'blast', 'spacing', 'prune']
  },
  {
    id: 'remedy_rogueing',
    name: 'Rogueing & Plant Destruction',
    type: 'Natural',
    description: 'Rogueing (uprooting) infected plants and destroying them (burning or burying deeply) to eradicate source inoculums.',
    keywords: ['mosaic', 'bunchy top', 'rogue']
  }
];

async function reconcileRelationships(session, activeFarmId) {
  try {
    // 1. Ensure Remedy catalog nodes are created and up to date
    for (const rem of REMEDIES_CATALOG) {
      await session.run(`
        MERGE (r:Remedy {id: $id})
        SET r.name = $name, r.type = $type, r.description = $description,
            r.keywords = $keywords, r.lastUpdatedBy = 'system-remedy-catalog'
      `, { id: rem.id, name: rem.name, type: rem.type, description: rem.description, keywords: JSON.stringify(rem.keywords) });
    }

    // 2. Link Remedy nodes to Pests matching keywords or names
    for (const rem of REMEDIES_CATALOG) {
      for (const kw of rem.keywords) {
        await session.run(`
          MATCH (r:Remedy {id: $remedyId})
          MATCH (p:Pest)
          WHERE toLower(p.name + " " + coalesce(p.description, "") + " " + coalesce(p.treatment, "")) CONTAINS $kw
          MERGE (r)-[rel:TREATS]->(p)
          SET rel.lastUpdatedBy = 'system-remedy-catalog'
        `, { remedyId: rem.id, kw: kw.toLowerCase() });
      }
    }

    // 3. Link Crops to Pests via AFFECTED_BY based on pestIds array or matching names
    await session.run(`
      MATCH (c:Crop)
      WHERE c.pestIds IS NOT NULL AND c.pestIds <> '' AND c.pestIds <> '[]'
      WITH c, split(replace(replace(replace(c.pestIds, '[', ''), ']', ''), '"', ''), ',') AS pIds
      UNWIND pIds AS rawPestId
      WITH c, trim(rawPestId) AS pestId
      WHERE pestId <> ''
      MATCH (p:Pest {id: pestId})
      MERGE (c)-[r:AFFECTED_BY]->(p)
      SET r.lastUpdatedBy = 'system-relationship-reconciler'
    `);

    // 4. Auto-link unlinked nodes to active farm
    if (activeFarmId) {
      await session.run(`
        MATCH (f:Farm {id: $activeFarmId})
        WITH f
        MATCH (n)
        WHERE NOT n:Farm AND NOT n:AdminBoundary AND NOT n:User AND NOT (n)-[:BELONGS_TO]->(:Farm)
        MERGE (n)-[:BELONGS_TO]->(f)
      `, { activeFarmId });
    }
  } catch (e) {
    console.warn('[Relationship Reconciler] Warning:', e.message);
  }
}

driver.verifyConnectivity()
  .then(async () => {
    console.info(`[Neo4j Database] Attempting connection to ${neo4jUri} with username: ${neo4jUser} and password: ${neo4jPassword}`);
    console.info('[Neo4j Database] Connection SUCCESSFUL.');
    
    const session = driver.session();
    try {
      // 0. Deduplicate any duplicate farm nodes (e.g. dev_farm)
      await session.run(`
        MATCH (f:Farm)
        WITH f.id AS farmId, collect(f) AS nodes
        WHERE farmId IS NOT NULL AND size(nodes) > 1
        WITH farmId, nodes[0] AS keep, nodes[1..] AS dupes
        UNWIND dupes AS d
        OPTIONAL MATCH (n)-[r:BELONGS_TO]->(d)
        FOREACH (x IN CASE WHEN n IS NOT NULL THEN [1] ELSE [] END |
          MERGE (n)-[:BELONGS_TO]->(keep)
        )
        DETACH DELETE d
      `);

      // 1. Ensure default farm and dev farm nodes exist
      await session.run(`
        MERGE (f:Farm {id: 'default_farm'})
        ON CREATE SET f.name = 'NMK Farm'
        MERGE (df:Farm {id: 'dev_farm'})
        ON CREATE SET df.name = 'DEV FARM'
      `);
      
      // 2. Link all existing nodes to default_farm if they are not already linked to any Farm
      await session.run(`
        MATCH (n)
        WHERE NOT n:Farm
          AND NOT (n)-[:BELONGS_TO]->(:Farm)
        MATCH (f:Farm {id: 'default_farm'})
        MERGE (n)-[:BELONGS_TO]->(f)
      `);
      
      // 3. Delete legacy 'default' settings nodes and ensure canonical settings_<farmId> node exists for each farm
      await session.run(`
        MATCH (s:GlobalSettings) WHERE s.id = 'default' DETACH DELETE s
      `);

      await session.run(`
        MATCH (f:Farm)
        MERGE (s:GlobalSettings {id: 'settings_' + f.id})
        MERGE (s)-[:BELONGS_TO]->(f)
        WITH f, s
        WHERE s.appName IS NULL OR s.appName = ''
        SET s.appName = f.name
      `);

      const indexLabels = [
        { label: 'User', prop: 'email' },
        { label: 'Farm', prop: 'id' },
        { label: 'Field', prop: 'id' },
        { label: 'NurseryBed', prop: 'id' },
        { label: 'Crop', prop: 'id' },
        { label: 'Livestock', prop: 'id' },
        { label: 'BreedingEvent', prop: 'id' },
        { label: 'LivestockKit', prop: 'id' },
        { label: 'Harvest', prop: 'id' },
        { label: 'PointOfInterest', prop: 'id' },
        { label: 'Recommendation', prop: 'id' },
        { label: 'Transaction', prop: 'id' },
        { label: 'Activity', prop: 'id' },
        { label: 'Budget', prop: 'id' },
        { label: 'BudgetItem', prop: 'id' },
        { label: 'TaskAssignment', prop: 'id' },
        { label: 'Incident', prop: 'id' },
        { label: 'Deadline', prop: 'id' },
        { label: 'Employee', prop: 'id' },
        { label: 'Pest', prop: 'id' },
        { label: 'SoilTest', prop: 'id' },
        { label: 'Goal', prop: 'id' },
        { label: 'Objective', prop: 'id' },
        { label: 'GpsLog', prop: 'id' }
      ];

      for (const item of indexLabels) {
        try {
          await session.run(`CREATE INDEX IF NOT EXISTS FOR (n:${item.label}) ON (n.${item.prop})`);
        } catch (e) {
          console.warn(`[Neo4j Database] Index creation skipped for ${item.label}.${item.prop}:`, e.message);
        }
      }
      
      await reconcileRelationships(session, 'default_farm');
      console.info('[Neo4j Database] Bootstrapping completed successfully.');
    } catch (err) {
      console.error('[Neo4j Database] Bootstrapping failed:', err);
    } finally {
      await session.close();
    }
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

// Farm management endpoints
app.get('/api/farms', async (req, res) => {
  const { email } = req.query;
  const session = driver.session();
  try {
    // Ensure DEV FARM exists
    await session.run(`
      MERGE (df:Farm {id: 'dev_farm'})
      ON CREATE SET df.name = 'DEV FARM'
    `);

    let query = 'MATCH (f:Farm) RETURN f, "Admin" as role ORDER BY f.name ASC';
    let params = {};
    if (email && email !== 'vkarmo@gmail.com') {
      query = `
        MATCH (u:User {email: $email})-[r:BELONGS_TO]->(f:Farm)
        RETURN f, coalesce(r.role, u.role, "Staff") as role
        UNION
        MATCH (df:Farm {id: 'dev_farm'})
        RETURN df as f, "Admin" as role
        ORDER BY f.name ASC
      `;
      params = { email };
    }
    const result = await session.run(query, params);
    const farmsMap = new Map();
    result.records.forEach(r => {
      const fProps = r.get('f').properties;
      const role = r.get('role');
      if (fProps && fProps.id && !farmsMap.has(fProps.id)) {
        farmsMap.set(fProps.id, { ...fProps, role });
      }
    });
    const farms = Array.from(farmsMap.values());
    res.json(farms);
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    await session.close();
  }
});

app.post('/api/farms', async (req, res) => {
  const { name, userEmail } = req.body;
  if (userEmail !== 'vkarmo@gmail.com') {
    return res.status(403).json({ error: 'Forbidden. Only the super admin can create new farms.' });
  }
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Farm name is required.' });
  }
  const session = driver.session();
  try {
    const farmId = 'farm_' + Date.now();
    await session.run(`
      MERGE (f:Farm {id: $farmId})
      ON CREATE SET f.name = $name
      MERGE (s:GlobalSettings {id: $settingsId})
      MERGE (s)-[:BELONGS_TO]->(f)
      ON CREATE SET s.appName = $name
    `, { farmId, name: name.trim(), settingsId: 'settings_' + farmId });
    res.json({ success: true, farm: { id: farmId, name: name.trim() } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    await session.close();
  }
});
app.post('/api/farms/dev-farm/reset-from-source', async (req, res) => {
  const { sourceFarmId } = req.body;
  if (!sourceFarmId || sourceFarmId === 'dev_farm') {
    return res.status(400).json({ error: 'Please select a valid source farm to seed from.' });
  }

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Transfer-Encoding', 'chunked');

  const sendProgress = (percent, text, extra = {}) => {
    try {
      res.write(JSON.stringify({ percent, text, ...extra }) + '\n');
    } catch (e) {}
  };

  const session = driver.session();
  try {
    sendProgress(5, 'Verifying source farm data...');

    // 1. Verify source farm exists
    const sourceRes = await session.run('MATCH (f:Farm {id: $sourceFarmId}) RETURN f', { sourceFarmId });
    if (sourceRes.records.length === 0) {
      sendProgress(0, 'Source farm not found', { error: 'Source farm not found.', success: false });
      return res.end();
    }
    const sourceFarmName = sourceRes.records[0].get('f').properties.name || sourceFarmId;

    sendProgress(12, 'Initializing DEV FARM target workspace...');
    // 2. Ensure dev_farm node and settings node exist
    await session.run(`
      MERGE (df:Farm {id: 'dev_farm'})
      ON CREATE SET df.name = 'DEV FARM'
      MERGE (ds:GlobalSettings {id: 'settings_dev_farm'})
      MERGE (ds)-[:BELONGS_TO]->(df)
    `);

    sendProgress(20, 'Clearing existing DEV FARM records & contract days...');
    // 3. Delete all non-Farm nodes currently linked to dev_farm
    await session.run(`
      MATCH (n)-[r:BELONGS_TO]->(df:Farm {id: 'dev_farm'})
      WHERE NOT n:Farm
      OPTIONAL MATCH (n)<-[:FOR_PAYROLL]-(cd:ContractDay)
      DETACH DELETE cd, n
    `);

    sendProgress(28, `Cloning global settings configuration from ${sourceFarmName}...`);
    // 3b. Fetch canonical GlobalSettings node properties linked to sourceFarmId and clone onto settings_dev_farm
    let sourceSettingsRes = await session.run(`
      MATCH (s:GlobalSettings {id: 'settings_' + $sourceFarmId})-[:BELONGS_TO]->(f:Farm {id: $sourceFarmId})
      RETURN properties(s) AS props
    `, { sourceFarmId });

    if (sourceSettingsRes.records.length === 0) {
      sourceSettingsRes = await session.run(`
        MATCH (s:GlobalSettings)-[:BELONGS_TO]->(f:Farm {id: $sourceFarmId})
        RETURN properties(s) AS props LIMIT 1
      `, { sourceFarmId });
    }

    let sourceSettingsProps = {};
    if (sourceSettingsRes.records.length > 0) {
      sourceSettingsProps = sourceSettingsRes.records[0].get('props') || {};
    }
    delete sourceSettingsProps.id;
    delete sourceSettingsProps._id;

    // Format app name setting and farm name with " (DEV)" (space before left parenthesis)
    const rawAppName = (sourceSettingsProps.appName || sourceFarmName || 'Farm Tracker').replace(/\s*\(DEV\)\s*$/i, '').trim();
    const devAppName = `${rawAppName} (DEV)`;
    const cleanSourceFarmName = sourceFarmName.replace(/\s*\(DEV\)\s*$/i, '').trim();
    const devFarmName = `${cleanSourceFarmName} (DEV)`;

    const clonedSettingsProps = {
      ...sourceSettingsProps,
      appName: devAppName,
      id: 'settings_dev_farm',
      lastUpdatedBy: 'system-dev-farm-reset'
    };

    await session.run(`
      MERGE (df:Farm {id: 'dev_farm'})
      SET df.name = $devFarmName
      MERGE (ds:GlobalSettings {id: 'settings_dev_farm'})
      MERGE (ds)-[:BELONGS_TO]->(df)
      SET ds = $clonedSettingsProps
    `, { devFarmName, clonedSettingsProps });

    sendProgress(35, 'Querying source farm entity nodes and graph labels...');
    // 4. Query all nodes belonging to sourceFarmId
    const sourceNodesRes = await session.run(`
      MATCH (n)-[:BELONGS_TO]->(f:Farm {id: $sourceFarmId})
      WHERE NOT n:Farm
      RETURN n, labels(n) AS labels
    `, { sourceFarmId });

    const idMap = new Map(); // oldId -> newId
    const totalNodes = sourceNodesRes.records.length;

    sendProgress(40, `Cloning ${totalNodes} source farm entity nodes via parallel batch processing...`);

    // Group nodes by label combination for bulk UNWIND parallel creation
    const nodesByLabel = new Map();

    for (const record of sourceNodesRes.records) {
      const oldNode = record.get('n');
      const labels = record.get('labels') || [];
      const props = { ...oldNode.properties };
      const oldId = props.id;

      if (labels.includes('GlobalSettings')) {
        if (oldId) idMap.set(oldId, 'settings_dev_farm');
        continue;
      }

      if (!oldId) continue;

      const newId = `${oldId}_dev_${Math.random().toString(36).substr(2, 6)}`;
      idMap.set(oldId, newId);

      const clonedProps = { ...props, id: newId, lastUpdatedBy: 'system-dev-farm-reset' };
      const labelString = labels.join(':');
      if (!nodesByLabel.has(labelString)) {
        nodesByLabel.set(labelString, []);
      }
      nodesByLabel.get(labelString).push(clonedProps);
    }

    let processedCount = 0;
    const labelEntries = Array.from(nodesByLabel.entries());

    await Promise.all(labelEntries.map(async ([labelString, items]) => {
      const workerSession = driver.session();
      try {
        const batchSize = 100;
        for (let i = 0; i < items.length; i += batchSize) {
          const chunk = items.slice(i, i + batchSize);
          await workerSession.run(`
            MATCH (df:Farm {id: 'dev_farm'})
            UNWIND $chunk AS item
            CREATE (n:${labelString})
            SET n = item
            CREATE (n)-[:BELONGS_TO]->(df)
          `, { chunk });

          processedCount += chunk.length;
          const pct = Math.min(68, Math.floor(40 + (processedCount / (totalNodes || 1)) * 28));
          const cleanLabel = labelString.replace(/GlobalSettings|Farm/g, '').replace(/^:|:$/g, '') || 'Entity';
          sendProgress(pct, `Cloning ${cleanLabel} nodes (${processedCount}/${totalNodes})...`);
        }
      } finally {
        await workerSession.close();
      }
    }));

    sendProgress(70, 'Cloning intra-farm graph relationships via bulk parallel queries...');

    // 6. Bulk query all intra-farm relationships for source farm in a single query
    const allRelsRes = await session.run(`
      MATCH (sf:Farm {id: $sourceFarmId})
      MATCH (src)-[r]->(tgt)
      WHERE (src)-[:BELONGS_TO]->(sf)
        AND (tgt)-[:BELONGS_TO]->(sf)
        AND type(r) <> 'BELONGS_TO'
      RETURN src.id AS srcId, type(r) AS relType, tgt.id AS tgtId, properties(r) AS relProps
    `, { sourceFarmId });

    const relsByType = new Map();
    for (const record of allRelsRes.records) {
      const srcId = record.get('srcId');
      const tgtId = record.get('tgtId');
      const relType = record.get('relType');
      const relProps = record.get('relProps') || {};

      const newSrcId = idMap.get(srcId);
      const newTgtId = idMap.get(tgtId);

      if (newSrcId && newTgtId) {
        const safeType = /^[A-Z0-9_]+$/i.test(relType) ? relType : 'RELATED_TO';
        if (!relsByType.has(safeType)) {
          relsByType.set(safeType, []);
        }
        relsByType.get(safeType).push({ newSrcId, newTgtId, relProps });
      }
    }

    const relEntries = Array.from(relsByType.entries());
    let relsProcessed = 0;
    const totalRels = allRelsRes.records.length;

    for (const [relType, items] of relEntries) {
      const batchSize = 200;
      for (let i = 0; i < items.length; i += batchSize) {
        const chunk = items.slice(i, i + batchSize);
        await session.run(`
          UNWIND $chunk AS item
          MATCH (src {id: item.newSrcId})
          MATCH (tgt {id: item.newTgtId})
          MERGE (src)-[r:${relType}]->(tgt)
          SET r += item.relProps
        `, { chunk });

        relsProcessed += chunk.length;
        const pct = Math.min(82, Math.floor(70 + (relsProcessed / (totalRels || 1)) * 12));
        sendProgress(pct, `Cloning ${relType} graph relationships (${relsProcessed}/${totalRels})...`);
      }
    }

    sendProgress(84, 'Updating foreign key references across cloned nodes in parallel...');

    // 7. Bulk update foreign key string properties (e.g. fieldId, motherId, fatherId, cropId, goalId)
    const fkUpdates = [];
    const fkKeys = ['fieldId', 'motherId', 'fatherId', 'cropId', 'goalId', 'parentGoalId', 'equipmentId', 'assetId', 'targetId', 'budgetId'];

    for (const record of sourceNodesRes.records) {
      const oldNode = record.get('n');
      const oldProps = oldNode.properties || {};
      const oldId = oldProps.id;
      const newId = idMap.get(oldId);

      if (newId && newId !== 'settings_dev_farm') {
        const updates = {};
        fkKeys.forEach(fk => {
          if (oldProps[fk] && idMap.has(oldProps[fk])) {
            updates[fk] = idMap.get(oldProps[fk]);
          }
        });
        if (Object.keys(updates).length > 0) {
          fkUpdates.push({ nodeId: newId, updates });
        }
      }
    }

    if (fkUpdates.length > 0) {
      const batchSize = 100;
      for (let i = 0; i < fkUpdates.length; i += batchSize) {
        const chunk = fkUpdates.slice(i, i + batchSize);
        await session.run(`
          UNWIND $chunk AS item
          MATCH (n {id: item.nodeId})
          SET n += item.updates
        `, { chunk });
      }
    }

    sendProgress(94, 'Reconciling pest, crop, and remedy matrix links...');
    // 8. Reconcile relationships for dev_farm
    await reconcileRelationships(session, 'dev_farm');

    sendProgress(100, `DEV FARM successfully reset and seeded from ${sourceFarmName}!`, {
      success: true,
      message: `DEV FARM data successfully reset and seeded from ${sourceFarmName}.`
    });
    res.end();
  } catch (err) {
    console.error('Failed to reset DEV FARM data from source:', err);
    sendProgress(0, 'Cloning failed', { success: false, error: err.message || 'Failed to reset DEV FARM data.' });
    res.end();
  } finally {
    await session.close();
  }
});
app.get('/api/farms/:farmId/summary', async (req, res) => {
  const { farmId } = req.params;
  const { email } = req.query;
  if (email !== 'vkarmo@gmail.com') {
    return res.status(403).json({ error: 'Forbidden. Only the super admin can view farm summaries.' });
  }
  const session = driver.session();
  try {
    const result = await session.run(`
      MATCH (n)-[:BELONGS_TO]->(f:Farm {id: $farmId})
      RETURN labels(n) as labels, count(n) as count
    `, { farmId });
    const summary = result.records.map(r => ({
      labels: r.get('labels'),
      count: r.get('count')
    }));
    res.json({ success: true, summary });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    await session.close();
  }
});

app.delete('/api/farms/:farmId', async (req, res) => {
  const { farmId } = req.params;
  const { email } = req.query;
  if (email !== 'vkarmo@gmail.com') {
    return res.status(403).json({ error: 'Forbidden. Only the super admin can delete farms.' });
  }
  if (farmId === 'default_farm') {
    return res.status(400).json({ error: 'System Block: The default NMK Farm dataset cannot be deleted.' });
  }
  const session = driver.session();
  try {
    // Delete BudgetItem child nodes, all nodes belonging to the farm, and the Farm node itself.
    await session.run(`
      MATCH (f:Farm {id: $farmId})
      OPTIONAL MATCH (n)-[:BELONGS_TO]->(f)
      OPTIONAL MATCH (n)-[:CONTAINS]->(bi:BudgetItem)
      DETACH DELETE bi, n, f
    `, { farmId });
    res.json({ success: true, message: `Farm dataset ${farmId} and all associated telemetry deleted successfully.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    await session.close();
  }
});

app.get('/api/users/check', async (req, res) => {
  const { email } = req.query;
  if (!email) {
    return res.status(400).json({ error: 'Email is required.' });
  }
  const cleanEmail = email.toLowerCase().trim();
  const session = driver.session();
  try {
    const result = await session.run(`
      MATCH (u:User {email: $email})-[:BELONGS_TO]->(:Farm)
      RETURN u LIMIT 1
    `, { email: cleanEmail });
    if (result.records.length > 0) {
      const userNode = result.records[0].get('u');
      res.json({ whitelisted: true, user: userNode.properties });
    } else {
      res.json({ whitelisted: false });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to check user whitelist status.' });
  } finally {
    await session.close();
  }
});

app.get('/api/users', async (req, res) => {
  const { farmId } = req.query;
  const fId = farmId || 'default_farm';
  const session = driver.session();
  try {
    const result = await session.run(`
      MATCH (u:User)-[r:BELONGS_TO]->(f:Farm {id: $fId})
      RETURN u, r.role as role, r.allowedTabs as allowedTabs, r.canApprove as canApprove
    `, { fId });
    
    const users = result.records.map(record => {
      const props = { ...record.get('u').properties };
      const role = record.get('role');
      const allowedTabs = record.get('allowedTabs');
      const canApprove = record.get('canApprove');

      props.role = role || props.role || 'Staff';
      if (allowedTabs !== undefined) props.allowedTabs = allowedTabs;
      if (canApprove !== undefined) props.canApprove = canApprove;

      if (props.allowedTabs) {
        if (typeof props.allowedTabs === 'string') {
          try { props.allowedTabs = JSON.parse(props.allowedTabs); } catch(e){}
        }
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

// LISGIS Waterways API Endpoint
app.get('/api/lisgis/waterways', (req, res) => {
  res.json({
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {
          name: "Mahe Creek Branch",
          source: "LISGIS Waterways (2024)",
          county: "Bomi",
          flow_direction: "NE-to-SW"
        },
        geometry: {
          type: "LineString",
          coordinates: [
            [-10.8695, 6.7366],
            [-10.8695, 6.7353],
            [-10.8695, 6.7338],
            [-10.8704, 6.7328],
            [-10.8704, 6.7313],
            [-10.8709, 6.7298],
            [-10.8713, 6.7290]
          ]
        }
      },
      {
        type: "Feature",
        properties: {
          name: "NW Tributary",
          source: "LISGIS Waterways (2024)",
          county: "Bomi",
          flow_direction: "SW-to-NE"
        },
        geometry: {
          type: "LineString",
          coordinates: [
            [-10.8741, 6.7290],
            [-10.8754, 6.7313],
            [-10.8723, 6.7323],
            [-10.8704, 6.7328]
          ]
        }
      },
      {
        type: "Feature",
        properties: {
          name: "SE Tributary",
          source: "LISGIS Waterways (2024)",
          county: "Bomi",
          flow_direction: "NW-to-SE"
        },
        geometry: {
          type: "LineString",
          coordinates: [
            [-10.8704, 6.7313],
            [-10.8659, 6.7293],
            [-10.8640, 6.7295]
          ]
        }
      }
    ]
  });
});

// Get all fields
app.get('/api/fields', async (req, res) => {
  const session = driver.session();
  try {
    const result = await session.run('MATCH (f:Field) RETURN f');
    const fields = result.records.map(r => r.get('f').properties);

    // Also fetch admin boundaries to expose them as virtual fields
    let virtualFields = [];
    try {
      const boundariesResult = await session.run('MATCH (b:AdminBoundary) RETURN b');
      virtualFields = boundariesResult.records.map(record => {
        const b = record.get('b').properties;
        let geojson = {};
        try {
          geojson = JSON.parse(b.geojson);
        } catch (e) {}
        
        let polygonCoords = [];
        if (geojson.geometry) {
          const type = geojson.geometry.type;
          const coords = geojson.geometry.coordinates;
          if (type === 'Polygon' && Array.isArray(coords) && coords.length > 0) {
            polygonCoords = coords[0].map(pt => [pt[1], pt[0]]);
          } else if (type === 'MultiPolygon' && Array.isArray(coords) && coords.length > 0) {
            polygonCoords = coords[0][0].map(pt => [pt[1], pt[0]]);
          }
        }
        
        return {
          id: b.id,
          name: `${b.level === 1 ? 'County' : 'District'}: ${b.name || 'Unnamed Boundary'}`,
          area: 500,
          soil_type: 'Clay Loam (Admin Boundary)',
          irrigation: 'Rainfed',
          status: 'Active',
          year: 2026,
          polygon: JSON.stringify(polygonCoords),
          isVirtual: true,
          adminLevel: b.level
        };
      });
    } catch (e) {
      console.warn('Failed to load boundaries for fields:', e.message);
    }

    res.json([...fields, ...virtualFields]);
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
      'MERGE (f:Field {id: $id}) SET f.name = $name, f.area = $area, f.soil_type = $soil_type, f.irrigation = $irrigation, f.status = $status, f.year = $year, f.polygon = $polygon RETURN f', { userEmail, id, name, area, soil_type, irrigation, status, year, polygon }
    );
    const field = result.records[0].get('f').properties;
    res.json(field);
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    await session.close();
  }
});

// Neo4j Connection Test endpoint
app.post('/api/neo4j/test-connection', async (req, res) => {
  const { uri, username, password, database } = req.body;
  if (!uri || !username) {
    return res.status(400).json({ success: false, error: 'Missing Neo4j URI or Username.' });
  }
  
  let testUri = uri;
  if (testUri.includes('.databases.neo4j.io') && testUri.startsWith('bolt+s://')) {
    testUri = testUri.replace('bolt+s://', 'neo4j+s://');
  }

  const testDriver = neo4j.driver(testUri, neo4j.auth.basic(username, password));
  try {
    const session = testDriver.session({ database: database || undefined });
    await session.run('RETURN 1 AS val');
    await session.close();
    res.json({ success: true });
  } catch (err) {
    console.error('Neo4j connection test failed:', err);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    await testDriver.close();
  }
});

// Retrieve server Neo4j credentials
app.get('/api/neo4j/server-credentials', async (req, res) => {
  let version = '5.27-aura';
  try {
    const session = driver.session();
    const result = await session.run('CALL dbms.components() YIELD versions RETURN versions[0] AS version');
    if (result.records.length > 0) {
      version = result.records[0].get('version');
    }
    await session.close();
  } catch (err) {
    console.error('Failed to retrieve Neo4j version:', err);
  }

  res.json({
    uri: process.env.NEO4J_URI || 'bolt://localhost:7687',
    username: process.env.NEO4J_USER || 'neo4j',
    password: process.env.NEO4J_PASSWORD || 'password',
    database: process.env.NEO4J_DATABASE || '',
    version: version
  });
});

// GEE Connection Test endpoint
app.post('/api/gee/test-connection', async (req, res) => {
  const session = driver.session();
  try {
    const { client_email, private_key, project_id, polygon, farmId, email } = req.body;
    if (email && !(await checkFarmAccess(session, email, farmId))) {
      return res.status(403).json({ error: 'Forbidden. You do not have access to this farm.' });
    }
    
    let creds = { client_email, private_key, project_id };
    
    if (!creds.client_email || !creds.private_key || !creds.project_id) {
      const props = await getSettingsNode(session, farmId);
      creds = {
        client_email: props.geeClientEmail || creds.client_email,
        private_key: props.geePrivateKey || creds.private_key,
        project_id: props.geeProjectId || creds.project_id
      };
    }
    
    if (!creds.client_email || !creds.private_key || !creds.project_id) {
      return res.status(400).json({ success: false, error: 'Credentials are not fully specified.' });
    }
    
    const perfectPrivateKey = creds.private_key;
    
    console.info('[GEE Connection Test] Verifying credentials for service account:', creds.client_email);
    
    const verificationResult = await new Promise((resolve, reject) => {
      ee.data.authenticateViaPrivateKey(
        {
          client_email: creds.client_email,
          private_key: perfectPrivateKey
        },
        () => {
          ee.initialize(
            null,
            creds.project_id,
            () => {
              try {
                let s2Collection = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED');
                if (polygon) {
                  let sanitizedPolygon = polygon;
                  if (Array.isArray(polygon) && polygon.length > 0 && Array.isArray(polygon[0]) && Array.isArray(polygon[0][0])) {
                    sanitizedPolygon = polygon[0];
                  }
                  if (Array.isArray(sanitizedPolygon) && sanitizedPolygon.length >= 3) {
                    const coords = sanitizedPolygon.map(pt => [pt[1], pt[0]]);
                    if (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1]) {
                      coords.push(coords[0]);
                    }
                    const geometry = ee.Geometry.Polygon([coords]);
                    s2Collection = s2Collection.filterBounds(geometry);
                  }
                }
                s2Collection.limit(1).size().evaluate((size, err) => {
                  if (err) {
                    console.warn('[GEE Connection Test] Sentinel-2 access warning:', err.message || err);
                    resolve({
                      success: true,
                      s2Accessible: false,
                      message: 'Successfully authenticated with Google Earth Engine! However, access to the public Sentinel-2 collection ("COPERNICUS/S2_SR_HARMONIZED") was denied. Visual satellite and index layers will fall back to local canvas simulations.'
                    });
                  } else {
                    resolve({
                      success: true,
                      s2Accessible: true,
                      message: 'Successfully authenticated with Google Earth Engine! Sentinel-2 collection is fully authorized and accessible.'
                    });
                  }
                });
              } catch (ex) {
                reject(ex);
              }
            },
            (err) => {
              reject(new Error(`Earth Engine initialization failed: ${err.message || err}`));
            }
          );
        },
        (err) => {
          reject(new Error(`Earth Engine authentication failed: ${err.message || err}`));
        }
      );
    });
    
    res.json(verificationResult);
    
  } catch (err) {
    console.error('[GEE Connection Test] Failed:', err);
    res.status(500).json({ success: false, error: err.message || 'Connection test failed.' });
  } finally {
    await session.close();
  }
});

// MTN SMS Connection Test endpoint
app.post('/api/sms/test', async (req, res) => {
  const session = driver.session();
  try {
    const { clientId, clientSecret, phoneNumber, message, environment, farmId, email } = req.body;
    
    const isNmkFarm = farmId === 'default_farm';
    const isSuperAdmin = email === 'vkarmo@gmail.com';
    if (!isNmkFarm && !isSuperAdmin) {
      return res.status(403).json({ error: 'Forbidden. SMS messaging is only available for NMK Farm or the super admin.' });
    }

    if (email && !(await checkFarmAccess(session, email, farmId))) {
      return res.status(403).json({ error: 'Forbidden. You do not have access to this farm.' });
    }
    
    let creds = { clientId, clientSecret, environment };
    
    if (!creds.clientId || !creds.clientSecret || !creds.environment) {
      const props = await getSettingsNode(session, farmId);
      creds = {
        clientId: props.mtnClientId || creds.clientId,
        clientSecret: props.mtnClientSecret || creds.clientSecret,
        environment: props.mtnEnvironment || creds.environment
      };
    }
    
    if (!creds.clientId || !creds.clientSecret) {
      return res.status(400).json({ success: false, error: 'MTN SMS Client ID and Client Secret are not specified.' });
    }
    
    if (!phoneNumber || (Array.isArray(phoneNumber) && phoneNumber.length === 0)) {
      return res.status(400).json({ success: false, error: 'Recipient phone number is required.' });
    }
    
    if (!message) {
      return res.status(400).json({ success: false, error: 'Message content is required.' });
    }

    const env = (creds.environment || 'sandbox').toLowerCase() === 'production' ? 'production' : 'sandbox';
    const baseUrl = env === 'production' ? 'https://api.mtn.com' : 'https://sandbox.api.mtn.com';

    console.info(`[MTN SMS Test] Authenticating for clientId: ${creds.clientId} [Env: ${env}]`);
    
    // Step 1: OAuth Token exchange
    const authUrl = `${baseUrl}/v1/oauth/access_token/accesstoken?grant_type=client_credentials`;
    const authBody = `client_id=${encodeURIComponent(creds.clientId)}&client_secret=${encodeURIComponent(creds.clientSecret)}&scope=SEND-SMS`;
    const basicAuth = 'Basic ' + Buffer.from(`${creds.clientId}:${creds.clientSecret}`).toString('base64');
    
    const authRes = await makeHttpsRequest(authUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': basicAuth,
        'Content-Length': Buffer.byteLength(authBody)
      }
    }, authBody);

    if (authRes.statusCode !== 200) {
      console.error('[MTN SMS Test] Authentication failed status:', authRes.statusCode, 'body:', authRes.body);
      let errorDetail = 'OAuth exchange failed.';
      try {
        const parsed = JSON.parse(authRes.body);
        if (parsed.message) errorDetail = parsed.message;
        else if (parsed.error_description) errorDetail = parsed.error_description;
      } catch (e) {
        if (authRes.body) errorDetail = authRes.body.substring(0, 100);
      }
      return res.status(authRes.statusCode || 500).json({ success: false, error: `Authentication failed: ${errorDetail}` });
    }

    let tokenData;
    try {
      tokenData = JSON.parse(authRes.body);
    } catch (e) {
      return res.status(500).json({ success: false, error: 'Failed to parse OAuth response from MTN.' });
    }

    const accessToken = tokenData.access_token;
    if (!accessToken) {
      return res.status(500).json({ success: false, error: 'OAuth response did not contain an access_token.' });
    }

    // Step 2: Send SMS
    const sendUrl = `${baseUrl}/v3/messages/sms/outbound`;
    const sendBody = JSON.stringify({
      senderAddress: 'FarmTracker',
      receiverAddress: Array.isArray(phoneNumber) ? phoneNumber : [phoneNumber],
      message: message,
      clientCorrelatorId: `ft-${Date.now()}`
    });

    console.info('[MTN SMS Test] Sending message to:', Array.isArray(phoneNumber) ? phoneNumber.join(', ') : phoneNumber);
    const sendRes = await makeHttpsRequest(sendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'Content-Length': Buffer.byteLength(sendBody)
      }
    }, sendBody);

    if (sendRes.statusCode >= 200 && sendRes.statusCode < 300) {
      return res.json({ success: true, message: 'Test message sent successfully!' });
    } else if (sendRes.statusCode === 418) {
      console.info('[MTN SMS Test] Connection succeeded but hit the Apigee mock target (418 Teapot).');
      if (env === 'production') {
        return res.status(418).json({
          success: false,
          error: 'Connection hit the sandbox mock target (418 Teapot). Your MTN developer credentials successfully authenticated, but they are not yet approved/provisioned for live production routing by MTN administrators.'
        });
      }
      return res.json({
        success: true,
        message: 'Successfully connected and authenticated with MTN gateway! Note: The gateway returned a mock response (418 I\'m a teapot), which indicates your MTN developer account is currently routed to the sandbox mock target.'
      });
    } else {
      console.error('[MTN SMS Test] Send SMS failed status:', sendRes.statusCode, 'body:', sendRes.body);
      let errorDetail = 'Message send request failed.';
      try {
        const parsed = JSON.parse(sendRes.body);
        if (parsed.message) errorDetail = parsed.message;
        else if (parsed.description) errorDetail = parsed.description;
      } catch (e) {
        if (sendRes.body) errorDetail = sendRes.body.substring(0, 100);
      }
      return res.status(sendRes.statusCode || 500).json({ success: false, error: `Failed to send SMS: ${errorDetail}` });
    }

  } catch (err) {
    console.error('[MTN SMS Test] Failed:', err);
    res.status(500).json({ success: false, error: err.message || 'Test SMS request failed.' });
  } finally {
    await session.close();
  }
});

function getSimulatedWeather(polygon, dateOffset) {
  const offset = Number(dateOffset) || 0;
  const dayOfYear = Math.floor((new Date('2026-05-28T12:00:00-04:00').getTime() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000) + offset;
  
  // Simple sinusoidal temp wave peaking in July (day 180)
  const baseTemp = 18 + 12 * Math.cos(((dayOfYear - 180) / 182.5) * Math.PI);
  // Add some day-to-day noise
  const seed = Math.sin(dayOfYear * 123.456);
  const tempNoise = (seed - Math.floor(seed)) * 6 - 3;
  const tempC = baseTemp + tempNoise;
  
  // Clouds and precip simulation
  const cloudSeed = Math.cos(dayOfYear * 33.3);
  const clouds = Math.max(0, Math.min(100, (cloudSeed - Math.floor(cloudSeed)) * 100));
  
  let precip = 0.0;
  if (clouds > 75) {
    const rainSeed = Math.sin(dayOfYear * 99.9);
    precip = Math.max(0.0, parseFloat(((rainSeed - Math.floor(rainSeed)) * 8).toFixed(2)));
  }
  
  // Wind speed
  const windSeed = Math.sin(dayOfYear * 45.6);
  const windSpeed = Math.max(1.0, parseFloat(((windSeed - Math.floor(windSeed)) * 12).toFixed(1)));
  
  // Humidity
  const humidity = Math.min(100, Math.max(20, 100 - (tempC * 1.5) + (clouds * 0.3)));
  
  const targetDate = new Date(new Date('2026-05-28T12:00:00-04:00').getTime() + offset * 24 * 60 * 60 * 1000);
  
  return {
    isSimulated: true,
    temperature: parseFloat(tempC.toFixed(1)),
    precipitation: precip,
    windSpeed: windSpeed,
    humidity: parseFloat(humidity.toFixed(1)),
    clouds: parseFloat(clouds.toFixed(1)),
    forecastTime: targetDate.toISOString(),
    duration: '3 hours',
    dateStr: targetDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  };
}

// GEE Weather data endpoint
app.post('/api/gee/weather', async (req, res) => {
  const session = driver.session();
  try {
    const { polygon, dateOffset, farmId, email } = req.body;
    if (email && !(await checkFarmAccess(session, email, farmId))) {
      return res.status(403).json({ error: 'Forbidden. You do not have access to this farm.' });
    }
    
    // 1. Fetch credentials from settings
    const settingsNode = await getSettingsNode(session, farmId);
    let perfectPrivateKey = (settingsNode.geePrivateKey || '').replace(/\\n/g, '\n');
    const creds = {
      client_email: settingsNode.geeClientEmail || '',
      private_key: perfectPrivateKey,
      project_id: settingsNode.geeProjectId || ''
    };
    
    if (!creds.client_email || !creds.private_key || !creds.project_id) {
      return res.json(getSimulatedWeather(polygon, dateOffset));
    }
    
    // 2. Initialize Earth Engine
    await initializeGee(creds);
    
    // 3. Format polygon coordinates for Earth Engine (Leaflet uses [lat, lng], GEE uses [lng, lat])
    let sanitizedPolygon = polygon;
    if (Array.isArray(polygon) && polygon.length > 0 && Array.isArray(polygon[0]) && Array.isArray(polygon[0][0])) {
      sanitizedPolygon = polygon[0];
    }
    if (!Array.isArray(sanitizedPolygon) || sanitizedPolygon.length < 3) {
      // Use map center as default location
      const mapCenter = settingsNode.mapCenter ? JSON.parse(settingsNode.mapCenter) : [51.505, -0.09];
      sanitizedPolygon = [
        [mapCenter[0] - 0.001, mapCenter[1] - 0.001],
        [mapCenter[0] + 0.001, mapCenter[1] - 0.001],
        [mapCenter[0] + 0.001, mapCenter[1] + 0.001],
        [mapCenter[0] - 0.001, mapCenter[1] + 0.001]
      ];
    }
    const coords = sanitizedPolygon.map(pt => [pt[1], pt[0]]);
    if (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1]) {
      coords.push(coords[0]);
    }
    const geometry = ee.Geometry.Polygon([coords]);
    const centroid = geometry.centroid(1);
    
    // 4. Calculate Date Window (60-day window centered on the target date)
    const baseDate = new Date('2026-05-28T12:00:00-04:00');
    const hash = 42; // Seed hash
    const daysAgo = (hash % 20) + 3 - (Number(dateOffset) || 0);
    const targetDate = new Date(baseDate.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    
    const start = new Date(targetDate.getTime() - 15 * 24 * 60 * 60 * 1000);
    const end = new Date(targetDate.getTime() + 15 * 24 * 60 * 60 * 1000);
    
    const startDateStr = start.toISOString().split('T')[0];
    const endDateStr = end.toISOString().split('T')[0];
    
    // 5. Fetch GFS
    let gfsCollection = ee.ImageCollection('NOAA/GFS0P25')
      .filterBounds(centroid)
      .filterDate(startDateStr, endDateStr)
      .filter(ee.Filter.eq('forecast_hours', 0))
      .sort('system:time_start', false);
      
    const count = await new Promise((resolve) => {
      gfsCollection.size().evaluate((c, err) => {
        if (err) resolve(0);
        else resolve(c);
      });
    });
    
    if (count === 0) {
      return res.json(getSimulatedWeather(polygon, dateOffset));
    }
    
    const weatherImage = gfsCollection.first();
    
    const uWind = weatherImage.select('u_component_of_wind_10m_above_ground');
    const vWind = weatherImage.select('v_component_of_wind_10m_above_ground');
    const windSpeed = uWind.multiply(uWind).add(vWind.multiply(vWind)).sqrt().rename('wind_speed');
    
    const combinedImage = weatherImage.select([
      'temperature_2m_above_ground',
      'precipitation_rate',
      'relative_humidity_2m_above_ground',
      'total_cloud_cover_entire_atmosphere'
    ]).addBands(windSpeed);
    
    const stats = combinedImage.reduceRegion({
      reducer: ee.Reducer.mean(),
      geometry: centroid,
      scale: 1000,
      maxPixels: 1e9
    });
    
    const weatherData = await new Promise((resolve) => {
      stats.evaluate((val, err) => {
        resolve(val || null);
      });
    });
    
    if (!weatherData) {
      return res.json(getSimulatedWeather(polygon, dateOffset));
    }
    
    const timeStart = await new Promise((resolve) => {
      weatherImage.get('system:time_start').evaluate((t) => resolve(t || Date.now()));
    });
    
    const forecastHours = await new Promise((resolve) => {
      weatherImage.get('forecast_hours').evaluate((h) => resolve(h || 0));
    });
    
    const tempC = weatherData.temperature_2m_above_ground !== undefined ? weatherData.temperature_2m_above_ground : 20.0;
    const precipRate = weatherData.precipitation_rate || 0.0;
    const precipMmPerHour = precipRate * 3600;
    
    const responseData = {
      isSimulated: false,
      temperature: parseFloat(tempC.toFixed(1)),
      precipitation: parseFloat(precipMmPerHour.toFixed(2)),
      windSpeed: parseFloat((weatherData.wind_speed || 0.0).toFixed(1)),
      humidity: parseFloat((weatherData.relative_humidity_2m_above_ground || 50.0).toFixed(1)),
      clouds: parseFloat((weatherData.total_cloud_cover_entire_atmosphere || 0.0).toFixed(1)),
      forecastTime: new Date(timeStart + forecastHours * 3600000).toISOString(),
      duration: '3 hours',
      dateStr: new Date(timeStart).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    };
    
    return res.json(responseData);
  } catch (err) {
    console.error('[GEE Weather Endpoint Error]:', err);
    return res.json(getSimulatedWeather(req.body.polygon, req.body.dateOffset));
  } finally {
    await session.close();
  }
});

// GEE Tile URL proxy/endpoint
app.post('/api/gee/tile-url', async (req, res) => {
  const session = driver.session();
  try {
    const { polygon, indexType, dateOffset, fieldId, geeScale, farmId, email } = req.body;
    if (email && !(await checkFarmAccess(session, email, farmId))) {
      return res.status(403).json({ error: 'Forbidden. You do not have access to this farm.' });
    }
    
    // 1. Fetch credentials from settings
    const props = await getSettingsNode(session, farmId);
    const creds = {
      client_email: props.geeClientEmail || '',
      private_key: props.geePrivateKey || '',
      project_id: props.geeProjectId || ''
    };
    
    if (!creds.client_email || !creds.private_key || !creds.project_id) {
      return res.status(400).json({ error: 'Google Earth Engine credentials are not fully configured in settings.' });
    }
    
    // Use the lowest meter from the minimum native resolution of the dataset and the requested scale to get high resolution imagery
    const requestedScale = parseFloat(geeScale) || parseFloat(props.geeScale) || 3.0;
    let scaleValue = Math.min(requestedScale, 10); // Sentinel-2 high-res bands native minimum is 10m
    if (['Elevation', 'Slope', 'Aspect', 'Contours'].includes(indexType)) {
      scaleValue = Math.min(requestedScale, 10); // 10m for Copernicus DEM GLO 30 / Slope / Aspect / Contours
    } else if (['GEE_Temp', 'GEE_Precip', 'GEE_Wind', 'GEE_Humidity', 'GEE_Clouds', 'GEE_Pressure'].includes(indexType)) {
      scaleValue = Math.max(requestedScale, 100); // Enforce minimum scale of 100m for weather GEE requests to prevent memory errors
    }
    
    // 2. Initialize Earth Engine
    await initializeGee(creds);
    
    // 3. Format polygon coordinates for Earth Engine (Leaflet uses [lat, lng], GEE uses [lng, lat])
    let sanitizedPolygon = polygon;
    if (Array.isArray(polygon) && polygon.length > 0 && Array.isArray(polygon[0]) && Array.isArray(polygon[0][0])) {
      sanitizedPolygon = polygon[0];
    }
    if (!Array.isArray(sanitizedPolygon) || sanitizedPolygon.length < 3) {
      return res.status(400).json({ error: 'Invalid or incomplete polygon coordinates.' });
    }
    const coords = sanitizedPolygon.map(pt => [pt[1], pt[0]]);
    // Ensure polygon is closed
    if (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1]) {
      coords.push(coords[0]);
    }
    
    const geometry = ee.Geometry.Polygon([coords]);
    
    // 4. Determine scene target date and time window
    const hash = String(fieldId || 'default').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const daysAgo = (hash % 20) + 3 - (Number(dateOffset) || 0);
    const baseDate = new Date('2026-05-28T12:00:00-04:00');
    const targetDate = new Date(baseDate.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    
    // Create a 60-day window centered on the target date
    const start = new Date(targetDate.getTime() - 30 * 24 * 60 * 60 * 1000);
    const end = new Date(targetDate.getTime() + 30 * 24 * 60 * 60 * 1000);
    
    const startDateStr = start.toISOString().split('T')[0];
    const endDateStr = end.toISOString().split('T')[0];
    
    let baseImage = null;
    const isGeeWeather = ['GEE_Temp', 'GEE_Precip', 'GEE_Wind', 'GEE_Humidity', 'GEE_Clouds', 'GEE_Pressure'].includes(indexType);

    if (!['Elevation', 'Slope', 'Aspect', 'Contours'].includes(indexType) && !isGeeWeather) {
      // Determine the specific high-resolution bands required for the requested index type
      let selectedBands = ['B2', 'B3', 'B4']; // Default/TrueColor (RGB)
      if (indexType === 'NDVI') {
        selectedBands = ['B4', 'B8'];
      } else if (indexType === 'NDWI') {
        selectedBands = ['B3', 'B8'];
      } else if (indexType === 'EVI') {
        selectedBands = ['B2', 'B4', 'B8'];
      } else if (indexType === 'SoilMoisture') {
        selectedBands = ['B8', 'B11'];
      } else if (indexType === 'FalseColor') {
        selectedBands = ['B3', 'B4', 'B8'];
      }

      // 5. Load and filter Sentinel-2 Collection, selecting only the necessary high-resolution bands
      let collection = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
        .filterBounds(geometry)
        .filterDate(startDateStr, endDateStr)
        .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))
        .select(selectedBands);
        
      // Sort by most recent
      let sorted = collection.sort('system:time_start', false);
      
      let count = await new Promise((resolve, reject) => {
        sorted.size().evaluate((c, err) => {
          if (err) reject(err);
          else resolve(c);
        });
      });
      
      if (count === 0) {
        // Fallback: relax cloud filter and sort by lowest cloud cover
        let fallbackCol = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
          .filterBounds(geometry)
          .filterDate(startDateStr, endDateStr)
          .select(selectedBands);
        sorted = fallbackCol.sort('CLOUDY_PIXEL_PERCENTAGE');
        count = await new Promise((resolve, reject) => {
          sorted.size().evaluate((c, err) => {
            if (err) reject(err);
            else resolve(c);
          });
        });
      }
      
      if (count === 0) {
        return res.status(404).json({ error: 'No Sentinel-2 imagery found for the specified bounds and date range.' });
      }
      
      const firstImage = sorted.first();
      baseImage = firstImage.resample('bicubic');
    }
    
    // 6. Process image based on index type
    let processedImage;
    let visParams;
    
    if (isGeeWeather) {
      // Load NOAA GFS Collection
      let gfsCollection = ee.ImageCollection('NOAA/GFS0P25')
        .filterBounds(geometry)
        .filterDate(startDateStr, endDateStr)
        .filter(ee.Filter.eq('forecast_hours', 0))
        .sort('system:time_start', false);
        
      const count = await new Promise((resolve, reject) => {
        gfsCollection.size().evaluate((c, err) => {
          if (err) reject(err);
          else resolve(c);
        });
      });
      
      if (count === 0) {
        return res.status(404).json({ error: 'No GEE weather reanalysis data found for the specified bounds and date range.' });
      }
      
      const weatherImage = gfsCollection.first();
      const weatherGeometry = geometry.buffer(50000); // 50km regional buffer to prevent mono-color and show detailed gradients
      
      if (indexType === 'GEE_Temp') {
        const temp = weatherImage.select('temperature_2m_above_ground');
        processedImage = temp.resample('bicubic').reproject({ crs: 'EPSG:3857', scale: scaleValue }).clip(weatherGeometry);
        visParams = {
          min: 263.15, // -10C
          max: 313.15, // 40C
          palette: ['#0000ff', '#00ffff', '#00ff00', '#ffff00', '#ffaa00', '#ff0000']
        };
      } else if (indexType === 'GEE_Precip') {
        const precip = weatherImage.select('precipitation_rate');
        processedImage = precip.resample('bicubic').reproject({ crs: 'EPSG:3857', scale: scaleValue }).clip(weatherGeometry);
        visParams = {
          min: 0.0,
          max: 0.0005,
          palette: ['#ffffff', '#e0f7fa', '#80deea', '#0097a7', '#0d47a1']
        };
      } else if (indexType === 'GEE_Wind') {
        const uWind = weatherImage.select('u_component_of_wind_10m_above_ground');
        const vWind = weatherImage.select('v_component_of_wind_10m_above_ground');
        const windSpeed = uWind.multiply(uWind).add(vWind.multiply(vWind)).sqrt().rename('wind_speed');
        processedImage = windSpeed.resample('bicubic').reproject({ crs: 'EPSG:3857', scale: scaleValue }).clip(weatherGeometry);
        visParams = {
          min: 0.0,
          max: 15.0,
          palette: ['#ffffff', '#b3e5fc', '#29b6f6', '#0288d1', '#d50000']
        };
      } else if (indexType === 'GEE_Humidity') {
        const hum = weatherImage.select('relative_humidity_2m_above_ground');
        processedImage = hum.resample('bicubic').reproject({ crs: 'EPSG:3857', scale: scaleValue }).clip(weatherGeometry);
        visParams = {
          min: 20.0,
          max: 100.0,
          palette: ['#d7ccc8', '#f5f5f5', '#b2ebf2', '#4dd0e1', '#00acc1', '#006064']
        };
      } else if (indexType === 'GEE_Clouds') {
        const clouds = weatherImage.select('total_cloud_cover_entire_atmosphere');
        processedImage = clouds.resample('bicubic').reproject({ crs: 'EPSG:3857', scale: scaleValue }).clip(weatherGeometry);
        visParams = {
          min: 0.0,
          max: 100.0,
          palette: ['#b3e5fc', '#ffffff', '#e0e0e0', '#9e9e9e']
        };
      } else if (indexType === 'GEE_Pressure') {
        // Map to precipitable_water_entire_atmosphere since mean_sea_level_pressure is not in the surface dataset
        const pressure = weatherImage.select('precipitable_water_entire_atmosphere');
        processedImage = pressure.resample('bicubic').reproject({ crs: 'EPSG:3857', scale: scaleValue }).clip(weatherGeometry);
        visParams = {
          min: 0.0,
          max: 60.0,
          palette: ['#311b92', '#512da8', '#d1c4e9', '#fff9c4', '#fbc02d', '#f57f17']
        };
      }
    } else if (['Elevation', 'Slope', 'Aspect', 'Contours'].includes(indexType)) {
      const copernicusDemCollection = ee.ImageCollection('COPERNICUS/DEM/GLO30').select('DEM');
      const dem = copernicusDemCollection.mosaic().rename('elevation');
      const elevation = dem.setDefaultProjection(copernicusDemCollection.first().projection());
      
      const stats = elevation.reduceRegion({
        reducer: ee.Reducer.minMax(),
        geometry: geometry,
        scale: scaleValue < 10 ? Math.max(1, scaleValue) : 10,
        maxPixels: 1e9
      });
      
      const minMax = await new Promise((resolve) => {
        stats.evaluate((val, err) => {
          if (err || !val) {
            resolve({ min: 0, max: 500 });
          } else {
            resolve({
              min: val.elevation_min !== undefined ? val.elevation_min : 0,
              max: val.elevation_max !== undefined ? val.elevation_max : 500
            });
          }
        });
      });
      
      let visMin = minMax.min;
      let visMax = minMax.max;
      if (visMin === visMax) {
        visMin -= 1;
        visMax += 1;
      }
      
      if (indexType === 'Elevation') {
        processedImage = elevation.resample('bicubic').reproject({ crs: 'EPSG:3857', scale: scaleValue }).clip(geometry);
        visParams = {
          min: visMin,
          max: visMax,
          palette: ['#08306b', '#006837', '#31a354', '#78c679', '#c2e699', '#fee08b', '#fdae61', '#f46d43', '#d73027', '#a50026']
        };
      } else if (indexType === 'Slope') {
        const slopeDegrees = ee.Terrain.slope(elevation);
        const slopePercentage = slopeDegrees.multiply(Math.PI / 180).tan().multiply(100).rename('slope');
        processedImage = slopePercentage.resample('bicubic').reproject({ crs: 'EPSG:3857', scale: scaleValue }).clip(geometry);
        visParams = {
          min: 0,
          max: 30,
          palette: ['#006837', '#1a9850', '#66bd63', '#a6d96a', '#d9ef8b', '#fee08b', '#fdae61', '#f46d43', '#d73027', '#a50026']
        };
      } else if (indexType === 'Aspect') {
        const aspect = ee.Terrain.aspect(elevation).rename('aspect');
        processedImage = aspect.resample('bicubic').reproject({ crs: 'EPSG:3857', scale: scaleValue }).clip(geometry);
        visParams = {
          min: 0,
          max: 360,
          palette: ['#d73027', '#fdae61', '#fee08b', '#d9ef8b', '#66bd63', '#1a9850', '#313695']
        };
      } else if (indexType === 'Contours') {
        const rounded = elevation.divide(2.0).round();
        const contours = ee.Algorithms.CannyEdgeDetector(rounded, 0.1).multiply(255).rename('contours');
        const maskedContours = contours.updateMask(contours);
        processedImage = maskedContours.reproject({ crs: 'EPSG:3857', scale: scaleValue }).clip(geometry);
        visParams = {
          min: 0,
          max: 255,
          palette: ['#ef4444']
        };
      }
    } else if (indexType === 'NDVI') {
      // Calculate NDVI: (B8 - B4) / (B8 + B4)
      const ndvi = baseImage.normalizedDifference(['B8', 'B4']).rename('NDVI');
      processedImage = ndvi.select(['NDVI']).resample('bicubic').reproject({ crs: 'EPSG:3857', scale: scaleValue }).clip(geometry);
      visParams = {
        min: 0.0,
        max: 1.0,
        palette: ['FFFFFF', 'CE7E45', 'DF923D', 'F1B555', 'FCD163', '99B718', '74A025', '3B8E1D', '257D06', '166D05', '0C2C07']
      };
    } else if (indexType === 'NDWI') {
      // McFeeters NDWI: (Green - NIR) / (Green + NIR) -> B3 - B8
      const ndwi = baseImage.normalizedDifference(['B3', 'B8']).rename('NDWI');
      processedImage = ndwi.select(['NDWI']).resample('bicubic').reproject({ crs: 'EPSG:3857', scale: scaleValue }).clip(geometry);
      visParams = {
        min: -0.5,
        max: 0.5,
        palette: ['#8d6e63', '#ffeb3b', '#80deea', '#29b6f6', '#0288d1']
      };
    } else if (indexType === 'EVI') {
      // EVI = 2.5 * (B8 - B4) / (B8 + 6 * B4 - 7.5 * B2 + 1)
      const evi = baseImage.expression(
        '2.5 * ((NIR - RED) / (NIR + 6.0 * RED - 7.5 * BLUE + 1.0))', {
          'NIR': baseImage.select('B8'),
          'RED': baseImage.select('B4'),
          'BLUE': baseImage.select('B2')
        }
      ).rename('EVI');
      processedImage = evi.select(['EVI']).resample('bicubic').reproject({ crs: 'EPSG:3857', scale: scaleValue }).clip(geometry);
      visParams = {
        min: 0.0,
        max: 1.0,
        palette: ['#FFFFFF', '#DF923D', '#FCD163', '#74A025', '#166D05']
      };
    } else if (indexType === 'SoilMoisture') {
      // NDMI = (NIR - SWIR) / (NIR + SWIR) -> B8 - B11
      const ndmi = baseImage.normalizedDifference(['B8', 'B11']).rename('SoilMoisture');
      processedImage = ndmi.select(['SoilMoisture']).resample('bicubic').reproject({ crs: 'EPSG:3857', scale: scaleValue }).clip(geometry);
      visParams = {
        min: -0.3,
        max: 0.3,
        palette: ['#a1887f', '#e0f7fa', '#4dd0e1', '#00796b']
      };
    } else if (indexType === 'FalseColor') {
      // False Color Infrared (B8, B4, B3)
      const fc = baseImage.select(['B8', 'B4', 'B3']);
      processedImage = fc.resample('bicubic').reproject({ crs: 'EPSG:3857', scale: scaleValue }).clip(geometry);
      visParams = {
        min: 0,
        max: 3000,
        gamma: 1.4
      };
    } else {
      // Default, CurrentSatellite or TrueColor (RGB: B4, B3, B2)
      const rgb = baseImage.select(['B4', 'B3', 'B2']);
      processedImage = rgb.resample('bicubic').reproject({ crs: 'EPSG:3857', scale: scaleValue }).clip(geometry);
      visParams = {
        min: 0,
        max: 3000,
        gamma: 1.4
      };
    }
    
    // 7. Obtain map ID and token
    const mapInfo = await new Promise((resolve, reject) => {
      processedImage.getMap(visParams, (info, err) => {
        if (err) reject(err);
        else resolve(info);
      });
    });
    
    if (!mapInfo || !mapInfo.mapid) {
      return res.status(500).json({ error: 'Failed to retrieve Map ID from Earth Engine.' });
    }
    
    // Construct tile URL template using urlFormat provided by GEE or fallback if not present
    let urlTemplate = mapInfo.urlFormat || `https://earthengine.googleapis.com/v1/projects/${creds.project_id}/maps/${mapInfo.mapid}/tiles/{z}/{x}/{y}`;
    
    // Normalize urlTemplate to ensure it always starts with the absolute domain
    const v1Index = urlTemplate.indexOf('/v1/projects/');
    if (v1Index !== -1) {
      urlTemplate = 'https://earthengine.googleapis.com' + urlTemplate.substring(v1Index);
    } else if (!urlTemplate.startsWith('http://') && !urlTemplate.startsWith('https://')) {
      urlTemplate = 'https://earthengine.googleapis.com/' + urlTemplate.replace(/^\/+/, '');
    }

    // Retrieve token (fall back to active service account oauth token if mapInfo.token is empty)
    let authToken = mapInfo.token || '';
    let paramName = 'token';
    
    if (!authToken) {
      const rawToken = ee.data.getAuthToken();
      authToken = rawToken ? rawToken.replace(/^Bearer\s+/i, '') : '';
      paramName = 'access_token';
    }
    
    // Append GEE map authentication token if it's not already in the URL
    if (authToken && !urlTemplate.includes('token=') && !urlTemplate.includes('access_token=')) {
      const separator = urlTemplate.includes('?') ? '&' : '?';
      urlTemplate += `${separator}${paramName}=${authToken}`;
    }
    
    res.json({
      urlTemplate,
      mapid: mapInfo.mapid,
      token: authToken
    });
    
  } catch (err) {
    console.error('GEE endpoint error:', err);
    const errMsg = typeof err === 'string' ? err : (err?.message || err?.error || String(err));
    res.status(500).json({ error: errMsg || 'Internal server error processing GEE imagery.' });
  } finally {
    await session.close();
  }
});

// Helper to route and smooth coordinate paths for a given array of scores
function getPathForScores(data, scores, latsList, lngsList, isEastWest) {
  const waterwayPoints = [];
  if (isEastWest) {
    for (const lng of lngsList) {
      const idxs = [];
      data.forEach((d, idx) => {
        if (d.lng === lng) idxs.push(idx);
      });
      let bestIdx = -1;
      let maxScore = -Infinity;
      for (const idx of idxs) {
        if (scores[idx] > maxScore) {
          maxScore = scores[idx];
          bestIdx = idx;
        }
      }
      if (bestIdx !== -1) {
        waterwayPoints.push([data[bestIdx].lat, data[bestIdx].lng]);
      }
    }
  } else {
    for (const lat of latsList) {
      const idxs = [];
      data.forEach((d, idx) => {
        if (d.lat === lat) idxs.push(idx);
      });
      let bestIdx = -1;
      let maxScore = -Infinity;
      for (const idx of idxs) {
        if (scores[idx] > maxScore) {
          maxScore = scores[idx];
          bestIdx = idx;
        }
      }
      if (bestIdx !== -1) {
        waterwayPoints.push([data[bestIdx].lat, data[bestIdx].lng]);
      }
    }
  }

  // Smooth path
  const smoothedPoints = [];
  const windowSize = 7;
  const halfWindow = Math.floor(windowSize / 2);
  if (waterwayPoints.length > 0) {
    if (isEastWest) {
      for (let i = 0; i < waterwayPoints.length; i++) {
        let sumLat = 0;
        let count = 0;
        for (let w = -halfWindow; w <= halfWindow; w++) {
          const idx = i + w;
          if (idx >= 0 && idx < waterwayPoints.length) {
            sumLat += waterwayPoints[idx][0];
            count++;
          }
        }
        smoothedPoints.push([Number((sumLat / count).toFixed(6)), waterwayPoints[i][1]]);
      }
    } else {
      for (let i = 0; i < waterwayPoints.length; i++) {
        let sumLng = 0;
        let count = 0;
        for (let w = -halfWindow; w <= halfWindow; w++) {
          const idx = i + w;
          if (idx >= 0 && idx < waterwayPoints.length) {
            sumLng += waterwayPoints[idx][1];
            count++;
          }
        }
        smoothedPoints.push([waterwayPoints[i][0], Number((sumLng / count).toFixed(6))]);
      }
    }
  }
  return smoothedPoints;
}

// Haversine distance calculator
function getDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const phi1 = lat1 * Math.PI / 180;
  const phi2 = lat2 * Math.PI / 180;
  const deltaPhi = (lat2 - lat1) * Math.PI / 180;
  const deltaLambda = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

// Compute path deviation from ground truth
function calculatePathDeviation(path, groundTruth) {
  if (!groundTruth || groundTruth.length === 0) return 0;
  if (!path || path.length === 0) return 999999;

  let totalMinDist = 0;
  for (const gt of groundTruth) {
    let minDist = Infinity;
    for (const pt of path) {
      const d = getDistanceMeters(gt.lat, gt.lng, pt[0], pt[1]);
      if (d < minDist) {
        minDist = d;
      }
    }
    totalMinDist += minDist;
  }
  return totalMinDist / groundTruth.length;
}

// GEE Find Waterways Endpoint
app.post('/api/gee/find-waterways', async (req, res) => {
  const session = driver.session();
  try {
    const { minLat, maxLat, minLng, maxLng, farmId, email } = req.body;
    if (email && !(await checkFarmAccess(session, email, farmId))) {
      return res.status(403).json({ error: 'Forbidden. You do not have access to this farm.' });
    }
    if (minLat === undefined || maxLat === undefined || minLng === undefined || maxLng === undefined) {
      return res.status(400).json({ error: 'Missing bounding box bounds' });
    }

    // Load ground truth points from Database (POIs)
    const poiResult = await session.run(`
      MATCH (poi:PointOfInterest)-[:BELONGS_TO]->(:Farm {id: $farmId})
      WHERE poi.type = 'Waterway' OR toLower(poi.name) CONTAINS 'waterway' OR poi.type = 'Water Source'
      RETURN poi
    `, { farmId });

    const groundTruth = [];
    for (const record of poiResult.records) {
      const poi = record.get('poi').properties;
      if (poi.points) {
        try {
          const pts = typeof poi.points === 'string' ? JSON.parse(poi.points) : poi.points;
          if (Array.isArray(pts)) {
            pts.forEach(pt => {
              if (Array.isArray(pt) && pt.length >= 2) {
                groundTruth.push({ lat: Number(pt[0]), lng: Number(pt[1]) });
              }
            });
          }
        } catch (e) {}
      }
    }

    // Add any ground truth points passed in body
    if (Array.isArray(req.body.groundTruthPoints)) {
      req.body.groundTruthPoints.forEach(pt => {
        if (Array.isArray(pt) && pt.length >= 2) {
          groundTruth.push({ lat: Number(pt[0]), lng: Number(pt[1]) });
        }
      });
    }

    const props = await getSettingsNode(session, farmId);
    const perfectPrivateKey = (props.geePrivateKey || '').replace(/\\n/g, '\n');
    const creds = {
      client_email: props.geeClientEmail || '',
      private_key: perfectPrivateKey,
      project_id: props.geeProjectId || ''
    };

    if (!creds.client_email || !creds.private_key || !creds.project_id) {
      return res.status(400).json({ error: 'Google Earth Engine credentials are not fully configured in settings.' });
    }

    await initializeGee(creds);

    const baseDate = new Date('2026-06-07T12:00:00-04:00');
    const oneYearAgo = new Date(baseDate.getTime() - 365 * 24 * 60 * 60 * 1000);
    const startDateStr = oneYearAgo.toISOString().split('T')[0];
    const endDateStr = baseDate.toISOString().split('T')[0];

    const boundsGeometry = ee.Geometry.Rectangle([minLng, minLat, maxLng, maxLat]);

    // 1. DEM elevation & drainage indices from MERIT Hydro
    const merit = ee.Image('MERIT/Hydro/v1_0_1');
    const meritUpa = merit.select('upa'); // Upstream area in km2
    const meritHnd = merit.select('hnd'); // Height above nearest drainage in m
    const srtm = ee.ImageCollection('COPERNICUS/DEM/GLO30').select('DEM').mosaic().rename('elevation');

    // 2. Active water surfaces from Sentinel-1 SAR (last 1 year)
    const s1Collection = ee.ImageCollection('COPERNICUS/S1_GRD')
      .filterBounds(boundsGeometry)
      .filterDate(startDateStr, endDateStr)
      .filter(ee.Filter.eq('instrumentMode', 'IW'))
      .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VV'))
      .select('VV');
    
    const s1Median = s1Collection.median().unmask(0).rename('sar_vv');

    // 3. Dry-season NDWI composite from Sentinel-2 (last 1 year)
    const s2Collection = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
      .filterBounds(boundsGeometry)
      .filterDate(startDateStr, endDateStr)
      .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 30));

    const ndwiCollection = s2Collection.map((img) => {
      return img.normalizedDifference(['B3', 'B8']).rename('NDWI');
    });

    const ndwiDry = ndwiCollection.reduce(ee.Reducer.percentile([15])).unmask(-1).rename('ndwi_dry');

    // Combine all bands into a composite image
    const compositeImage = ee.Image.cat([
      srtm.rename('elevation'),
      meritUpa.rename('upa'),
      meritHnd.rename('hnd'),
      s1Median.rename('sar_vv'),
      ndwiDry.rename('ndwi_dry')
    ]);

    // Create a high-resolution 57x57 grid of points in the bounding box
    const latSteps = 57;
    const lngSteps = 57;
    const points = [];
    for (let i = 0; i <= latSteps; i++) {
      const lat = Number((minLat + (i / latSteps) * (maxLat - minLat)).toFixed(6));
      for (let j = 0; j <= lngSteps; j++) {
        const lng = Number((minLng + (j / lngSteps) * (maxLng - minLng)).toFixed(6));
        points.push(ee.Feature(ee.Geometry.Point([lng, lat]), { lat, lng }));
      }
    }

    const featureCollection = ee.FeatureCollection(points);
    const sampled = compositeImage.reduceRegions({
      collection: featureCollection,
      reducer: ee.Reducer.first(),
      scale: 10 // Appropriate scale for Sentinel-2 / DEM features
    });

    sampled.evaluate((resultVal, err) => {
      if (err) {
        console.error('GEE find-waterways evaluate error:', err);
        return res.status(500).json({ error: 'Earth Engine calculation failed: ' + (err.message || err) });
      }
      if (!resultVal || !resultVal.features) {
        return res.status(500).json({ error: 'No response features from GEE' });
      }

      const data = resultVal.features.map(f => {
        const props = f.properties || {};
        return {
          lat: props.lat,
          lng: props.lng,
          elevation: props.elevation !== undefined ? props.elevation : null,
          upa: props.upa !== undefined ? props.upa : null,
          hnd: props.hnd !== undefined ? props.hnd : null,
          sar_vv: props.sar_vv !== undefined ? props.sar_vv : null,
          ndwi_dry: props.ndwi_dry !== undefined ? props.ndwi_dry : null
        };
      });

      // Calculate min/max elevation to scale relative depth
      const elevations = data.map(d => d.elevation).filter(e => e !== null);
      const maxElev = elevations.length > 0 ? Math.max(...elevations) : 1000;
      const minElev = elevations.length > 0 ? Math.min(...elevations) : 0;
      const elevRange = maxElev - minElev || 1;

      // 1. Existing method scores (combined)
      const scoresExisting = data.map(d => {
        let depthScore = 0;
        if (d.elevation !== null) {
          depthScore = ((maxElev - d.elevation) / elevRange) * 1000;
        }
        let meritScore = 0;
        if (d.upa !== null) {
          meritScore += Math.min(d.upa * 1000, 500);
        }
        if (d.hnd !== null) {
          meritScore += Math.max(0, 500 - d.hnd * 100);
        }
        let sarScore = 0;
        const hasSar = d.sar_vv !== null && d.sar_vv !== 0 && d.sar_vv < -16;
        if (hasSar) {
          sarScore = 500 + Math.max(0, -16 - d.sar_vv) * 50;
        }
        let ndwiScore = 0;
        const hasNdwi = d.ndwi_dry !== null && d.ndwi_dry !== -1 && d.ndwi_dry > 0.0;
        if (hasNdwi) {
          ndwiScore = 500 + d.ndwi_dry * 1000;
        }
        return depthScore + meritScore + sarScore + ndwiScore;
      });

      // 2. Sentinel-2 NDWI method scores (S2 index + relative depth)
      const scoresS2 = data.map(d => {
        let depthScore = 0;
        if (d.elevation !== null) {
          depthScore = ((maxElev - d.elevation) / elevRange) * 1000;
        }
        let ndwiScore = 0;
        const hasNdwi = d.ndwi_dry !== null && d.ndwi_dry !== -1 && d.ndwi_dry > 0.0;
        if (hasNdwi) {
          ndwiScore = 500 + d.ndwi_dry * 1000;
        }
        return depthScore + ndwiScore;
      });

      // 3. Copernicus DEM Terrain-only method scores (elevation depth + MERIT Hydro terrain flow metrics)
      const scoresTerrain = data.map(d => {
        let depthScore = 0;
        if (d.elevation !== null) {
          depthScore = ((maxElev - d.elevation) / elevRange) * 1000;
        }
        let meritScore = 0;
        if (d.upa !== null) {
          meritScore += Math.min(d.upa * 1000, 500);
        }
        if (d.hnd !== null) {
          meritScore += Math.max(0, 500 - d.hnd * 100);
        }
        return depthScore + meritScore;
      });

      // Determine general orientation using scoresExisting
      let isEastWest = false;
      const sortedPoints = data.map((d, i) => ({ ...d, score: scoresExisting[i] })).sort((a, b) => b.score - a.score);
      const topPoints = sortedPoints.slice(0, Math.max(5, Math.floor(data.length * 0.15)));
      if (topPoints.length >= 3) {
        const lats = topPoints.map(p => p.lat);
        const lngs = topPoints.map(p => p.lng);
        const latRange = Math.max(...lats) - Math.min(...lats);
        const lngRange = Math.max(...lngs) - Math.min(...lngs);
        if (lngRange > latRange) {
          isEastWest = true;
        }
      }

      const latsList = Array.from(new Set(data.map(d => d.lat))).sort((a, b) => b - a); // North to South
      const lngsList = Array.from(new Set(data.map(d => d.lng))).sort((a, b) => a - b); // West to East

      // Generate paths for all three methods
      const pathExisting = getPathForScores(data, scoresExisting, latsList, lngsList, isEastWest);
      const pathS2 = getPathForScores(data, scoresS2, latsList, lngsList, isEastWest);
      const pathTerrain = getPathForScores(data, scoresTerrain, latsList, lngsList, isEastWest);

      // Perform validation
      let devExisting = 0;
      let devS2 = 0;
      let devTerrain = 0;
      let winner = 'existing';
      let winnerPoints = pathExisting;
      let logMsg = '';

      if (groundTruth.length > 0) {
        devExisting = calculatePathDeviation(pathExisting, groundTruth);
        devS2 = calculatePathDeviation(pathS2, groundTruth);
        devTerrain = calculatePathDeviation(pathTerrain, groundTruth);

        // Find minimum deviation
        const minDev = Math.min(devExisting, devS2, devTerrain);
        if (minDev === devTerrain) {
          winner = 'terrain';
          winnerPoints = pathTerrain;
        } else if (minDev === devS2) {
          winner = 'sentinel2';
          winnerPoints = pathS2;
        } else {
          winner = 'existing';
          winnerPoints = pathExisting;
        }

        logMsg = `Waterway detection validated against ${groundTruth.length} ground truth reference points. Method comparison:\n` +
                 `- Existing (Combined) Method: Mean deviation of ${devExisting.toFixed(2)} meters.\n` +
                 `- Sentinel-2 NDWI Method: Mean deviation of ${devS2.toFixed(2)} meters.\n` +
                 `- Copernicus DEM Terrain-only Method: Mean deviation of ${devTerrain.toFixed(2)} meters.\n` +
                 `Selected "${winner}" as the active waterway detection method going forward because it matches ground truth closest.`;
      } else {
        logMsg = `No hand-marked KML or POI waterway reference points available for validation. Defaulted to "existing" method as fallback.`;
      }

      // Write winning method and validation log to settings
      const dbPromise = (async () => {
        const session2 = driver.session();
        try {
          // Update GlobalSettings
          await session2.run(`
            MATCH (s:GlobalSettings)-[:BELONGS_TO]->(:Farm {id: $farmId})
            SET s.activeWaterwayMethod = $winner,
                s.waterwayValidationLog = $logMsg
          `, { farmId, winner, logMsg });

          // Create an AuditLog entry
          const auditId = `audit_${Date.now()}_${Math.random().toString().replace('.', '')}`;
          await session2.run(`
            MATCH (farm:Farm {id: $farmId})
            CREATE (l:AuditLog {
              id: $id,
              timestamp: $timestamp,
              actionType: 'SYSTEM',
              details: $details,
              tab: 'Map'
            })
            CREATE (l)-[:BELONGS_TO]->(farm)
          `, {
            farmId,
            id: auditId,
            timestamp: new Date().toISOString(),
            details: `Waterway detection validated. Winner: ${winner}. Deviation scores: Existing=${devExisting.toFixed(2)}m, S2=${devS2.toFixed(2)}m, Terrain=${devTerrain.toFixed(2)}m. ${groundTruth.length} points compared.`
          });
        } catch (dbErr) {
          console.error('Error writing waterway settings to DB:', dbErr);
        } finally {
          await session2.close();
        }
      })();

      const validElevations = data.map(d => d.elevation).filter(e => e !== null);
      const avgElevation = validElevations.length > 0 
        ? Number((validElevations.reduce((sum, e) => sum + e, 0) / validElevations.length).toFixed(2))
        : null;

      res.json({
        points: winnerPoints,
        mapElevation: avgElevation,
        validation: {
          winner,
          groundTruthCount: groundTruth.length,
          scores: {
            existing: devExisting,
            sentinel2: devS2,
            terrain: devTerrain
          },
          log: logMsg
        }
      });
    });
  } catch (err) {
    console.error('find-waterways endpoint error:', err);
    res.status(500).json({ error: err.message || err });
  } finally {
    await session.close();
  }
});

});

// GEE Flood Risk Analysis and Drainage Planning Endpoint
app.post('/api/gee/flood-drainage-analysis', async (req, res) => {
  const session = driver.session();
  try {
    const { farmId, email } = req.body;
    if (email && !(await checkFarmAccess(session, email, farmId))) {
      return res.status(403).json({ error: 'Forbidden. You do not have access to this farm.' });
    }

    const props = await getSettingsNode(session, farmId);
    const perfectPrivateKey = (props.geePrivateKey || '').replace(/\\n/g, '\n');
    const creds = {
      client_email: props.geeClientEmail || '',
      private_key: perfectPrivateKey,
      project_id: props.geeProjectId || ''
    };

    if (!creds.client_email || !creds.private_key || !creds.project_id) {
      return res.status(400).json({ error: 'Google Earth Engine credentials are not fully configured in settings.' });
    }

    await initializeGee(creds);

    // Retrieve fields
    const fieldsRes = await session.run(`
      MATCH (f:Field)-[:BELONGS_TO]->(:Farm {id: $farmId})
      RETURN f
    `, { farmId });

    const fields = fieldsRes.records.map(r => r.get('f').properties);
    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields found for this farm. Please create fields/crop blocks first.' });
    }

    // Load waterway POIs to find nearest waterway
    const waterwayRes = await session.run(`
      MATCH (poi:PointOfInterest)-[:BELONGS_TO]->(:Farm {id: $farmId})
      WHERE poi.type = 'Waterway' OR toLower(poi.name) CONTAINS 'waterway' OR poi.type = 'Water Source'
      RETURN poi
    `, { farmId });

    const waterways = waterwayRes.records.map(r => {
      const p = r.get('poi').properties;
      if (p.points) {
        try {
          return { id: p.id, name: p.name, points: typeof p.points === 'string' ? JSON.parse(p.points) : p.points };
        } catch (e) {}
      }
      return null;
    }).filter(Boolean);

    // Load GEE layers
    const merit = ee.Image('MERIT/Hydro/v1_0_1');
    const meritUpa = merit.select('upa');
    const meritHnd = merit.select('hnd');
    const srtm = ee.ImageCollection('COPERNICUS/DEM/GLO30').select('DEM').mosaic();
    const slope = ee.Terrain.slope(srtm);

    // Build sample points in Node.js
    const points = [];
    const fieldsMetadata = {};

    fields.forEach(field => {
      let boundary = [];
      try {
        boundary = typeof field.boundary === 'string' ? JSON.parse(field.boundary) : field.boundary;
      } catch (e) {}

      if (!Array.isArray(boundary) || boundary.length === 0) return;

      const cleanBoundary = boundary.filter(pt => pt && pt.length >= 2).map(pt => [Number(pt[0]), Number(pt[1])]);
      if (cleanBoundary.length === 0) return;

      let sumLat = 0, sumLng = 0;
      cleanBoundary.forEach(pt => {
        sumLat += pt[0];
        sumLng += pt[1];
      });
      const centroidLat = sumLat / cleanBoundary.length;
      const centroidLng = sumLng / cleanBoundary.length;

      fieldsMetadata[field.id] = {
        name: field.name,
        centroid: [centroidLat, centroidLng],
        boundary: cleanBoundary
      };

      // Add interior point
      points.push({
        lat: centroidLat,
        lng: centroidLng,
        fieldId: field.id,
        role: 'interior'
      });

      // Add boundary and upslope buffer points
      cleanBoundary.forEach((pt, i) => {
        points.push({
          lat: pt[0],
          lng: pt[1],
          fieldId: field.id,
          role: 'boundary',
          index: i
        });

        const offsetLat = pt[0] + (pt[0] - centroidLat) * 0.2;
        const offsetLng = pt[1] + (pt[1] - centroidLng) * 0.2;
        points.push({
          lat: offsetLat,
          lng: offsetLng,
          fieldId: field.id,
          role: 'upslope',
          index: i
        });
      });
    });

    if (points.length === 0) {
      return res.status(400).json({ error: 'No clean field boundary coordinates found.' });
    }

    const eeFeatures = points.map((p, idx) => {
      return ee.Feature(ee.Geometry.Point([p.lng, p.lat]), {
        idx,
        fieldId: p.fieldId,
        role: p.role,
        lat: p.lat,
        lng: p.lng,
        index: p.index !== undefined ? p.index : null
      });
    });

    const compositeImage = ee.Image.cat([
      srtm.rename('elevation'),
      slope.rename('slope'),
      meritUpa.rename('upa'),
      meritHnd.rename('hnd')
    ]);

    const featureCollection = ee.FeatureCollection(eeFeatures);
    const sampled = compositeImage.reduceRegions({
      collection: featureCollection,
      reducer: ee.Reducer.first(),
      scale: 10
    });

    sampled.evaluate(async (resultVal, err) => {
      if (err) {
        console.error('GEE sampled error:', err);
        return res.status(500).json({ error: 'GEE evaluation failed: ' + (err.message || err) });
      }

      if (!resultVal || !resultVal.features) {
        return res.status(500).json({ error: 'No features returned from GEE' });
      }

      const sampledByField = {};
      resultVal.features.forEach(f => {
        const props = f.properties || {};
        const fieldId = props.fieldId;
        if (!fieldId) return;

        if (!sampledByField[fieldId]) {
          sampledByField[fieldId] = {
            interior: [],
            boundary: [],
            upslope: []
          };
        }

        const dataPt = {
          lat: props.lat,
          lng: props.lng,
          index: props.index !== undefined ? props.index : null,
          elevation: props.elevation !== undefined ? props.elevation : null,
          slope: props.slope !== undefined ? props.slope : 0.01,
          upa: props.upa !== undefined ? props.upa : 0
        };

        sampledByField[fieldId][props.role].push(dataPt);
      });

      const recommendations = [];
      const session3 = driver.session();

      try {
        await session3.run(`
          MATCH (poi:PointOfInterest)-[:BELONGS_TO]->(:Farm {id: $farmId})
          WHERE poi.type = 'Drainage Recommendation'
          DETACH DELETE poi
        `, { farmId });

        for (const fieldId of Object.keys(sampledByField)) {
          const fieldMeta = fieldsMetadata[fieldId];
          const fieldData = sampledByField[fieldId];

          let maxBoundaryPt = null;
          let maxUpa = -Infinity;
          fieldData.boundary.forEach(pt => {
            if (pt.upa > maxUpa) {
              maxUpa = pt.upa;
              maxBoundaryPt = pt;
            }
          });

          let maxUpslopeSlope = 0;
          fieldData.upslope.forEach(pt => {
            if (pt.slope > maxUpslopeSlope) maxUpslopeSlope = pt.slope;
          });

          let avgInteriorSlope = 0;
          let interiorCount = 0;
          fieldData.interior.forEach(pt => {
            avgInteriorSlope += pt.slope;
            interiorCount++;
          });
          avgInteriorSlope = interiorCount > 0 ? avgInteriorSlope / interiorCount : 0.01;

          const hasSlopeTransition = maxUpslopeSlope > 5.7 && avgInteriorSlope < 2.3;
          const hasConvergence = maxUpa > 0.05;
          const isFloodProne = hasConvergence || hasSlopeTransition;

          if (isFloodProne && maxBoundaryPt) {
            const areaM2 = maxUpa * 1e6;
            const C = 0.35;
            const I = 1.8e-5; // m/s
            const Q = C * I * areaM2;

            const localSlopeDeg = maxBoundaryPt.slope;
            const localSlopeRad = (localSlopeDeg * Math.PI) / 180;
            const S = Math.max(0.01, Math.sin(localSlopeRad));

            const flowDepth = Math.pow((Q * 0.03) / (2.5 * 0.7 * Math.sqrt(S)), 0.375);
            const channelDepth = flowDepth * 1.2;
            const bottomWidth = flowDepth * 1.5;

            const widthCm = Math.max(30, Math.round(bottomWidth * 100));
            const depthCm = Math.max(20, Math.round(channelDepth * 100));

            let nearestWaterway = null;
            let minDist = Infinity;
            let routingDirection = 'North';

            waterways.forEach(w => {
              w.points.forEach(pt => {
                const dist = getDistanceMeters(maxBoundaryPt.lat, maxBoundaryPt.lng, pt[0], pt[1]);
                if (dist < minDist) {
                  minDist = dist;
                  nearestWaterway = pt;
                }
              });
            });

            if (nearestWaterway) {
              const lat1 = (maxBoundaryPt.lat * Math.PI) / 180;
              const lat2 = (nearestWaterway[0] * Math.PI) / 180;
              const lon1 = (maxBoundaryPt.lng * Math.PI) / 180;
              const lon2 = (nearestWaterway[1] * Math.PI) / 180;
              const dLon = lon2 - lon1;

              const yAngle = Math.sin(dLon) * Math.cos(lat2);
              const xAngle = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
              let brng = (Math.atan2(yAngle, xAngle) * 180) / Math.PI;
              brng = (brng + 360) % 360;

              const directions = ['North', 'North-East', 'East', 'South-East', 'South', 'South-West', 'West', 'North-West'];
              const index = Math.round(brng / 45) % 8;
              routingDirection = directions[index];
            }

            const matchingUpslopePt = fieldData.upslope.find(pt => pt.index === maxBoundaryPt.index) || { lat: maxBoundaryPt.lat, lng: maxBoundaryPt.lng };
            const flowPath = [[matchingUpslopePt.lat, matchingUpslopePt.lng], [maxBoundaryPt.lat, maxBoundaryPt.lng]];

            const recId = `poi_drainage_${fieldId}_${Date.now()}`;
            const recName = `Interception Channel - ${fieldMeta.name}`;
            const desc = `Recommended interception channel to protect ${fieldMeta.name}. Sized for a 10-year design storm in Bomi County. Dimensions: ${widthCm}cm wide x ${depthCm}cm deep. Route water toward: ${routingDirection} (nearest waterway).`;

            const metadataObj = {
              fieldProtected: fieldMeta.name,
              fieldId,
              widthCm,
              depthCm,
              direction: routingDirection,
              peakFlow: Q.toFixed(3),
              upslopeArea: areaM2.toFixed(0),
              flowPath,
              hasSlopeTransition,
              hasConvergence
            };

            const newPoi = {
              id: recId,
              name: recName,
              type: 'Drainage Recommendation',
              description: desc,
              points: JSON.stringify([[maxBoundaryPt.lat, maxBoundaryPt.lng]]),
              drawColor: '#0288d1',
              isLine: false,
              createdBy: 'SYSTEM',
              createdAt: new Date().toISOString()
            };

            await session3.run(`
              MATCH (farm:Farm {id: $farmId})
              CREATE (poi:PointOfInterest {
                id: $id,
                name: $name,
                type: $type,
                description: $description,
                points: $points,
                drawColor: $drawColor,
                isLine: $isLine,
                createdBy: $createdBy,
                createdAt: datetime(),
                fieldProtected: $fieldProtected,
                recommendedWidth: toInteger($width),
                recommendedDepth: toInteger($depth),
                routingDirection: $direction,
                peakFlow: toFloat($peakFlow),
                upslopeArea: toFloat($upslopeArea),
                metadata: $metadata
              })
              CREATE (poi)-[:BELONGS_TO]->(farm)
            `, {
              farmId,
              id: recId,
              name: recName,
              type: 'Drainage Recommendation',
              description: desc,
              points: newPoi.points,
              drawColor: newPoi.drawColor,
              isLine: newPoi.isLine,
              createdBy: newPoi.createdBy,
              fieldProtected: fieldMeta.name,
              width: widthCm,
              depth: depthCm,
              direction: routingDirection,
              peakFlow: Q,
              upslopeArea: areaM2,
              metadata: JSON.stringify(metadataObj)
            });

            recommendations.push({
              id: recId,
              name: recName,
              lat: maxBoundaryPt.lat,
              lng: maxBoundaryPt.lng,
              fieldProtected: fieldMeta.name,
              widthCm,
              depthCm,
              direction: routingDirection,
              peakFlow: Q.toFixed(3),
              upslopeArea: areaM2.toFixed(0)
            });
          }
        }

        const auditId = `audit_drainage_${Date.now()}`;
        await session3.run(`
          MATCH (farm:Farm {id: $farmId})
          CREATE (l:AuditLog {
            id: $id,
            timestamp: $timestamp,
            actionType: 'SYSTEM',
            details: $details,
            tab: 'Map'
          })
          CREATE (l)-[:BELONGS_TO]->(farm)
        `, {
          farmId,
          id: auditId,
          timestamp: new Date().toISOString(),
          details: `Seasonal flood risk analysis and drainage planning completed. Generated ${recommendations.length} drainage channel recommendations.`
        });

      } catch (dbErr) {
        console.error('Error saving drainage recommendations to DB:', dbErr);
      } finally {
        await session3.close();
      }

      res.json({ success: true, recommendations });
    });

  } catch (err) {
    console.error('flood-drainage-analysis endpoint error:', err);
    res.status(500).json({ error: err.message || err });
  } finally {
    await session.close();
  }
});

// Point-in-polygon helper
function isPointInPolygon(lng, lat, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const latI = polygon[i][0], lngI = polygon[i][1];
    const latJ = polygon[j][0], lngJ = polygon[j][1];
    const intersect = ((latI > lat) !== (latJ > lat))
        && (lng < (lngJ - lngI) * (lat - latI) / (latJ - latI) + lngI);
    if (intersect) inside = !inside;
  }
  return inside;
}

// GEE Detect Illegal Charcoal Burning Endpoint
app.post('/api/gee/detect-charcoal', async (req, res) => {
  const session = driver.session();
  try {
    const { farmId, email } = req.body;
    if (email && !(await checkFarmAccess(session, email, farmId))) {
      return res.status(403).json({ error: 'Forbidden. You do not have access to this farm.' });
    }

    // 1. Fetch NMK Property boundary polygon
    const fieldRes = await session.run(`
      MATCH (f:Field)
      WHERE f.name = "NMK Property" OR f.name CONTAINS "NMK Property"
      RETURN f LIMIT 1
    `);

    let polygon = null;
    if (fieldRes.records.length > 0) {
      const pStr = fieldRes.records[0].get('f').properties.polygon;
      polygon = typeof pStr === 'string' ? JSON.parse(pStr) : pStr;
    }

    if (!polygon) {
      // Fallback: try to find any field or fallback to a default bbox for Bomi County NMK Property
      const fallbackRes = await session.run(`MATCH (f:Field) RETURN f`);
      if (fallbackRes.records.length > 0) {
        const pStr = fallbackRes.records[0].get('f').properties.polygon;
        polygon = typeof pStr === 'string' ? JSON.parse(pStr) : pStr;
      }
    }

    if (!polygon || !Array.isArray(polygon) || polygon.length < 3) {
      return res.status(400).json({ error: 'NMK Property polygon could not be resolved in database.' });
    }

    const props = await getSettingsNode(session, farmId);
    const perfectPrivateKey = (props.geePrivateKey || '').replace(/\\n/g, '\n');
    const creds = {
      client_email: props.geeClientEmail || '',
      private_key: perfectPrivateKey,
      project_id: props.geeProjectId || ''
    };

    if (!creds.client_email || !creds.private_key || !creds.project_id) {
      return res.status(400).json({ error: 'Google Earth Engine credentials are not fully configured in settings.' });
    }

    await initializeGee(creds);

    const geeCoords = polygon.map(p => [p[1], p[0]]);
    if (geeCoords[0][0] !== geeCoords[geeCoords.length - 1][0] || geeCoords[0][1] !== geeCoords[geeCoords.length - 1][1]) {
      geeCoords.push(geeCoords[0]);
    }
    const boundaryGeometry = ee.Geometry.Polygon([geeCoords]);

    const baseDate = new Date('2026-06-07T12:00:00-04:00');
    // Recent collection: last 45 days (larger window to guarantee cloud-free imagery fallback)
    const recentStart = new Date(baseDate.getTime() - 45 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const recentEnd = baseDate.toISOString().split('T')[0];
    
    // Baseline collection: preceding 3 to 12 months
    const baselineStart = new Date(baseDate.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const baselineEnd = new Date(baseDate.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const recentCollection = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
      .filterBounds(boundaryGeometry)
      .filterDate(recentStart, recentEnd)
      .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 35));

    const baselineCollection = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
      .filterBounds(boundaryGeometry)
      .filterDate(baselineStart, baselineEnd)
      .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 35));

    const recentImg = recentCollection.median();
    const baselineImg = baselineCollection.median();

    // Calculate signals
    const ndviRecent = recentImg.normalizedDifference(['B8', 'B4']).rename('ndvi_recent');
    const ndviBaseline = baselineImg.normalizedDifference(['B8', 'B4']).rename('ndvi_baseline');
    const ndviDiff = ndviBaseline.subtract(ndviRecent).rename('ndvi_diff');

    const nbrRecent = recentImg.normalizedDifference(['B8', 'B12']).rename('nbr_recent');
    const swirRecent = recentImg.select('B12').rename('swir_recent');

    // Sudden Vegetation Loss: NDVI drops by at least 0.20 and is currently low (< 0.35)
    const vegLoss = ndviDiff.gt(0.20).and(ndviRecent.lt(0.35)).rename('veg_loss');
    // Thermal or scorched ground: NBR < 0.0 or SWIR2 (B12) value > 2200
    const thermalScorched = nbrRecent.lt(0.0).or(swirRecent.gt(2200)).rename('thermal_scorched');

    const highConf = vegLoss.and(thermalScorched).rename('high_conf');
    const lowConf = vegLoss.add(thermalScorched).gt(0).and(highConf.not()).rename('low_conf');

    // Vectorize high & low confidence masks
    const highVectors = highConf.selfMask().reduceToVectors({
      geometry: boundaryGeometry,
      scale: 20,
      maxPixels: 1e8
    });

    const lowVectors = lowConf.selfMask().reduceToVectors({
      geometry: boundaryGeometry,
      scale: 20,
      maxPixels: 1e8
    });

    // Map each to its centroid and confidence property
    const highList = highVectors.map(function(f) {
      return ee.Feature(f.geometry().centroid(), { confidence: 'High' });
    });
    const lowList = lowVectors.map(function(f) {
      return ee.Feature(f.geometry().centroid(), { confidence: 'Low' });
    });

    const combinedFC = highList.merge(lowList);
    
    // Evaluate combined signals
    const rawAlerts = await new Promise((resolve, reject) => {
      combinedFC.evaluate((result, error) => {
        if (error) reject(error);
        else resolve(result);
      });
    });

    // Get containment crop blocks
    const fieldsRes = await session.run('MATCH (f:Field) RETURN f');
    const fieldsList = fieldsRes.records.map(rec => {
      const f = rec.get('f').properties;
      return {
        id: f.id,
        name: f.name,
        polygon: typeof f.polygon === 'string' ? JSON.parse(f.polygon) : f.polygon
      };
    });

    const timestamp = new Date().toISOString();

    if (rawAlerts && rawAlerts.features) {
      for (const feat of rawAlerts.features) {
        const coords = feat.geometry.coordinates; // [lng, lat]
        const confidence = feat.properties.confidence;
        const lng = coords[0];
        const lat = coords[1];

        // Determine container field
        let fieldId = null;
        let fieldName = "Outside Fields / Wildlands";
        for (const f of fieldsList) {
          if (Array.isArray(f.polygon) && isPointInPolygon(lng, lat, f.polygon)) {
            fieldId = f.id;
            fieldName = f.name;
            break;
          }
        }

        // Round coordinates for deterministic ID
        const roundedLat = Number(lat.toFixed(4));
        const roundedLng = Number(lng.toFixed(4));
        const alertId = `alert_${roundedLat.toString().replace('.', '_')}_${roundedLng.toString().replace('.', '_')}`;

        await session.run(`
          MATCH (farm:Farm {id: $farmId})
          MERGE (a:CharcoalAlert {id: $id})
          MERGE (a)-[:BELONGS_TO]->(farm)
          ON CREATE SET a.latitude = $latitude,
                        a.longitude = $longitude,
                        a.detectedAt = $timestamp,
                        a.confidence = $confidence,
                        a.status = 'Pending Inspection',
                        a.fieldName = $fieldName,
                        a.fieldId = $fieldId
          ON MATCH SET a.confidence = $confidence,
                       a.fieldName = $fieldName,
                       a.fieldId = $fieldId
        `, {
          farmId,
          id: alertId,
          latitude: lat,
          longitude: lng,
          timestamp,
          confidence,
          fieldName,
          fieldId
        });
      }
    }

    // Return all alerts for the farm
    const allAlertsRes = await session.run(`
      MATCH (a:CharcoalAlert)-[:BELONGS_TO]->(:Farm {id: $farmId})
      RETURN a
    `, { farmId });
    const allAlerts = allAlertsRes.records.map(rec => rec.get('a').properties);

    res.json({ success: true, alerts: allAlerts });
  } catch (err) {
    console.error('GEE Charcoal detection error:', err);
    res.status(500).json({ error: err.message || err });
  } finally {
    await session.close();
  }
});

// Update Charcoal Alert Status Endpoint
app.post('/api/charcoal-alerts/update-status', async (req, res) => {
  const session = driver.session();
  try {
    const { id, status } = req.body;
    if (!id || !status) {
      return res.status(400).json({ error: 'Missing alert ID or status.' });
    }
    await session.run(`
      MATCH (a:CharcoalAlert {id: $id})
      SET a.status = $status
      RETURN a
    `, { id, status });
    res.json({ success: true });
  } catch (err) {
    console.error('Update status error:', err);
    res.status(500).json({ error: err.message || err });
  } finally {
    await session.close();
  }
});

// Utility to parse Server-Sent Events (SSE) buffer for Gemini and Claude streaming
function processSSEBuffer(buffer, provider, res) {
  const lines = buffer.split('\n');
  const lastLine = lines.pop(); // Keep partial line in buffer
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    if (trimmed.startsWith('data:')) {
      const dataStr = trimmed.slice(5).trim();
      if (dataStr === '[DONE]') continue;
      try {
        const parsed = JSON.parse(dataStr);
        if (provider === 'gemini') {
          const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            res.write(text);
          }
        } else {
          // Claude
          if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
            res.write(parsed.delta.text);
          }
        }
      } catch (err) {
        // Ignore parsing errors for partial/incomplete SSE JSON lines
      }
    }
  }
  return lastLine;
}

// Fetch Earth Engine satellite derived indicators for a specific field polygon
async function getGeeSatelliteStats(coords, settingsNode) {
  return new Promise((resolve) => {
    if (!coords || !Array.isArray(coords) || coords.length < 3) {
      return resolve(null);
    }
    const perfectPrivateKey = (settingsNode.geePrivateKey || '').replace(/\\n/g, '\n');
    const creds = {
      client_email: settingsNode.geeClientEmail || '',
      private_key: perfectPrivateKey,
      project_id: settingsNode.geeProjectId || ''
    };

    if (!creds.client_email || !creds.private_key || !creds.project_id) {
      console.log('GEE credentials missing or incomplete, skipping GEE stats.');
      return resolve(null);
    }

    initializeGee(creds)
      .then(() => {
        try {
          const lats = coords.map(pt => pt[0]);
          const lngs = coords.map(pt => pt[1]);
          const minLat = Math.min(...lats);
          const maxLat = Math.max(...lats);
          const minLng = Math.min(...lngs);
          const maxLng = Math.max(...lngs);

          const boundsGeometry = ee.Geometry.Rectangle([minLng, minLat, maxLng, maxLat]);
          const validCoords = coords.filter(pt => Array.isArray(pt) && pt.length >= 2 && pt[0] !== null && pt[1] !== null);
          if (validCoords.length < 3) {
            return resolve(null);
          }
          const eePolygon = ee.Geometry.Polygon([validCoords.map(pt => [pt[1], pt[0]])]);

          const baseDate = new Date('2026-06-07T12:00:00-04:00');
          const oneYearAgo = new Date(baseDate.getTime() - 365 * 24 * 60 * 60 * 1000);
          const startDateStr = oneYearAgo.toISOString().split('T')[0];
          const endDateStr = baseDate.toISOString().split('T')[0];

          // 1. DEM elevation & drainage indices
          const merit = ee.Image('MERIT/Hydro/v1_0_1');
          const meritHnd = merit.select('hnd'); // Height above nearest drainage
          const srtm = ee.ImageCollection('COPERNICUS/DEM/GLO30').select('DEM').mosaic().rename('elevation');

          // 2. Active water surfaces (Sentinel-1 SAR)
          const s1Collection = ee.ImageCollection('COPERNICUS/S1_GRD')
            .filterBounds(boundsGeometry)
            .filterDate(startDateStr, endDateStr)
            .filter(ee.Filter.eq('instrumentMode', 'IW'))
            .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VV'))
            .select('VV');
          const s1Median = s1Collection.median().unmask(0).rename('sar_vv');

          // 3. Dry-season NDWI composite (Sentinel-2)
          const s2Collection = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
            .filterBounds(boundsGeometry)
            .filterDate(startDateStr, endDateStr)
            .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 30));
          const ndwiCollection = s2Collection.map((img) => {
            return img.normalizedDifference(['B3', 'B8']).rename('NDWI');
          });
          const ndwiDry = ndwiCollection.reduce(ee.Reducer.percentile([15])).unmask(-1).rename('ndwi_dry');

          const compositeImage = ee.Image.cat([
            srtm.rename('elevation'),
            meritHnd.rename('hnd'),
            s1Median.rename('sar_vv'),
            ndwiDry.rename('ndwi_dry')
          ]);

          const reducer = compositeImage.reduceRegion({
            reducer: ee.Reducer.mean(),
            geometry: eePolygon,
            scale: 30, // Scale appropriate for field level
            maxPixels: 1e9
          });

          reducer.evaluate((info, err) => {
            if (err) {
              console.error('GEE evaluate stats error:', err);
              resolve(null);
            } else {
              resolve(info);
            }
          });
        } catch (err) {
          console.error('GEE build image error:', err);
          resolve(null);
        }
      })
      .catch(err => {
        console.error('Failed to initialize GEE:', err);
        resolve(null);
      });
  });
}

// AI Crop recommendations Generator Proxy Route (Streaming)
app.post('/api/recommendations/generate', async (req, res) => {
  const { fieldId, fieldName, area, soilType, irrigation, status, elevation, soilMoisture, location, season, priorities, cropHistory, notes, startDate, selectedCrops, exchangeRate, farmId, email } = req.body;

  const session = driver.session();
  try {
    if (email && !(await checkFarmAccess(session, email, farmId))) {
      return res.status(403).json({ error: 'Forbidden. You do not have access to this farm.' });
    }
    // 1. Fetch credentials from settings
    const settingsNode = await getSettingsNode(session, farmId);
    const provider = settingsNode.aiProvider || 'gemini';
    const geminiKey = settingsNode.geminiApiKey || '';
    const claudeKey = settingsNode.claudeApiKey || '';

    // Query field node from Neo4j to get polygon coordinates
    let fieldPolygon = null;
    if (fieldId) {
      const fieldRes = await session.run("MATCH (f:Field {id: $fieldId}) RETURN f", { fieldId });
      if (fieldRes.records.length > 0) {
        fieldPolygon = fieldRes.records[0].get('f').properties.polygon;
        if (typeof fieldPolygon === 'string') {
          try { fieldPolygon = JSON.parse(fieldPolygon); } catch (e) {}
        }
      }
    }

    // Query POIs under this farm to identify wetlands/water sources
    const poisRes = await session.run(
      "MATCH (p:POI)-[:BELONGS_TO]->(:Farm {id: $farmId}) RETURN p.name AS name, p.type AS type, p.description AS description",
      { farmId }
    );
    const farmPois = poisRes.records.map(r => ({
      name: r.get('name') || '',
      type: r.get('type') || '',
      description: r.get('description') || ''
    }));

    const waterPois = farmPois.filter(p => 
      p.type === 'Water Source' || 
      p.type === 'Wetland' || 
      p.name.toLowerCase().includes('swamp') ||
      p.description.toLowerCase().includes('swamp')
    );

    let waterSourcesSection = '';
    if (waterPois.length > 0) {
      waterSourcesSection = `
- Documented Water Sources & Wetlands on this farm:
${waterPois.map(p => `  - "${p.name}" (${p.type}: ${p.description})`).join('\n')}
`;
    } else {
      waterSourcesSection = `
- Documented Water Sources & Wetlands: No active swamps, streams, creeks, or wetlands are documented on the farm records.
`;
    }

    let coords = [];
    if (Array.isArray(fieldPolygon)) {
      if (Array.isArray(fieldPolygon[0]) && Array.isArray(fieldPolygon[0][0])) {
        coords = fieldPolygon[0];
      } else {
        coords = fieldPolygon;
      }
    }

    // Try fetching satellite GEE metrics if possible
    let geeStats = null;
    if (coords && coords.length >= 3) {
      geeStats = await getGeeSatelliteStats(coords, settingsNode);
    }

    let geeStatsSection = '';
    if (geeStats) {
      const geeElevation = geeStats.elevation !== undefined && geeStats.elevation !== null ? Math.round(geeStats.elevation) : (elevation || 'Unknown');
      const geeHnd = geeStats.hnd !== undefined && geeStats.hnd !== null ? Number(geeStats.hnd.toFixed(2)) : 'Unknown';
      const geeSarVv = geeStats.sar_vv !== undefined && geeStats.sar_vv !== null ? Number(geeStats.sar_vv.toFixed(2)) : 'Unknown';
      const geeNdwi = geeStats.ndwi_dry !== undefined && geeStats.ndwi_dry !== null ? Number(geeStats.ndwi_dry.toFixed(3)) : 'Unknown';

      geeStatsSection = `
- GEE Satellite & Topographical Data for this field:
  - Average elevation (SRTM DEM): ${geeElevation} meters
  - Height Above Nearest Drainage (HND): ${geeHnd} meters (Low values e.g. <10m indicate valley floors or depression zones prone to water accumulation)
  - Sentinel-1 SAR Backscatter (VV): ${geeSarVv} dB (Values < -16 dB indicate presence of standing water or high soil moisture)
  - Sentinel-2 Dry Season NDWI (Water Index): ${geeNdwi} (Positive values indicate high surface moisture or standing water)
`;
    } else {
      geeStatsSection = `
- GEE Satellite & Topographical Data:
  - GEE services were temporarily unavailable or credentials were not configured. Please rely on the average field metadata: Elevation ${elevation}m and Soil Moisture ${soilMoisture} m³/m³ to guide recommendations.
`;
    }

    let cassavaRuleOverride = "";
    if (fieldName && fieldName.toLowerCase().includes('block c')) {
      cassavaRuleOverride = "\nCRITICAL OVERRIDE FOR THIS FIELD: The field is 'Block C' which is a low-elevation area where water flows in from detected waterways. You MUST NOT recommend Cassava for this field under any circumstances.\n";
    }

    let swampRiceRuleOverride = "";
    const parsedElevation = parseFloat(elevation);
    const isHighElevation = !isNaN(parsedElevation) && parsedElevation >= 120;
    if (isHighElevation) {
      swampRiceRuleOverride = `\nCRITICAL OVERRIDE FOR THIS FIELD: The field has a high median elevation of ${elevation}m where water does not pool and there is no swamp/wetland. You MUST NOT recommend Swamp Rice for this field under any circumstances. If rice is needed, suggest Upland Rice instead.\n`;
    }

    let largeFieldInstruction = "";
    const parsedArea = parseFloat(area);
    const isLargeField = (!isNaN(parsedArea) && parsedArea > 5) || 
                         (fieldName && fieldName.toLowerCase().includes('property')) ||
                         (fieldName && fieldName.toLowerCase().includes('nmk property'));
    if (isLargeField) {
      let minCrops = "4 to 6";
      let minZones = "4 to 6";
      if (!isNaN(parsedArea)) {
        if (parsedArea > 100) {
          minCrops = "6 to 9";
          minZones = "6 to 9";
        } else if (parsedArea > 20) {
          minCrops = "5 to 8";
          minZones = "5 to 8";
        }
      }
      largeFieldInstruction = `
CRITICAL GRANULARITY AND TOPOGRAPHY RULE FOR LARGE FIELDS (> 5 acres): 
Because this field is large (${area || '180'} acres), a simple 2 or 3 crop recommendation is insufficient. You MUST recommend a wider, more diverse variety of crops (at least ${minCrops} different crops) tailored to different zones of this field. 
You MUST select and distribute these crops to reflect the diversity of topography (slopes, hills, flatlands, and depressions), soil moisture variations, and elevation gradients across the field.
In the "fieldLayout" JSON block and the Markdown guide:
1. Divide the field layout into at least ${minZones} distinct crop zones/assignments, each mapped to different row ranges.
2. Distribute the crops logically based on the diversity of topography, soil moisture, and elevation in the field:
   - Upland/High Elevation (drier, higher slopes/hills/rolling hills): well-drained long-term or upland crops (Cassava, Cocoa, Oil Palm, Yam). Under no circumstances suggest Swamp Rice in these high elevation sloped areas.
   - Mid-lying/Gentle Slopes or rolling hills: vegetables, root tubers, and companion plants (Peppers, Okra, Fever Leaf, Basil, Sweet Potato, Cowpeas).
   - Lowland/Low Elevation (wettest flatlands, river runoffs/valleys): water-tolerant crops (Swamp Rice, Eddoe, Cocoyam).
3. MONO-CROPPING VS VEGETABLE ROTATION CONSTRAINT:
   - Mono-crop zones are acceptable ONLY for long-term crops and upland grain crops (e.g. Oil Palm, Cassava, Cocoa, Rice).
   - For vegetables and root tubers (e.g. Sweet Potato, Peppers, Fever Leaf, Okra), you MUST NOT recommend large single-crop mono-crop blocks (for example, never assign a large acreage zone like 10+ acres solely to a single vegetable crop like "Sweet Potato" on rolling hills or sloped terrain). Instead, you must specify a mixed crop zone or segment the rows more granularly to show crop rotation and intercropping combinations (e.g. mix/rotate Sweet Potato with nitrogen-fixing Groundnuts or Cowpeas and aromatic pest-repelling Peppers/Basil to preserve soil health). In the JSON crop assignments list, represent these vegetable rows as mixed rotation bands like "Sweet Potato / Cowpea" or "Pepper / Groundnut" or separate them into individual single rows to ensure a highly granular, rotation-friendly distribution.
4. Do not just recommend a few crops; ensure the recommendations are highly granular, diverse, and make full agronomic use of the different topographic elevation bands and soil moisture zones inside the field.
`;
    }

    let promptText = `You are an expert tropical agronomist specializing in West African agriculture, specifically Bomi County, Liberia.
Your task is to provide a comprehensive, actionable, and localized crop recommendation report for a specific field on a farm.

Please generate crop recommendations for the following field profile:
- Field Name: ${fieldName || 'Unnamed Field'}
- Area Size: ${area || 'Unknown'} acres
- Soil Type: ${soilType || 'Loam'}
- Irrigation Type: ${irrigation || 'None'}
- Current Status: ${status || 'Fallow'}
- Median Elevation: ${elevation || 'Unknown'} meters
- Average Soil Moisture: ${soilMoisture || 'Unknown'} m³/m³
- Geographic Location: ${location || 'Liberia'}
- Season: ${season || 'Rainy Season'}
- Farm Priorities: ${Array.isArray(priorities) ? priorities.join(', ') : (priorities || 'None specified')}
- Crop History: ${cropHistory || 'None specified'}
- Additional Notes: ${notes || 'None specified'}
- Model Start Date: ${startDate || 'Immediate'}
- Crops to Focus On: ${selectedCrops || 'High-profit cash crops in high demand in Bomi County and Monrovia markets (e.g. Fever Leaf, hot peppers/cayenne, Cassava, swamp/upland rice, eddoe, okra, and rotational cowpeas/groundnuts for soil health)'}
- USD/LRD Exchange Rate: 1 USD = ${exchangeRate || '150'} LRD (You must use this exact exchange rate for all conversions in your tables, text, and JSON calculations, e.g. price per kg or Fever Leaf price.)
${waterSourcesSection}
${geeStatsSection}
${largeFieldInstruction}

You must respond in Markdown format. The sections should be separated by H2 headings (##) which will be parsed into tabs.
The output structure must be EXACTLY:

## Agro-Ecological Overview
[Provide rich, detailed Markdown content for this section, structured with bullet points. Keep it localized for Bomi County, Liberia (agro-ecological thresholds, acidic soil correction, rainy/dry seasons, water logging or slopes). You MUST explicitly incorporate the field's specific elevation of ${elevation}m and average soil moisture of ${soilMoisture} m³/m³, along with the GEE satellite metrics, detailing their implications for local crop viability, microclimate, and slope runoff/drainage.]

## Recommended Crops
[Provide recommended crops details here. Detail which crops are chosen from the crops of interest: "${selectedCrops || 'specified crops'}" and other local agronomic fits. You MUST list the recommended crops in order from best to worst suitability/profitability. You MUST explicitly evaluate and justify crop selections by matching them against the field's specific physical characteristics: soil moisture, elevation, soil type, irrigation, and season. Use the following agro-ecological matching guidelines:
- Swamp Rice: Suited for lowland valley depressions/floodplains (low elevation, e.g., <110m) with high soil moisture saturation (>0.40 m³/m³) or high rainfall. You MUST NOT suggest Swamp Rice in highland or upland fields.
- Cassava / Yam: Suited ONLY for well-drained upland sloped hills (higher elevation, e.g., >160m) with moderate/low soil moisture (0.15 - 0.30 m³/m³).
- Oil Palm: Suited for flat/rolling plains (elevation 110m - 160m) with consistently high soil moisture (>0.35 m³/m³) but well-drained soil.
- Vegetables (such as Eddoe, Sweet Potato, Peppers, Fever Leaf): Suited for areas with moderate, consistent soil moisture (0.20 - 0.35 m³/m³) and manageable irrigation/drainage control. Vegetable areas MUST NOT be mono-cropped in large blocks. You MUST recommend a diverse, granular crop rotation scheme incorporating cover crops (e.g. Groundnuts, Cowpeas) to preserve soil health in rolling hills and sloped areas.

CRITICAL AGRONOMIC RULE FOR CASSAVA: You MUST NOT suggest Cassava if the field is in a low-elevation area (average elevation < 110 meters, or height above nearest drainage HND < 10 meters) where water can gather or accumulate in the rainy season. Cassava roots are extremely susceptible to rot and will die in waterlogged soils. In such low-lying fields, exclude Cassava and suggest swamp rice or other water-tolerant alternatives instead.
${cassavaRuleOverride}

CRITICAL AGRONOMIC RULE FOR SWAMP RICE: You MUST NOT suggest swamp rice if the field has no swamp, no wetland, and no water source nearby. If the water sources section indicates no documented water sources or swamps, or if the field name/notes do not specify a swamp, exclude swamp rice and recommend dry-land/upland crops or upland rice instead.
${swampRiceRuleOverride}

Detail how the field's specific elevation of ${elevation}m and soil moisture of ${soilMoisture} m³/m³, combined with soil type (${soilType}) and irrigation (${irrigation}) and GEE satellite telemetry, dictate the viability and ranked ordering of the recommended crops.]

## Cultivation Guide
[Provide the cultivation guides here for the selected crops. Customize the guidance according to the field's soil type (${soilType}), season (${season}), and irrigation type (${irrigation}).]

## Risk & Soil Management
[Provide the risk and soil management details here. Detail specific risks and mitigation strategies based on the field's physical factors:
- Elevation & Slopes: e.g., terracing, contours, runoff prevention if sloped (elev > 160m).
- Soil Moisture & Drainage: e.g., raised beds, drainage trenches if moisture is high (>0.40 m³/m³) or low-lying; mulching/irrigation if moisture is low (<0.20 m³/m³).
- Soil Type (${soilType}): e.g., compost/fertilization needs, pH correction (Liberian soils are often acidic latosols requiring ash or lime).
- Crop History (${cropHistory}) & Priorities (${Array.isArray(priorities) ? priorities.join(', ') : priorities}): e.g., rotational plans to prevent nutrient depletion.]

## Revenue Model
[Generate a high-margin, realistic revenue model for the ${area || 'specified'} acres starting on ${startDate || 'the specified start date'}. It should focus on targeting a higher annual gross revenue realistically based on local Liberian farming standards.]

## 12-Month Projections
[Generate a detailed 12-month high-margin projection table containing the following columns:
1. Month (e.g. Month 1, Month 2, ..., Month 12)
2. Crop(s)
3. Planting & Rotating Details
4. Harvest Information (Timing & actions)
5. Estimated Quantity Harvested (in kg or relevant units)
6. Price per kg in LD and USD (fluctuating according to seasonal scarcity)
7. Fever Leaf quantity (estimated number of bundles harvested, if Fever Leaf is modeled/relevant)
8. Fever Leaf price in LD and USD (per bundle, fluctuating)
9. Roll Totals (Monthly totals in USD)
Apply fluctuating market prices for each crop across different months to reflect real-world seasonal supply/demand. Provide the row totals and a final annual gross revenue total.]

## 2-Week Projections
[Generate a 2nd 12-month projection table using a 2-week interval breakdown (e.g., Week 1-2, Week 3-4, ..., Week 49-52) outlining planting, rotation, and harvest schedule details for each crop, emphasizing the operational flow.]

## Field Layout
[Generate a textual or ASCII representation and details of the agricultural field layout. In your layout design, you MUST:
1. Position crops strictly according to the physical conditions of the field: place water-tolerant/water-loving crops (such as Swamp Rice, Eddoe) in the lowest-elevation, highest soil-moisture zones (typically represented by the bottom/lowermost rows/beds); place leafy greens and vegetables (such as Fever Leaf, Sweet Potato, Peppers) in the mid-elevation, moderate-moisture zones; and place root crops or trees (such as Cassava, Yam, Cocoa, Oil Palm) in the highest-elevation, well-drained sloped zones (typically represented by the top/uppermost rows/beds).
2. Consider beneficial and positive positioning of crops that work well together by placing them in adjacent zones (adjacent rows or adjacent beds). For example, place nitrogen-fixing cover crops/legumes (e.g. Cowpeas, Groundnuts) directly adjacent to heavy nitrogen-consuming crops (e.g. leafy greens, Fever Leaf, Rice) to enrich the soil, and place aromatic pest-deterring crops (e.g. Peppers, Basil) directly adjacent to pest-vulnerable crops (e.g. Fever Leaf) to establish a natural protective barrier.
3. ONLY include crops that are recommended and considered good choices for the area in the Recommended Crops section above. You MUST NOT include crops in the layout that are not recommended or are excluded (e.g., do not place Cassava if the elevation is < 110m).
4. Generate this field layout details only AFTER the recommended crops list and their rankings have been generated.
5. Explicitly include intercropping details, showing how specific companion plants (like nitrogen-fixing legumes for soil building, or trap crops/pest-repelling flowers for natural pest control) are integrated.
6. Detail spacing guidelines (rows, beds, walkways in meters or feet) to ensure the main crop is not choked by the intercrops (e.g. tall main crops spaced so intercrops can grow beneath or beside them without choking them).]

Crucial: At the very end of your response, after the Field Layout section, output exactly one JSON code block enclosed in \`\`\`json and \`\`\`. This JSON block will fuel dynamic charts and interactive UI maps on the client side. The math in the JSON block must align perfectly with your tables above.
The JSON structure must match this template exactly:
\`\`\`json
{
  "annualRevenue": [
    { "crop": "Crop A", "revenue": 4500 },
    { "crop": "Crop B", "revenue": 3200 }
  ],
  "monthlyProjections": [
    { "month": "Month 1", "Crop A": 375, "Crop B": 260, "total": 635 },
    { "month": "Month 2", "Crop A": 380, "Crop B": 270, "total": 650 },
    { "month": "Month 3", "Crop A": 390, "Crop B": 280, "total": 670 },
    { "month": "Month 4", "Crop A": 400, "Crop B": 290, "total": 690 },
    { "month": "Month 5", "Crop A": 410, "Crop B": 300, "total": 710 },
    { "month": "Month 6", "Crop A": 420, "Crop B": 310, "total": 730 },
    { "month": "Month 7", "Crop A": 430, "Crop B": 320, "total": 750 },
    { "month": "Month 8", "Crop A": 440, "Crop B": 330, "total": 770 },
    { "month": "Month 9", "Crop A": 450, "Crop B": 340, "total": 790 },
    { "month": "Month 10", "Crop A": 460, "Crop B": 350, "total": 810 },
    { "month": "Month 11", "Crop A": 470, "Crop B": 360, "total": 830 },
    { "month": "Month 12", "Crop A": 480, "Crop B": 370, "total": 850 }
  ],
  "fieldLayout": {
    "rows": 10,
    "bedsPerRow": 4,
    "bedWidth": 1.2,
    "rowSpacing": 0.6,
    "cropAssignments": [
      { "crop": "Crop A", "color": "#2e7d32", "startRow": 0, "endRow": 4 },
      { "crop": "Crop B", "color": "#8d6e63", "startRow": 5, "endRow": 9 }
    ]
  }
}
\`\`\`
Ensure that:
1. "annualRevenue" contains all recommended crops (listed in order from best to worst matching/suitability) with their projected annual USD revenue.
2. "monthlyProjections" contains exactly 12 items (Month 1 to Month 12), with each crop's monthly revenue (using the exact crop names as keys) and the monthly total. Only include recommended crops.
3. "fieldLayout" specifies "rows" (between 6 and 15), "bedsPerRow" (between 2 and 6), "bedWidth" and "rowSpacing" in meters, and "cropAssignments" containing a color (hex code) and startRow/endRow (0-indexed ranges spanning from 0 to rows-1) mapping all crops. You MUST map the crops to row ranges based on the field's slope/gradient of changing elevation and moisture levels: Row 0 represents the highest, driest upland part of the field, and row indices increase down the slope, so that the last row represents the lowest, wettest lowland/runoff path. You MUST place upland crops (e.g. Cassava, Cocoa, Yam) at smaller row numbers (near Row 0), and lowland/water-tolerant crops (e.g. Swamp Rice, Eddoe) at larger row numbers (near the bottom rows). You MUST ensure that "cropAssignments" ONLY contains crops that are recommended. Do NOT place or assign any rows to crops that are not recommended for this field. You MUST use only deep, dark, rich high-contrast hex colors (such as deep forest green #1b5e20, dark chocolate brown #4e342e, rich blue #1565c0, dark crimson #b71c1c, deep plum purple #4a148c, dark teal #006064, dark orange #e65100) to ensure overlay white bold text is highly legible. Generate this layout mapping only after the recommended crops list and their ordering have been established.

Do not wrap the whole response in a JSON block or code blocks. Start directly with the first heading.`;

    // 2. Set streaming headers
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    if (provider === 'gemini') {
      if (!geminiKey) {
        return res.status(400).json({ error: 'Google Gemini API key is not configured in settings.' });
      }
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?key=${geminiKey}&alt=sse`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptText }] }]
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Gemini API Error: ${response.statusText} - ${errText}`);
      }

      let buffer = '';
      if (response.body.getReader) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          buffer = processSSEBuffer(buffer, 'gemini', res);
        }
      } else {
        for await (const chunk of response.body) {
          buffer += chunk.toString();
          buffer = processSSEBuffer(buffer, 'gemini', res);
        }
      }

      if (buffer.trim()) {
        processSSEBuffer(buffer + '\n', 'gemini', res);
      }
      res.end();
    } else {
      // Claude
      if (!claudeKey) {
        return res.status(400).json({ error: 'Anthropic Claude API key is not configured in settings.' });
      }
      const url = 'https://api.anthropic.com/v1/messages';
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': claudeKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 8000,
          system: 'You are an expert tropical agronomist. Respond in plain Markdown format directly matching the requested outline. Do not wrap the entire response in a JSON block, but ensure you include the requested JSON block code fence at the bottom of the message.',
          messages: [{ role: 'user', content: promptText }],
          stream: true
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Claude API Error: ${response.statusText} - ${errText}`);
      }

      let buffer = '';
      if (response.body.getReader) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          buffer = processSSEBuffer(buffer, 'claude', res);
        }
      } else {
        for await (const chunk of response.body) {
          buffer += chunk.toString();
          buffer = processSSEBuffer(buffer, 'claude', res);
        }
      }

      if (buffer.trim()) {
        processSSEBuffer(buffer + '\n', 'claude', res);
      }
      res.end();
    }
  } catch (err) {
    console.error('Failed to generate AI crop recommendations:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || 'AI Generation failed.' });
    } else {
      res.write(`\n\n[ERROR: ${err.message || 'AI Generation failed.'}]`);
      res.end();
    }
  } finally {
    await session.close();
  }
});

// Get Pest-Crop-Remedy relationships matrix
app.get('/api/pests/relationships', async (req, res) => {
  const session = driver.session();
  try {
    const query = `
      MATCH (c:Crop)--(p:Pest)--(r:Remedy) 
      RETURN distinct p.name as pestName, collect(distinct r.name) as remedies, collect(distinct c.name) as crops 
      ORDER BY p.name
    `;
    const result = await session.run(query);
    const list = result.records.map(record => ({
      pestName: record.get('pestName'),
      remedies: record.get('remedies') || [],
      crops: record.get('crops') || []
    }));
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    await session.close();
  }
});

// Get Crop-Pest-Remedy relationships matrix
app.get('/api/crops/relationships', async (req, res) => {
  const session = driver.session();
  try {
    const query = `
      MATCH (c:Crop)--(p:Pest)--(r:Remedy) 
      RETURN distinct c.name as cropName, p.name as pestName, collect(distinct r.name) as remedies 
      ORDER BY c.name
    `;
    const result = await session.run(query);
    const list = result.records.map(record => ({
      cropName: record.get('cropName'),
      pestName: record.get('pestName'),
      remedies: record.get('remedies') || []
    }));
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    await session.close();
  }
});

// AI Pest and Disease List Generator
app.post('/api/pests/retrieve-ai', async (req, res) => {
  const { farmId, email, crop } = req.body;

  const session = driver.session();
  try {
    if (email && !(await checkFarmAccess(session, email, farmId))) {
      return res.status(403).json({ error: 'Forbidden. You do not have access to this farm.' });
    }

    // 1. Fetch credentials from settings
    const settingsNode = await getSettingsNode(session, farmId);
    const provider = settingsNode.aiProvider || 'gemini';
    const geminiKey = settingsNode.geminiApiKey || '';
    const claudeKey = settingsNode.claudeApiKey || '';

    let promptText = `You are an expert tropical agriculturalist specializing in West African farming.
Generate a list of pests and diseases that commonly affect crops in Bomi County, Liberia.
${crop && crop !== 'All Crops' ? `Focus specifically on the crop: "${crop}".` : ''}

You MUST return the list as a valid JSON array of objects. Do NOT include any markdown code block formatting (like \`\`\`json) or other text. Start directly with [ and end with ].

Each object in the array must have the following fields:
- "name": The common name of the pest or disease (e.g., "Cassava Mosaic Disease", "African Armyworm").
- "type": Must be exactly either "Pest" or "Disease".
- "description": A concise description of the symptoms, damage caused, and how to identify it in the field.
- "treatment": A practical treatment protocol, organic/chemical controls, or prevention methods suitable for farmers in Bomi County, Liberia.

Provide at least 5 entries. Ensure names are precise, distinct, and treatments are highly actionable.`;

    let responseText = '';

    if (provider === 'gemini') {
      if (!geminiKey) {
        return res.status(400).json({ error: 'Google Gemini API key is not configured in settings.' });
      }
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptText }] }]
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Gemini API Error: ${response.statusText} - ${errText}`);
      }

      const resData = await response.json();
      responseText = resData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } else {
      // Claude
      if (!claudeKey) {
        return res.status(400).json({ error: 'Anthropic Claude API key is not configured in settings.' });
      }
      const url = 'https://api.anthropic.com/v1/messages';
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': claudeKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 4000,
          messages: [{ role: 'user', content: promptText }]
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Claude API Error: ${response.statusText} - ${errText}`);
      }

      const resData = await response.json();
      responseText = resData?.content?.[0]?.text || '';
    }

    let jsonText = responseText.trim();
    if (jsonText.startsWith('```')) {
      const match = jsonText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (match) {
        jsonText = match[1].trim();
      }
    }

    const aiPestsList = JSON.parse(jsonText);
    if (!Array.isArray(aiPestsList)) {
      throw new Error('AI response did not parse as a JSON array');
    }

    // 2. Fetch existing pests under this farm to avoid duplicates
    const existingPestsRes = await session.run(
      'MATCH (p:Pest)-[:BELONGS_TO]->(:Farm {id: $farmId}) RETURN p.name AS name',
      { farmId }
    );
    const existingNames = new Set(
      existingPestsRes.records.map(r => r.get('name').toLowerCase().trim())
    );

    // 3. Populate database with new retrieved pests (avoiding duplicates)
    const newPestsAdded = [];
    for (const pest of aiPestsList) {
      if (!pest || !pest.name) continue;
      const name = pest.name.trim();
      const nameNorm = name.toLowerCase();

      if (existingNames.has(nameNorm)) {
        continue; // duplicate, skip
      }

      const id = `pest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const type = pest.type === 'Disease' ? 'Disease' : 'Pest';
      const description = pest.description || '';
      const treatment = pest.treatment || '';

      await session.run(`
        MATCH (f:Farm {id: $farmId})
        MERGE (p:Pest {id: $id})
        SET p.name = $name,
            p.type = $type,
            p.description = $description,
            p.treatment = $treatment,
            p.lastUpdatedBy = $userEmail
        MERGE (p)-[:BELONGS_TO]->(f)
        RETURN p
      `, {
        farmId,
        id,
        name,
        type,
        description,
        treatment,
        userEmail: email || 'system-ai'
      });

      newPestsAdded.push({
        id,
        name,
        type,
        description,
        treatment
      });
      
      // Update local set during loop execution to catch duplicate names from AI itself
      existingNames.add(nameNorm);
    }

    res.json({ success: true, added: newPestsAdded });
  } catch (err) {
    console.error('Failed to retrieve AI pests list:', err);
    res.status(500).json({ error: err.message || 'AI Retrieve failed.' });
  } finally {
    await session.close();
  }
});

// AI Livestock Disease List Generator
app.post('/api/livestock-diseases/retrieve-ai', async (req, res) => {
  const { farmId, email } = req.body;

  const session = driver.session();
  try {
    if (email && !(await checkFarmAccess(session, email, farmId))) {
      return res.status(403).json({ error: 'Forbidden. You do not have access to this farm.' });
    }

    // 1. Fetch credentials from settings
    const settingsNode = await getSettingsNode(session, farmId);
    const provider = settingsNode.aiProvider || 'gemini';
    const geminiKey = settingsNode.geminiApiKey || '';
    const claudeKey = settingsNode.claudeApiKey || '';

    let promptText = `You are an expert tropical veterinary and livestock specialist specializing in West African farming.
Generate a list of livestock diseases and health issues that commonly affect animals (such as Goats, Sheep, Poultry, Pigs, Cattle, Rabbits) in Bomi County, Liberia.

You MUST return the list as a valid JSON array of objects. Do NOT include any markdown code block formatting (like \`\`\`json) or other text. Start directly with [ and end with ].

Each object in the array must have the following fields:
- "name": The common name of the disease or health issue (e.g., "Peste des Petits Ruminants (PPR)", "Newcastle Disease", "African Swine Fever").
- "description": A concise description of the symptoms, signs, and how to identify the infection or condition in the herd/flock.
- "treatment": A practical treatment protocol, veterinary controls, vaccinations, quarantine procedures, or management strategies suitable for farmers in Bomi County, Liberia.
- "animalTypes": A JSON array of strings specifying which types of animals are susceptible to this disease (choose from common types: "Goats", "Sheep", "Poultry", "Pigs", "Cattle", "Rabbits").

Provide at least 5 entries. Ensure names are precise, distinct, and protocols are highly actionable.`;

    let responseText = '';

    if (provider === 'gemini') {
      if (!geminiKey) {
        return res.status(400).json({ error: 'Google Gemini API key is not configured in settings.' });
      }
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptText }] }]
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Gemini API Error: ${response.statusText} - ${errText}`);
      }

      const resData = await response.json();
      responseText = resData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } else {
      // Claude
      if (!claudeKey) {
        return res.status(400).json({ error: 'Anthropic Claude API key is not configured in settings.' });
      }
      const url = 'https://api.anthropic.com/v1/messages';
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': claudeKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 4000,
          messages: [{ role: 'user', content: promptText }]
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Claude API Error: ${response.statusText} - ${errText}`);
      }

      const resData = await response.json();
      responseText = resData?.content?.[0]?.text || '';
    }

    let jsonText = responseText.trim();
    if (jsonText.startsWith('```')) {
      const match = jsonText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (match) {
        jsonText = match[1].trim();
      }
    }

    let aiDiseasesList;
    try {
      aiDiseasesList = JSON.parse(jsonText);
    } catch (parseErr) {
      console.error('Failed to parse JSON from AI. Text length:', jsonText.length);
      console.error('First 200 chars:', jsonText.substring(0, Math.min(200, jsonText.length)));
      console.error('Last 200 chars:', jsonText.substring(Math.max(0, jsonText.length - 200)));
      throw new Error(`AI response did not parse as a JSON array: ${parseErr.message}`);
    }
    if (!Array.isArray(aiDiseasesList)) {
      throw new Error('AI response did not parse as a JSON array');
    }

    // 2. Fetch existing diseases under this farm to avoid duplicates
    const existingDiseasesRes = await session.run(
      'MATCH (d:LivestockDisease)-[:BELONGS_TO]->(:Farm {id: $farmId}) RETURN d.name AS name',
      { farmId }
    );
    const existingNames = new Set(
      existingDiseasesRes.records.map(r => r.get('name').toLowerCase().trim())
    );

    // 3. Populate database with new retrieved diseases (avoiding duplicates)
    const newDiseasesAdded = [];
    for (const disease of aiDiseasesList) {
      if (!disease || !disease.name) continue;
      const name = disease.name.trim();
      const nameNorm = name.toLowerCase();

      if (existingNames.has(nameNorm)) {
        continue; // duplicate, skip
      }

      const id = `ldisease_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const description = disease.description || '';
      const treatment = disease.treatment || '';
      const animalTypes = Array.isArray(disease.animalTypes) ? disease.animalTypes : [];

      await session.run(`
        MATCH (f:Farm {id: $farmId})
        MERGE (d:LivestockDisease {id: $id})
        SET d.name = $name,
            d.description = $description,
            d.treatment = $treatment,
            d.animalTypes = $animalTypes,
            d.lastUpdatedBy = $userEmail
        MERGE (d)-[:BELONGS_TO]->(f)
        RETURN d
      `, {
        farmId,
        id,
        name,
        description,
        treatment,
        animalTypes: JSON.stringify(animalTypes),
        userEmail: email || 'system-ai'
      });

      newDiseasesAdded.push({
        id,
        name,
        description,
        treatment,
        animalTypes
      });
      
      // Update local set during loop execution to catch duplicate names from AI itself
      existingNames.add(nameNorm);
    }

    res.json({ success: true, added: newDiseasesAdded });
  } catch (err) {
    console.error('Failed to retrieve AI livestock diseases:', err);
    res.status(500).json({ error: err.message || 'AI Retrieve failed.' });
  } finally {
    await session.close();
  }
});

app.get('/api/employees/:id/connections', async (req, res) => {
  const { id } = req.params;
  const session = driver.session();
  try {
    const result = await session.run(`
      MATCH (e:Employee {id: $id})-[r]-(connected)
      WHERE NOT connected:Farm
      RETURN DISTINCT labels(connected) AS labels, count(connected) AS cnt
    `, { id });
    
    const connections = result.records.map(rec => ({
      labels: rec.get('labels'),
      count: rec.get('cnt').toNumber()
    }));
    
    res.json({ success: true, connections });
  } catch (error) {
    console.error('Failed to fetch employee connections:', error);
    res.status(500).json({ error: error.message });
  } finally {
    await session.close();
  }
});

// Global Data Hydration
app.get('/api/all-data', async (req, res) => {
  const session = driver.session();
  const farmId = req.query.farmId || 'default_farm';
  const email = req.query.email;
  try {
    if (email && !(await checkFarmAccess(session, email, farmId))) {
      return res.status(403).json({ error: 'Forbidden. You do not have access to this farm.' });
    }
    // Ensure settings exist for this farm
    await getSettingsNode(session, farmId);

    const collections = {
       fields: 'MATCH (n:Field)-[:BELONGS_TO]->(:Farm {id: $farmId}) RETURN n',
       nurseries: 'MATCH (n:NurseryBed)-[:BELONGS_TO]->(:Farm {id: $farmId}) RETURN n',
       crops: 'MATCH (n:Crop)-[:BELONGS_TO]->(:Farm {id: $farmId}) RETURN n',
       livestock: 'MATCH (n:Livestock)-[:BELONGS_TO]->(:Farm {id: $farmId}) RETURN n',
       equipment: 'MATCH (n:Equipment)-[:BELONGS_TO]->(:Farm {id: $farmId}) RETURN n',
       assignments: 'MATCH (n:TaskAssignment)-[:BELONGS_TO]->(:Farm {id: $farmId}) RETURN n',
       employees: 'MATCH (n:Employee)-[:BELONGS_TO]->(:Farm {id: $farmId}) RETURN n',
       financials: 'MATCH (n:Transaction)-[:BELONGS_TO]->(:Farm {id: $farmId}) RETURN n',
       budgets: 'MATCH (n:Budget)-[:BELONGS_TO]->(:Farm {id: $farmId}) OPTIONAL MATCH (n)-[:CONTAINS]->(i:BudgetItem) RETURN n, collect(i) as items',
       incidents: 'MATCH (n:Incident)-[:BELONGS_TO]->(:Farm {id: $farmId}) RETURN n',
       deadlines: 'MATCH (n:Deadline)-[:BELONGS_TO]->(:Farm {id: $farmId}) RETURN n',
       gps: 'MATCH (n:GpsLog)-[:BELONGS_TO]->(:Farm {id: $farmId}) RETURN n',
       audit: 'MATCH (n:AuditLog)-[:BELONGS_TO]->(:Farm {id: $farmId}) RETURN n',
       users: 'MATCH (n:User)-[r:BELONGS_TO]->(:Farm {id: $farmId}) RETURN n, r',
       harvests: 'MATCH (n:Harvest)-[:BELONGS_TO]->(:Farm {id: $farmId}) RETURN n',
       kits: 'MATCH (n:LivestockKit)-[:BELONGS_TO]->(:Farm {id: $farmId}) RETURN n',
       breeding: 'MATCH (n:BreedingEvent)-[:BELONGS_TO]->(:Farm {id: $farmId}) RETURN n',
       settings: "MATCH (n:GlobalSettings)-[:BELONGS_TO]->(:Farm {id: $farmId}) RETURN n ORDER BY CASE WHEN n.id = 'settings_' + $farmId THEN 0 ELSE 1 END LIMIT 1",
       pests: 'MATCH (n:Pest)-[:BELONGS_TO]->(:Farm {id: $farmId}) RETURN n',
       soilTests: 'MATCH (n:SoilTest)-[:BELONGS_TO]->(:Farm {id: $farmId}) RETURN n',
       goals: 'MATCH (n:Goal)-[:BELONGS_TO]->(:Farm {id: $farmId}) RETURN n',
       objectives: 'MATCH (n:Objective)-[:BELONGS_TO]->(:Farm {id: $farmId}) RETURN n',
       livestockDiseases: 'MATCH (n:LivestockDisease)-[:BELONGS_TO]->(:Farm {id: $farmId}) RETURN n',
       poi: 'MATCH (n:PointOfInterest)-[:BELONGS_TO]->(:Farm {id: $farmId}) RETURN n',
       recommendations: 'MATCH (n:Recommendation)-[:BELONGS_TO]->(:Farm {id: $farmId}) RETURN n',
       payroll: 'MATCH (n:Payroll)-[:BELONGS_TO]->(:Farm {id: $farmId}) RETURN n',
       charcoalAlerts: 'MATCH (n:CharcoalAlert)-[:BELONGS_TO]->(:Farm {id: $farmId}) RETURN n'
    };

    const data = {};
    for (const [key, query] of Object.entries(collections)) {
       const result = await session.run(query, { farmId });
       data[key] = result.records.map(r => {
           const props = r.get('n').properties;
           if (key === 'budgets') {
               const itemsVal = r.get('items');
               props.items = Array.isArray(itemsVal) ? itemsVal.map(i => i.properties) : [];
           }
           if (key === 'users') {
               const relVal = r.get('r');
               if (relVal) {
                   const rProps = relVal.properties;
                   props.role = rProps.role || props.role || 'Staff';
                   if (rProps.allowedTabs !== undefined) props.allowedTabs = rProps.allowedTabs;
                   if (rProps.canApprove !== undefined) props.canApprove = rProps.canApprove;
               }
           }
           // Parse JSON strings back to objects (e.g. polygon)
           if (props.polygon) {
               try { props.polygon = JSON.parse(props.polygon); } catch(e){}
           }
           if (props.boundary) {
               try { props.boundary = JSON.parse(props.boundary); } catch(e){}
           }
           if (props.points) {
               try { props.points = JSON.parse(props.points); } catch(e){}
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
           if (props.promptInputs) {
               try { props.promptInputs = JSON.parse(props.promptInputs); } catch(e){}
           }
           if (props.responseTabs) {
               try { props.responseTabs = JSON.parse(props.responseTabs); } catch(e){}
           }
           if (props.structuredData) {
               try { props.structuredData = JSON.parse(props.structuredData); } catch(e){}
           }
           if (props.pestIds) {
               try { props.pestIds = JSON.parse(props.pestIds); } catch(e){}
           }
           if (props.testResults) {
               try { props.testResults = JSON.parse(props.testResults); } catch(e){}
           }
           if (props.workerIds) {
               try { props.workerIds = JSON.parse(props.workerIds); } catch(e){}
           }
           if (props.workerCount !== undefined && typeof props.workerCount === 'object' && props.workerCount.low !== undefined) {
               props.workerCount = props.workerCount.low;
           }
           if (props.animalTypes) {
               try { props.animalTypes = JSON.parse(props.animalTypes); } catch(e){}
           }
           if (key === 'settings') {
               ['units', 'jobTitles', 'kmlUrls', 'mapCenter', 'expenseCategories', 'incomeCategories', 'animalTypes', 'nonWorkdays', 'workdays'].forEach(field => {
                   if (props[field] && typeof props[field] === 'string') {
                       try { props[field] = JSON.parse(props[field]); } catch(e) {}
                   }
               });
           }
           if (key === 'poi') {
               ['zoomLevel', 'mapElevation'].forEach(field => {
                   if (props[field] !== undefined && props[field] !== null) {
                       if (typeof props[field] === 'object' && props[field].low !== undefined) {
                           props[field] = props[field].low;
                       } else {
                           props[field] = Number(props[field]);
                       }
                   }
               });
           }
           return props;
       });
    }

    // Also fetch admin boundaries to expose them as virtual fields
    try {
      const boundariesResult = await session.run('MATCH (b:AdminBoundary) RETURN b');
      const virtualFields = boundariesResult.records.map(record => {
        const b = record.get('b').properties;
        let geojson = {};
        try {
          geojson = JSON.parse(b.geojson);
        } catch (e) {}
        
        let polygonCoords = [];
        if (geojson.geometry) {
          const type = geojson.geometry.type;
          const coords = geojson.geometry.coordinates;
          if (type === 'Polygon' && Array.isArray(coords) && coords.length > 0) {
            polygonCoords = coords[0].map(pt => [pt[1], pt[0]]);
          } else if (type === 'MultiPolygon' && Array.isArray(coords) && coords.length > 0) {
            polygonCoords = coords[0][0].map(pt => [pt[1], pt[0]]);
          }
        }
        
        return {
          id: b.id,
          name: `${b.level === 1 ? 'County' : 'District'}: ${b.name || 'Unnamed Boundary'}`,
          area: 500,
          soil_type: 'Clay Loam (Admin Boundary)',
          irrigation: 'Rainfed',
          status: 'Active',
          year: 2026,
          polygon: polygonCoords, // parsed array (since data loader parses strings back to objects)
          isVirtual: true,
          adminLevel: b.level
        };
      });
      data.fields = [...(data.fields || []), ...virtualFields];
    } catch (e) {
      console.warn('Failed to load boundaries for all-data:', e.message);
    }

    res.json(data);
  } catch (err) {
    console.warn('Failed to fetch all data:', err.message);
    res.status(200).json({ ok: false, error: 'DATABASE_UNAVAILABLE', details: err.message });
  } finally {
    await session.close();
  }
});

// Process Offline Actions Sync Queue
app.post('/api/sync', async (req, res) => {
  const { queue, farmId, email } = req.body;
  const activeFarmId = farmId || 'default_farm';
  if (!queue || !Array.isArray(queue)) {
    return res.status(400).json({ error: 'Invalid queue format' });
  }

  const session = driver.session();
  try {
    if (email && !(await checkFarmAccess(session, email, activeFarmId))) {
      return res.status(403).json({ error: 'Forbidden. You do not have access to this farm.' });
    }
    const results = [];
    const updatedIds = [];
    
    // Extract and bulk process GPS logs for extreme performance optimization
    const gpsActions = queue.filter(a => a.type === 'gps/addLocation');
    const remainingActions = queue.filter(a => a.type !== 'gps/addLocation');

    if (gpsActions.length > 0) {
      try {
        const events = gpsActions.map(action => ({
          ...action.payload,
          userEmail: (action.payload && action.payload.lastUpdatedBy) ? action.payload.lastUpdatedBy : (action.payload.userEmail || 'system')
        }));
        
        await session.run(`
          MATCH (f:Farm {id: $activeFarmId})
          UNWIND $events AS event
          MERGE (g:GpsLog {id: event.id})
          SET g.lat = event.lat, g.lng = event.lng, g.timestamp = event.timestamp, g.userEmail = event.userEmail
          MERGE (g)-[:BELONGS_TO]->(f)
          WITH g, event
          OPTIONAL MATCH (u:User {email: event.userEmail})
          FOREACH (ignoreMe IN CASE WHEN u IS NOT NULL THEN [1] ELSE [] END |
            MERGE (u)-[r1:LOGGED_LOCATION]->(g) SET r1.lastUpdatedBy = event.userEmail
          )
          SET g.lastUpdatedBy = event.userEmail
        `, { events, activeFarmId });
        
        gpsActions.forEach(action => {
          if (action.payload && action.payload.id) {
            updatedIds.push(action.payload.id);
          }
          results.push({ actionId: action.meta?.id, status: 'success' });
        });
      } catch (err) {
        console.error('Failed to bulk process GPS logs:', err.message);
        gpsActions.forEach(action => {
          results.push({ actionId: action.meta?.id, status: 'error', message: err.message });
        });
      }
    }

    // Run remaining actions sequentially to maintain order and data integrity
    for (const action of remainingActions) {
      try {
        const userEmail = (action.payload && action.payload.lastUpdatedBy) ? action.payload.lastUpdatedBy : 'system';
        if (action.type !== 'core/deleteNode') {
          if (action.payload && action.payload.id) {
            updatedIds.push(action.payload.id);
          } else if (action.type === 'budgets/upsertBudgetItem' && action.payload && action.payload.item && action.payload.item.id) {
            updatedIds.push(action.payload.item.id);
          }
        }
        if (action.type === 'fields/addField') {
          const { id, name, area, soil_type, irrigation, status, year, polygon, drawColor, updatedAt } = action.payload;
          // Merge so we don't recreate if it exists somehow
          await session.run(
            'MERGE (f:Field {id: $id}) SET f.name = $name, f.area = $area, f.soil_type = $soil_type, f.irrigation = $irrigation, f.status = $status, f.year = $year, f.polygon = $polygon, f.drawColor = $drawColor, f.updatedAt = toInteger($updatedAt) RETURN f', { userEmail, id, name, area, soil_type, irrigation, status, year, polygon: (typeof polygon === 'string') ? polygon : (polygon ? JSON.stringify(polygon) : null), drawColor: drawColor || null, updatedAt: updatedAt || Date.now() }
          );
          results.push({ actionId: action.meta?.id, status: 'success' });
        }
        else if (action.type === 'nurseries/addBed') {
          const { id, name, capacity, status, polygon, drawColor, updatedAt } = action.payload;
          await session.run(
            'MERGE (n:NurseryBed {id: $id}) SET n.name = $name, n.capacity = $capacity, n.status = $status, n.polygon = $polygon, n.drawColor = $drawColor, n.updatedAt = toInteger($updatedAt) RETURN n', { userEmail, id, name, capacity, status, polygon: (typeof polygon === 'string') ? polygon : (polygon ? JSON.stringify(polygon) : null), drawColor: drawColor || null, updatedAt: updatedAt || Date.now() }
          );
          results.push({ actionId: action.meta?.id, status: 'success' });
        }

        else if (action.type === 'assets/addCrop') {
          const { id, name, variety, fieldId, plantingDate, expectedHarvest, seedingRate, targetYield, sowType, phHi, phLo, pestIds, updatedAt } = action.payload;

          if (sowType === 'Nursery') {
            await session.run(`
              MERGE (c:Crop {id: $id}) 
              SET c.name = $name, c.variety = $variety, c.fieldId = $fieldId, c.sowType = $sowType,
                  c.plantingDate = $plantingDate, c.expectedHarvest = $expectedHarvest, 
                  c.seedingRate = $seedingRate, c.targetYield = $targetYield,
                  c.phHi = toFloat($phHi), c.phLo = toFloat($phLo), c.pestIds = $pestIds,
                  c.updatedAt = toInteger($updatedAt)
              WITH c 
              OPTIONAL MATCH (c)-[r1:SOWN_IN]->() DELETE r1
              WITH c
              OPTIONAL MATCH (c)-[r2:PLANTED_IN]->() DELETE r2
              WITH c
              OPTIONAL MATCH (n:NurseryBed {id: $fieldId}) 
              FOREACH (ignore IN CASE WHEN n IS NOT NULL THEN [1] ELSE [] END | MERGE (c)-[rel_new:SOWN_IN]->(n) SET rel_new.lastUpdatedBy = $userEmail)
              WITH c
              OPTIONAL MATCH (c)-[r3:AFFECTED_BY]->() DELETE r3
              WITH c
              UNWIND (CASE WHEN size($pestIdList) > 0 THEN $pestIdList ELSE [null] END) AS pId
              OPTIONAL MATCH (p:Pest {id: pId})
              FOREACH (ignore IN CASE WHEN p IS NOT NULL THEN [1] ELSE [] END | MERGE (c)-[rel_new:AFFECTED_BY]->(p) SET rel_new.lastUpdatedBy = $userEmail)
              SET c.lastUpdatedBy = $userEmail RETURN c
            `, { userEmail, id, name, variety, fieldId, plantingDate, expectedHarvest, seedingRate, targetYield, sowType, phHi: phHi || null, phLo: phLo || null, pestIds: pestIds ? JSON.stringify(pestIds) : '[]', pestIdList: pestIds || [], updatedAt: updatedAt || Date.now() });
          } else {
            await session.run(`
              MERGE (c:Crop {id: $id}) 
              SET c.name = $name, c.variety = $variety, c.fieldId = $fieldId, c.sowType = $sowType,
                  c.plantingDate = $plantingDate, c.expectedHarvest = $expectedHarvest, 
                  c.seedingRate = $seedingRate, c.targetYield = $targetYield,
                  c.phHi = toFloat($phHi), c.phLo = toFloat($phLo), c.pestIds = $pestIds,
                  c.updatedAt = toInteger($updatedAt)
              WITH c 
              OPTIONAL MATCH (c)-[r1:SOWN_IN]->() DELETE r1
              WITH c
              OPTIONAL MATCH (c)-[r2:PLANTED_IN]->() DELETE r2
              WITH c
              OPTIONAL MATCH (f:Field {id: $fieldId}) 
              FOREACH (ignore IN CASE WHEN f IS NOT NULL THEN [1] ELSE [] END | MERGE (c)-[rel_new:PLANTED_IN]->(f) SET rel_new.lastUpdatedBy = $userEmail)
              WITH c
              OPTIONAL MATCH (c)-[r3:AFFECTED_BY]->() DELETE r3
              WITH c
              UNWIND (CASE WHEN size($pestIdList) > 0 THEN $pestIdList ELSE [null] END) AS pId
              OPTIONAL MATCH (p:Pest {id: pId})
              FOREACH (ignore IN CASE WHEN p IS NOT NULL THEN [1] ELSE [] END | MERGE (c)-[rel_new:AFFECTED_BY]->(p) SET rel_new.lastUpdatedBy = $userEmail)
              SET c.lastUpdatedBy = $userEmail RETURN c
            `, { userEmail, id, name, variety, fieldId, plantingDate, expectedHarvest, seedingRate, targetYield, sowType, phHi: phHi || null, phLo: phLo || null, pestIds: pestIds ? JSON.stringify(pestIds) : '[]', pestIdList: pestIds || [], updatedAt: updatedAt || Date.now() });
          }

          results.push({ actionId: action.meta?.id, status: 'success' });
        }
        else if (action.type === 'assets/transplantCrop') {
          const { id, fieldId, transplantDate, updatedAt } = action.payload;
          await session.run(`
            MERGE (c:Crop {id: $id})
            SET c.updatedAt = toInteger($updatedAt)
            WITH c
            OPTIONAL MATCH (c)-[r1:TRANSPLANTED_TO]->() DELETE r1
            WITH c
            OPTIONAL MATCH (f:Field {id: $fieldId})
            FOREACH (ignore IN CASE WHEN f IS NOT NULL THEN [1] ELSE [] END |
              MERGE (c)-[r:TRANSPLANTED_TO]->(f)
              SET r.date = $transplantDate
            )
            SET c.lastUpdatedBy = $userEmail RETURN c
          `, { userEmail, id, fieldId, transplantDate, updatedAt: updatedAt || Date.now() });
          results.push({ actionId: action.meta?.id, status: 'success' });
        }
        else if (action.type === 'assets/addLivestock') {
          const { id, fieldId, type: animalType, breed, birthDate, tagNumber, healthStatus, causeOfDeath, medicalRecords, updatedAt } = action.payload;
          await session.run(`
            MERGE (l:Livestock {id: $id})
            SET l.type = $animalType, l.breed = $breed, l.birthDate = $birthDate, 
                l.tagNumber = $tagNumber, l.healthStatus = $healthStatus, l.fieldId = $fieldId, l.causeOfDeath = $causeOfDeath,
                l.medicalRecords = $medicalRecords, l.updatedAt = toInteger($updatedAt)
            WITH l
            OPTIONAL MATCH (l)-[r:LOCATED_IN]->() DELETE r
            WITH l
            OPTIONAL MATCH (f:Field {id: $fieldId})
            FOREACH (ignoreMe IN CASE WHEN f IS NOT NULL THEN [1] ELSE [] END |
              MERGE (l)-[:LOCATED_IN]->(f)
            )
            SET l.lastUpdatedBy = $userEmail RETURN l
          `, { userEmail, id, animalType, breed, birthDate, tagNumber, healthStatus, fieldId, causeOfDeath: causeOfDeath || '', medicalRecords: medicalRecords ? JSON.stringify(medicalRecords) : '[]', updatedAt: updatedAt || Date.now() });
          results.push({ actionId: action.meta?.id, status: 'success' });
        }
        else if (action.type === 'breeding/addEvent' || action.type === 'breeding/updateEvent') {
          const { id, motherId, fatherId, matingDate, expectedDueDate, status, offspringCount, notes } = action.payload;
          await session.run(`
            MERGE (b:BreedingEvent {id: $id})
            SET b.motherId = $motherId, b.fatherId = $fatherId, b.matingDate = $matingDate,
                b.expectedDueDate = $expectedDueDate, b.status = $status, 
                b.offspringCount = $offspringCount, b.notes = $notes
            WITH b
            OPTIONAL MATCH (b)-[r1:HAS_MOTHER]->() DELETE r1
            WITH b
            OPTIONAL MATCH (m:Livestock {id: $motherId})
            FOREACH (ignore IN CASE WHEN m IS NOT NULL THEN [1] ELSE [] END | MERGE (b)-[rel_new:HAS_MOTHER]->(m) SET rel_new.lastUpdatedBy = $userEmail)
            WITH b
            OPTIONAL MATCH (b)-[r2:HAS_FATHER]->() DELETE r2
            WITH b
            OPTIONAL MATCH (f:Livestock {id: $fatherId})
            FOREACH (ignore IN CASE WHEN f IS NOT NULL THEN [1] ELSE [] END | MERGE (b)-[rel_new:HAS_FATHER]->(f) SET rel_new.lastUpdatedBy = $userEmail)
            SET b.lastUpdatedBy = $userEmail RETURN b
          `, { userEmail, id, motherId, fatherId: fatherId || '', matingDate, expectedDueDate, status, offspringCount: offspringCount || 0, notes: notes || '' });
          results.push({ actionId: action.meta?.id, status: 'success' });
        }
        else if (action.type === 'assets/addKit') {
          const { id, motherId, birthDate, type, breed, fieldId, numberOfKits, healthStatus, notes } = action.payload;
          await session.run(`
            MERGE (k:LivestockKit {id: $id})
            SET k.motherId = $motherId, k.birthDate = $birthDate, k.type = $type,
                k.breed = $breed, k.fieldId = $fieldId, k.numberOfKits = $numberOfKits,
                k.healthStatus = $healthStatus, k.notes = $notes
            WITH k
            OPTIONAL MATCH (k)-[r1:BORN_FROM]->() DELETE r1
            WITH k
            OPTIONAL MATCH (m:Livestock {id: $motherId})
            FOREACH (ignore IN CASE WHEN m IS NOT NULL THEN [1] ELSE [] END | MERGE (k)-[rel_new:BORN_FROM]->(m) SET rel_new.lastUpdatedBy = $userEmail)
            WITH k
            OPTIONAL MATCH (k)-[r2:LOCATED_IN]->() DELETE r2
            WITH k
            OPTIONAL MATCH (f:Field {id: $fieldId})
            FOREACH (ignore IN CASE WHEN f IS NOT NULL THEN [1] ELSE [] END | MERGE (k)-[rel_new:LOCATED_IN]->(f) SET rel_new.lastUpdatedBy = $userEmail)
            SET k.lastUpdatedBy = $userEmail RETURN k
          `, { userEmail, id, motherId, birthDate, type, breed, fieldId, numberOfKits, healthStatus, notes: notes || '' });
          results.push({ actionId: action.meta?.id, status: 'success' });
        }
        else if (action.type === 'assets/addHarvest') {
          const { id, amount, unit, date, cropId } = action.payload;
          await session.run(`
            MERGE (h:Harvest {id: $id})
            SET h.amount = toFloat($amount), h.unit = $unit, h.date = $date, h.cropId = $cropId
            WITH h
            OPTIONAL MATCH (h)-[r1:HARVESTED_FROM]->() DELETE r1
            WITH h
            OPTIONAL MATCH (c:Crop {id: $cropId})
            FOREACH (ignoreMe IN CASE WHEN c IS NOT NULL THEN [1] ELSE [] END |
              MERGE (h)-[:HARVESTED_FROM]->(c)
            )
            SET h.lastUpdatedBy = $userEmail RETURN h
          `, { userEmail, id, amount, unit, date, cropId });
          results.push({ actionId: action.meta?.id, status: 'success' });
        }
        else if (action.type === 'poi/addPoi') {
          const { id, name, type, description, area, length, points, drawColor, isLine, country, region, county, city, zoomLevel, mapElevation, createdBy, updatedAt } = action.payload;
          await session.run(`
            MERGE (n:PointOfInterest {id: $id})
            ON CREATE SET n.createdBy = $createdBy, n.createdAt = datetime()
            SET n.name = $name, n.type = $type, n.description = $description,
                n.area = $area, n.length = $length, n.points = $points, n.drawColor = $drawColor,
                n.isLine = $isLine, n.country = $country, n.region = $region,
                n.county = $county, n.city = $city,
                n.zoomLevel = toInteger($zoomLevel), n.mapElevation = toFloat($mapElevation),
                n.lastUpdatedBy = $userEmail, n.lastUpdatedAt = datetime(),
                n.updatedAt = toInteger($updatedAt)
            RETURN n
          `, { 
            userEmail, 
            id, 
            name: name || '', 
            type: type || '', 
            description: description || '', 
            area: area || '', 
            length: length || '', 
            points: (typeof points === 'string') ? points : (points ? JSON.stringify(points) : '[]'),
            drawColor: drawColor || null,
            isLine: isLine === true || isLine === 'true',
            country: country || '',
            region: region || '',
            county: county || '',
            city: city || '',
            zoomLevel: zoomLevel !== undefined ? zoomLevel : null,
            mapElevation: mapElevation !== undefined ? mapElevation : null,
            createdBy: createdBy || userEmail,
            updatedAt: updatedAt || Date.now()
          });
          results.push({ actionId: action.meta?.id, status: 'success' });
        }
        else if (action.type === 'recommendations/addRecommendation') {
          const { id, name, link, active, isAI, promptInputs, responseTabs, structuredData, createdAt } = action.payload;
          await session.run(`
            MERGE (r:Recommendation {id: $id})
            SET r.name = $name, r.link = $link, r.active = $active,
                r.isAI = $isAI, r.promptInputs = $promptInputs, r.responseTabs = $responseTabs,
                r.structuredData = $structuredData,
                r.createdAt = toInteger($createdAt), r.lastUpdatedBy = $userEmail
            RETURN r
          `, {
            userEmail,
            id,
            name: name || '',
            link: link || '',
            active: active !== false,
            isAI: isAI || false,
            promptInputs: promptInputs ? (typeof promptInputs === 'string' ? promptInputs : JSON.stringify(promptInputs)) : null,
            responseTabs: responseTabs ? (typeof responseTabs === 'string' ? responseTabs : JSON.stringify(responseTabs)) : null,
            structuredData: structuredData ? (typeof structuredData === 'string' ? structuredData : JSON.stringify(structuredData)) : null,
            createdAt: createdAt || Date.now()
          });
          results.push({ actionId: action.meta?.id, status: 'success' });
        }
        else if (action.type === 'financials/addTransaction') {
          const { id, txType, category, amount, amountLd, exchangeRate, date, vendor, notes, assetId } = action.payload;
          await session.run(`
            MERGE (t:Transaction {id: $id})
            SET t.txType = $txType, t.category = $category, t.amount = $amount, 
                t.amountLd = $amountLd, t.exchangeRate = $exchangeRate,
                t.date = $date, t.vendor = $vendor, t.notes = $notes, t.assetId = $assetId
            WITH t
            OPTIONAL MATCH (t)-[r1:OF_CATEGORY]->() DELETE r1
            WITH t
            OPTIONAL MATCH (c:TransactionCategory {name: $category})
            FOREACH (ignore IN CASE WHEN c IS NULL AND $category <> "" THEN [1] ELSE [] END | MERGE (newC:TransactionCategory {name: $category}) SET newC.lastUpdatedBy = $userEmail MERGE (t)-[r1:OF_CATEGORY]->(newC) SET r1.lastUpdatedBy = $userEmail)
            FOREACH (ignore IN CASE WHEN c IS NOT NULL THEN [1] ELSE [] END | MERGE (t)-[rel_new:OF_CATEGORY]->(c) SET rel_new.lastUpdatedBy = $userEmail)
            WITH t
            OPTIONAL MATCH (t)-[r2:RELATED_TO]->() DELETE r2
            WITH t
            OPTIONAL MATCH (asset {id: $assetId})
            FOREACH (ignoreMe IN CASE WHEN asset IS NOT NULL THEN [1] ELSE [] END |
              MERGE (t)-[r2:RELATED_TO]->(asset) SET r2.lastUpdatedBy = $userEmail
            )
            SET t.lastUpdatedBy = $userEmail RETURN t
          `, { userEmail, id, txType, category, amount, amountLd: amountLd || '', exchangeRate: exchangeRate || '', date, vendor, notes, assetId: assetId || '' });
          results.push({ actionId: action.meta?.id, status: 'success' });
        }
        else if (action.type === 'activities/addActivity') {
          const { id, type: activityType, targetId, date, plannedDate, personResponsible, notes } = action.payload;
          await session.run(`
            MERGE (a:Activity {id: $id})
            SET a.type = $activityType, a.date = $date, a.plannedDate = $plannedDate, a.personResponsible = $personResponsible, a.notes = $notes, a.targetId = $targetId
            WITH a
            OPTIONAL MATCH (a)-[r1:PERFORMED_ON]->() DELETE r1
            WITH a
            OPTIONAL MATCH (target {id: $targetId})
            FOREACH (ignore IN CASE WHEN target IS NOT NULL THEN [1] ELSE [] END | MERGE (a)-[:PERFORMED_ON]->(target))
            SET a.lastUpdatedBy = $userEmail RETURN a
          `, { userEmail, id, activityType, targetId, date, plannedDate, personResponsible, notes });
          results.push({ actionId: action.meta?.id, status: 'success' });
        }
        else if (action.type === 'budgets/upsertBudget') {
          const { id, name, description, exchangeRate } = action.payload;
          await session.run(`
            MERGE (b:Budget {id: $id})
            SET b.name = $name, b.description = $description, b.exchangeRate = $exchangeRate
            SET b.lastUpdatedBy = $userEmail RETURN b
          `, { userEmail, id, name, description, exchangeRate });
          results.push({ actionId: action.meta?.id, status: 'success' });
        }
        else if (action.type === 'budgets/upsertBudgetItem') {
          const { budgetId, item } = action.payload;
          await session.run(`
            MERGE (i:BudgetItem {id: $item.id})
            SET i.category = $item.category, i.description = $item.description, 
                i.amount = toFloat($item.amount), i.currency = $item.currency, i.status = $item.status
            WITH i
            OPTIONAL MATCH ()-[r1:CONTAINS]->(i) DELETE r1
            WITH i
            MATCH (b:Budget {id: $budgetId})
            MERGE (b)-[:CONTAINS]->(i)
            SET i.lastUpdatedBy = $userEmail RETURN i
          `, { userEmail, budgetId, item });
          results.push({ actionId: action.meta?.id, status: 'success' });
        }
        else if (action.type === 'users/upsertUser') {
          const { id, email, name, role, profilePic, allowedTabs, canApprove } = action.payload;
          await session.run(`
            MERGE (u:User {email: $email})
            ON CREATE SET u.id = $id
            SET u.name = $name, u.profile_pic = $profilePic
            WITH u
            MATCH (f:Farm {id: $activeFarmId})
            MERGE (u)-[r:BELONGS_TO]->(f)
            SET r.role = $role
            ${allowedTabs !== undefined ? ', r.allowedTabs = $allowedTabs' : ''}
            ${canApprove !== undefined ? ', r.canApprove = $canApprove' : ''}
            SET u.lastUpdatedBy = $userEmail RETURN u
          `, { userEmail, id, email, name, role, profilePic, allowedTabs: allowedTabs !== undefined ? JSON.stringify(allowedTabs) : null, canApprove: canApprove !== undefined ? !!canApprove : false, activeFarmId });
          results.push({ actionId: action.meta?.id, status: 'success' });
        }
        else if (action.type === 'users/updateUserAccess') {
          const { email, allowedTabs } = action.payload;
          await session.run(`
            MATCH (u:User {email: $email})-[r:BELONGS_TO]->(f:Farm {id: $activeFarmId})
            SET r.allowedTabs = $allowedTabs
            SET u.lastUpdatedBy = $userEmail RETURN u
          `, { userEmail, email, allowedTabs: allowedTabs ? JSON.stringify(allowedTabs) : null, activeFarmId });
          results.push({ actionId: action.meta?.id, status: 'success' });
        }
        else if (action.type === 'assets/addEquipment') {
          const { id, type, brand, model, purchaseDate, value, status, maintenanceDate, details, gpsLocation, drawColor } = action.payload;
          await session.run(`
            MERGE (e:Equipment {id: $id})
            SET e.type = $type, e.brand = $brand, e.model = $model, e.purchaseDate = $purchaseDate,
                e.value = toFloat($value), e.status = $status, e.maintenanceDate = $maintenanceDate, e.details = $details,
                e.gpsLocation = $gpsLocation, e.drawColor = $drawColor
            SET e.lastUpdatedBy = $userEmail RETURN e
          `, { userEmail, id, type, brand, model, purchaseDate, value, status, maintenanceDate, details, gpsLocation: (typeof gpsLocation === 'string') ? gpsLocation : (gpsLocation ? JSON.stringify(gpsLocation) : null), drawColor: drawColor || null });
          results.push({ actionId: action.meta?.id, status: 'success' });
        }
        else if (action.type === 'assignments/upsertAssignment') {
          const { id, taskName, assignedTo, priority, dueDate, status, fieldId, equipmentId, workerIds, workerCount, workers, hours, task, assignmentDate, completedDate, planningId, reviewStatus } = action.payload;
          await session.run(`
            MATCH (farm:Farm {id: $activeFarmId})
            MERGE (a:TaskAssignment {id: $id})
            MERGE (a)-[:BELONGS_TO]->(farm)
            SET a.taskName = $taskName, a.assignedTo = $assignedTo, a.priority = $priority,
                a.dueDate = $dueDate, a.status = $status, a.fieldId = $fieldId, a.equipmentId = $equipmentId,
                a.workerIds = $workerIds, a.workerCount = toInteger($workerCount), a.workers = $workers,
                a.hours = toFloat($hours), a.task = $task, a.assignmentDate = $assignmentDate, a.completedDate = $completedDate,
                a.planningId = $planningId, a.reviewStatus = $reviewStatus
            WITH a
            OPTIONAL MATCH (a)-[r1:ON_FIELD]->() DELETE r1
            WITH a
            OPTIONAL MATCH (f:Field {id: $fieldId})
            FOREACH (ignore IN CASE WHEN f IS NOT NULL THEN [1] ELSE [] END | MERGE (a)-[rel_new:ON_FIELD]->(f) SET rel_new.lastUpdatedBy = $userEmail)
            WITH a
            OPTIONAL MATCH (a)-[r2:USES_EQUIPMENT]->() DELETE r2
            WITH a
            OPTIONAL MATCH (e:Equipment {id: $equipmentId})
            FOREACH (ignore IN CASE WHEN e IS NOT NULL THEN [1] ELSE [] END | MERGE (a)-[rel_new:USES_EQUIPMENT]->(e) SET rel_new.lastUpdatedBy = $userEmail)
            WITH a
            OPTIONAL MATCH (a)-[r3:PART_OF_PLAN]->() DELETE r3
            WITH a
            OPTIONAL MATCH (p {id: $planningId}) WHERE p:Goal OR p:Objective
            FOREACH (ignore IN CASE WHEN p IS NOT NULL THEN [1] ELSE [] END | MERGE (a)-[rel_new:PART_OF_PLAN]->(p) SET rel_new.lastUpdatedBy = $userEmail)
            WITH a
            OPTIONAL MATCH (a)-[r4:ASSIGNED_TO]->() DELETE r4
            WITH a
            UNWIND (CASE WHEN size($workerIdList) > 0 THEN $workerIdList ELSE [null] END) AS wId
            OPTIONAL MATCH (w:Employee {id: wId})
            FOREACH (ignore IN CASE WHEN w IS NOT NULL THEN [1] ELSE [] END | MERGE (a)-[rel_new:ASSIGNED_TO]->(w) SET rel_new.lastUpdatedBy = $userEmail)
            SET a.lastUpdatedBy = $userEmail RETURN DISTINCT a
          `, { activeFarmId, userEmail, id, taskName, assignedTo, priority, dueDate, status, fieldId: fieldId || null, equipmentId: equipmentId || null, workerIds: workerIds ? JSON.stringify(workerIds) : '[]', workerIdList: workerIds || [], workerCount: workerCount || 0, workers: workers || '', hours: hours || 0, task: task || '', assignmentDate: assignmentDate || '', completedDate: completedDate || '', planningId: planningId || null, reviewStatus: reviewStatus || null });
          results.push({ actionId: action.meta?.id, status: 'success' });
        }
        else if (action.type === 'incidents/upsertIncident') {
          const { id, title, type, date, severity, associatedAsset, resolutionStatus, notes } = action.payload;
          await session.run(`
            MATCH (farm:Farm {id: $activeFarmId})
            MERGE (i:Incident {id: $id})
            MERGE (i)-[:BELONGS_TO]->(farm)
            SET i.title = $title, i.type = $type, i.date = $date, i.severity = $severity,
                i.associatedAsset = $associatedAsset, i.resolutionStatus = $resolutionStatus, i.notes = $notes
            SET i.lastUpdatedBy = $userEmail RETURN i
          `, { activeFarmId, userEmail, id, title, type, date, severity, associatedAsset, resolutionStatus, notes });
          results.push({ actionId: action.meta?.id, status: 'success' });
        }
        else if (action.type === 'deadlines/upsertDeadline') {
          const { id, category, targetDate, title, status, autoAlert, notes } = action.payload;
          await session.run(`
            MATCH (farm:Farm {id: $activeFarmId})
            MERGE (d:Deadline {id: $id})
            MERGE (d)-[:BELONGS_TO]->(farm)
            SET d.category = $category, d.targetDate = $targetDate, d.title = $title,
                d.status = $status, d.autoAlert = $autoAlert, d.notes = $notes
            SET d.lastUpdatedBy = $userEmail RETURN d
          `, { activeFarmId, userEmail, id, category, targetDate, title, status, autoAlert, notes });
          results.push({ actionId: action.meta?.id, status: 'success' });
        }
        else if (action.type === 'employees/upsertEmployee') {
          const { id, firstName, lastName, gender, address, phone, jobTitle, type, skills, startDate, endDate, isActive, isTerminated, terminationReason, dailyRateLD, twoWeekPayUSD } = action.payload;
          await session.run(`
            MERGE (e:Employee {id: $id})
            SET e.firstName = $firstName, e.lastName = $lastName, e.gender = $gender, e.address = $address, e.phone = $phone, 
                e.jobTitle = $jobTitle, e.type = $type, e.skills = $skills, e.startDate = $startDate, 
                e.endDate = $endDate, e.isActive = $isActive, e.isTerminated = $isTerminated, e.terminationReason = $terminationReason, 
                e.dailyRateLD = toFloat($dailyRateLD), e.twoWeekPayUSD = toFloat($twoWeekPayUSD)
            SET e.lastUpdatedBy = $userEmail RETURN e
          `, { userEmail, id,
            firstName: firstName || null,
            lastName: lastName || null,
            gender: gender || null,
            address: address || null,
            phone: phone || null,
            jobTitle: jobTitle || null,
            type: type || null,
            skills: skills || null,
            startDate: startDate || null,
            endDate: endDate || null,
            isActive: isActive !== undefined ? isActive : true,
            isTerminated: isTerminated || false,
            terminationReason: terminationReason || null,
            dailyRateLD: dailyRateLD || 0,
            twoWeekPayUSD: twoWeekPayUSD || 0
          });
          results.push({ actionId: action.meta?.id, status: 'success' });
        }
        else if (action.type === 'core/deleteNode') {
          const { id } = action.payload;
          // Delete linked ContractDay nodes if it's a Payroll node being deleted
          await session.run(`
            OPTIONAL MATCH (p:Payroll {id: $id})<-[:FOR_PAYROLL]-(cd:ContractDay)
            DETACH DELETE cd
          `, { id });
          await session.run('MATCH (n {id: $id}) DETACH DELETE n', { id });
          results.push({ actionId: action.meta?.id, status: 'success' });
        }
        else if (action.type === 'core/updateNode') {
          const { id, properties } = action.payload;
          await session.run('MATCH (n {id: $id}) SET n += $properties, n.lastUpdatedBy = $userEmail RETURN n', { userEmail, id, properties });
          
          // Enforce relationships on generic updates
          if (properties.fieldId !== undefined) {
            // 1. Crop: delete SOWN_IN, PLANTED_IN, then create correct relationship
            await session.run(`
              MATCH (n:Crop {id: $id})
              OPTIONAL MATCH (n)-[r1:SOWN_IN]->() DELETE r1
              WITH n
              OPTIONAL MATCH (n)-[r2:PLANTED_IN]->() DELETE r2
              WITH n
              OPTIONAL MATCH (nb:NurseryBed {id: $fieldId})
              FOREACH (ignore IN CASE WHEN nb IS NOT NULL AND n.sowType = "Nursery" THEN [1] ELSE [] END | MERGE (n)-[rel_new:SOWN_IN]->(nb) SET rel_new.lastUpdatedBy = $userEmail)
              WITH n
              OPTIONAL MATCH (f:Field {id: $fieldId})
              FOREACH (ignore IN CASE WHEN f IS NOT NULL AND (n.sowType IS NULL OR n.sowType <> "Nursery") THEN [1] ELSE [] END | MERGE (n)-[rel_new:PLANTED_IN]->(f) SET rel_new.lastUpdatedBy = $userEmail)
            `, { id, fieldId: properties.fieldId, userEmail });

            // 2. Livestock / LivestockKit: delete LOCATED_IN, then create LOCATED_IN
            await session.run(`
              MATCH (n {id: $id})
              WHERE n:Livestock OR n:LivestockKit
              OPTIONAL MATCH (n)-[r:LOCATED_IN]->() DELETE r
              WITH n
              OPTIONAL MATCH (f:Field {id: $fieldId})
              FOREACH (ignore IN CASE WHEN f IS NOT NULL THEN [1] ELSE [] END | MERGE (n)-[rel_new:LOCATED_IN]->(f) SET rel_new.lastUpdatedBy = $userEmail)
            `, { id, fieldId: properties.fieldId, userEmail });

            // 3. SoilTest: delete TESTED_ON, then create TESTED_ON
            await session.run(`
              MATCH (n:SoilTest {id: $id})
              OPTIONAL MATCH (n)-[r:TESTED_ON]->() DELETE r
              WITH n
              OPTIONAL MATCH (f:Field {id: $fieldId})
              FOREACH (ignore IN CASE WHEN f IS NOT NULL THEN [1] ELSE [] END | MERGE (n)-[rel_new:TESTED_ON]->(f) SET rel_new.lastUpdatedBy = $userEmail)
            `, { id, fieldId: properties.fieldId, userEmail });

            // 4. TaskAssignment: delete ON_FIELD, then create ON_FIELD
            await session.run(`
              MATCH (n:TaskAssignment {id: $id})
              OPTIONAL MATCH (n)-[r:ON_FIELD]->() DELETE r
              WITH n
              OPTIONAL MATCH (f:Field {id: $fieldId})
              FOREACH (ignore IN CASE WHEN f IS NOT NULL THEN [1] ELSE [] END | MERGE (n)-[rel_new:ON_FIELD]->(f) SET rel_new.lastUpdatedBy = $userEmail)
            `, { id, fieldId: properties.fieldId, userEmail });
          }
          
          if (properties.pestIds !== undefined) {
            await session.run(`
              MATCH (n:Crop {id: $id})
              OPTIONAL MATCH (n)-[r:AFFECTED_BY]->() DELETE r
              WITH n
              UNWIND (CASE WHEN size($pestIds) > 0 THEN $pestIds ELSE [null] END) AS pId
              OPTIONAL MATCH (p:Pest {id: pId})
              FOREACH (ignore IN CASE WHEN p IS NOT NULL THEN [1] ELSE [] END | MERGE (n)-[rel_new:AFFECTED_BY]->(p) SET rel_new.lastUpdatedBy = $userEmail)
            `, { id, pestIds: properties.pestIds || [], userEmail });
          }

          if (properties.planningId !== undefined) {
            await session.run(`
              MATCH (n:TaskAssignment {id: $id})
              OPTIONAL MATCH (n)-[r:PART_OF_PLAN]->() DELETE r
              WITH n
              OPTIONAL MATCH (p {id: $planningId}) WHERE p:Goal OR p:Objective
              FOREACH (ignore IN CASE WHEN p IS NOT NULL THEN [1] ELSE [] END | MERGE (n)-[rel_new:PART_OF_PLAN]->(p) SET rel_new.lastUpdatedBy = $userEmail)
            `, { userEmail, id, planningId: properties.planningId });
          }
          
          if (properties.workerIds !== undefined) {
            await session.run(`
              MATCH (n {id: $id})
              WHERE n:TaskAssignment OR n:Goal OR n:Objective
              OPTIONAL MATCH (n)-[r:ASSIGNED_TO]->() DELETE r
              WITH n
              UNWIND (CASE WHEN size($workerIds) > 0 THEN $workerIds ELSE [null] END) AS wId
              OPTIONAL MATCH (w:Employee {id: wId})
              FOREACH (ignore IN CASE WHEN w IS NOT NULL THEN [1] ELSE [] END | MERGE (n)-[rel_new:ASSIGNED_TO]->(w) SET rel_new.lastUpdatedBy = $userEmail)
            `, { userEmail, id, workerIds: properties.workerIds || [] });
          }

          if (properties.motherId !== undefined) {
            await session.run(`
              MATCH (n:LivestockKit {id: $id})
              OPTIONAL MATCH (n)-[r:BORN_FROM]->() DELETE r
              WITH n
              OPTIONAL MATCH (m:Livestock {id: $motherId})
              FOREACH (ignore IN CASE WHEN m IS NOT NULL THEN [1] ELSE [] END | MERGE (n)-[rel_new:BORN_FROM]->(m) SET rel_new.lastUpdatedBy = $userEmail)
            `, { id, motherId: properties.motherId, userEmail });

            await session.run(`
              MATCH (n:BreedingEvent {id: $id})
              OPTIONAL MATCH (n)-[r:HAS_MOTHER]->() DELETE r
              WITH n
              OPTIONAL MATCH (m:Livestock {id: $motherId})
              FOREACH (ignore IN CASE WHEN m IS NOT NULL THEN [1] ELSE [] END | MERGE (n)-[rel_new:HAS_MOTHER]->(m) SET rel_new.lastUpdatedBy = $userEmail)
            `, { id, motherId: properties.motherId, userEmail });
          }

          if (properties.fatherId !== undefined) {
            await session.run(`
              MATCH (n:BreedingEvent {id: $id})
              OPTIONAL MATCH (n)-[r:HAS_FATHER]->() DELETE r
              WITH n
              OPTIONAL MATCH (f:Livestock {id: $fatherId})
              FOREACH (ignore IN CASE WHEN f IS NOT NULL THEN [1] ELSE [] END | MERGE (n)-[rel_new:HAS_FATHER]->(f) SET rel_new.lastUpdatedBy = $userEmail)
            `, { id, fatherId: properties.fatherId, userEmail });
          }

          if (properties.cropId !== undefined) {
            await session.run(`
              MATCH (n:Harvest {id: $id})
              OPTIONAL MATCH (n)-[r:HARVESTED_FROM]->() DELETE r
              WITH n
              OPTIONAL MATCH (c:Crop {id: $cropId})
              FOREACH (ignore IN CASE WHEN c IS NOT NULL THEN [1] ELSE [] END | MERGE (n)-[:HARVESTED_FROM]->(c))
            `, { id, cropId: properties.cropId, userEmail });
          }

          if (properties.goalId !== undefined) {
            await session.run(`
              MATCH (o:Objective {id: $id})
              OPTIONAL MATCH ()-[r:HAS_OBJECTIVE]->(o) DELETE r
              WITH o
              OPTIONAL MATCH (g:Goal {id: $goalId})
              FOREACH (ignore IN CASE WHEN g IS NOT NULL THEN [1] ELSE [] END | MERGE (g)-[rel_new:HAS_OBJECTIVE]->(o) SET rel_new.lastUpdatedBy = $userEmail)
            `, { id, goalId: properties.goalId, userEmail });
          }

          if (properties.parentGoalId !== undefined) {
            await session.run(`
              MATCH (g:Goal {id: $id})
              OPTIONAL MATCH (g)-[r:PARENT_GOAL]->() DELETE r
              WITH g
              OPTIONAL MATCH (p:Goal {id: $parentGoalId})
              FOREACH (ignore IN CASE WHEN p IS NOT NULL THEN [1] ELSE [] END | MERGE (g)-[rel_new:PARENT_GOAL]->(p) SET rel_new.lastUpdatedBy = $userEmail)
            `, { id, parentGoalId: properties.parentGoalId, userEmail });
          }

          if (properties.category !== undefined) {
            await session.run(`
              MATCH (t:Transaction {id: $id})
              OPTIONAL MATCH (t)-[r:OF_CATEGORY]->() DELETE r
              WITH t
              OPTIONAL MATCH (c:TransactionCategory {name: $category})
              FOREACH (ignore IN CASE WHEN c IS NULL AND $category <> "" THEN [1] ELSE [] END | MERGE (newC:TransactionCategory {name: $category}) SET newC.lastUpdatedBy = $userEmail MERGE (t)-[r1:OF_CATEGORY]->(newC) SET r1.lastUpdatedBy = $userEmail)
              FOREACH (ignore IN CASE WHEN c IS NOT NULL THEN [1] ELSE [] END | MERGE (t)-[rel_new:OF_CATEGORY]->(c) SET rel_new.lastUpdatedBy = $userEmail)
            `, { id, category: properties.category, userEmail });
          }

          if (properties.assetId !== undefined) {
            await session.run(`
              MATCH (t:Transaction {id: $id})
              OPTIONAL MATCH (t)-[r:RELATED_TO]->() DELETE r
              WITH t
              OPTIONAL MATCH (asset {id: $assetId})
              FOREACH (ignoreMe IN CASE WHEN asset IS NOT NULL THEN [1] ELSE [] END | MERGE (t)-[r2:RELATED_TO]->(asset) SET r2.lastUpdatedBy = $userEmail)
            `, { id, assetId: properties.assetId, userEmail });
          }

          if (properties.targetId !== undefined) {
            await session.run(`
              MATCH (a:Activity {id: $id})
              OPTIONAL MATCH (a)-[r:PERFORMED_ON]->() DELETE r
              WITH a
              OPTIONAL MATCH (target {id: $targetId})
              FOREACH (ignore IN CASE WHEN target IS NOT NULL THEN [1] ELSE [] END | MERGE (a)-[:PERFORMED_ON]->(target))
            `, { id, targetId: properties.targetId, userEmail });
          }

          if (properties.equipmentId !== undefined) {
            await session.run(`
              MATCH (n:TaskAssignment {id: $id})
              OPTIONAL MATCH (n)-[r:USES_EQUIPMENT]->() DELETE r
              WITH n
              OPTIONAL MATCH (e:Equipment {id: $equipmentId})
              FOREACH (ignore IN CASE WHEN e IS NOT NULL THEN [1] ELSE [] END | MERGE (n)-[rel_new:USES_EQUIPMENT]->(e) SET rel_new.lastUpdatedBy = $userEmail)
            `, { id, equipmentId: properties.equipmentId, userEmail });
          }

          results.push({ actionId: action.meta?.id, status: 'success' });
        }

        else if (action.type === 'settings/updateGlobal') {
          const payload = action.payload || {};
          const targetFarmId = action.farmId || activeFarmId || 'default_farm';
          const settingsId = 'settings_' + targetFarmId;
          const properties = {};
          for (const [k, v] of Object.entries(payload)) {
             if (v === undefined) continue;
             if (Array.isArray(v) || (typeof v === 'object' && v !== null)) {
                 properties[k] = JSON.stringify(v);
             } else {
                 properties[k] = v;
             }
          }
          if (!properties.appName || !properties.appName.trim()) {
            delete properties.appName;
          } else {
            properties.appName = properties.appName.toUpperCase();
          }

          // Protect existing base64 logo from being overwritten with null or empty string when saving other settings
          if (properties.logo === 'RESET' || properties.logo === 'DEFAULT') {
            await session.run(`
              MATCH (s:GlobalSettings {id: $settingsId})
              REMOVE s.logo
            `, { settingsId });
            delete properties.logo;
          } else if (!properties.logo || typeof properties.logo !== 'string' || !properties.logo.trim()) {
            delete properties.logo;
          }
          await session.run(`
            MERGE (f:Farm {id: $targetFarmId})
            MERGE (s:GlobalSettings {id: $settingsId})
            MERGE (s)-[:BELONGS_TO]->(f)
            SET s += $properties
            SET s.appName = COALESCE(s.appName, f.name)
            SET s.lastUpdatedBy = $userEmail
            RETURN s
          `, { userEmail, properties, settingsId, targetFarmId });
          results.push({ actionId: action.meta?.id, status: 'success' });
        }
        else if (action.type === 'pests/savePest') {
          const { id, name, type, description, treatment } = action.payload;
          await session.run(`
            MERGE (p:Pest {id: $id})
            SET p.name = $name, p.type = $type, p.description = $description, p.treatment = $treatment
            SET p.lastUpdatedBy = $userEmail RETURN p
          `, { userEmail, id, name, type, description, treatment });
          results.push({ actionId: action.meta?.id, status: 'success' });
        }
        else if (action.type === 'soilTests/saveSoilTest') {
          const { id, fieldId, description, testResults, location, drawColor, updatedAt } = action.payload;
          await session.run(`
            MERGE (s:SoilTest {id: $id})
            SET s.fieldId = $fieldId, s.description = $description,
                s.testResults = $testResults, s.location = $location, s.drawColor = $drawColor,
                s.updatedAt = toInteger($updatedAt)
            WITH s
            OPTIONAL MATCH (s)-[r1:TESTED_ON]->() DELETE r1
            WITH s
            OPTIONAL MATCH (f:Field {id: $fieldId})
            FOREACH (ignore IN CASE WHEN f IS NOT NULL THEN [1] ELSE [] END | MERGE (s)-[rel_new:TESTED_ON]->(f) SET rel_new.lastUpdatedBy = $userEmail)
            SET s.lastUpdatedBy = $userEmail RETURN s
          `, { userEmail, id, fieldId, description: description || '', testResults: testResults ? JSON.stringify(testResults) : '[]', location: (typeof location === 'string') ? location : (location ? JSON.stringify(location) : null), drawColor: drawColor || null, updatedAt: updatedAt || Date.now() });
          results.push({ actionId: action.meta?.id, status: 'success' });
        }
        else if (action.type === 'planning/saveGoal') {
          const { id, title, fromDate, toDate, workerIds, parentGoalId, estimatedHours, actualHours, startDate, completionDate } = action.payload;
          await session.run(`
            MATCH (farm:Farm {id: $activeFarmId})
            MERGE (g:Goal {id: $id})
            MERGE (g)-[:BELONGS_TO]->(farm)
            SET g.title = $title, g.fromDate = $fromDate, g.toDate = $toDate, g.workerIds = $workerIds, g.parentGoalId = $parentGoalId,
                g.estimatedHours = $estimatedHours, g.actualHours = $actualHours, g.startDate = $startDate, g.completionDate = $completionDate
            WITH g, farm
            OPTIONAL MATCH (g)-[r1:PARENT_GOAL]->() DELETE r1
            WITH g, farm
            OPTIONAL MATCH (p:Goal {id: $parentGoalId})
            FOREACH (ignore IN CASE WHEN p IS NOT NULL THEN [1] ELSE [] END | MERGE (g)-[rel_new:PARENT_GOAL]->(p) SET rel_new.lastUpdatedBy = $userEmail)
            WITH g, farm
            OPTIONAL MATCH (g)-[r2:ASSIGNED_TO]->() DELETE r2
            WITH g, farm
            UNWIND (CASE WHEN size($workerIdList) > 0 THEN $workerIdList ELSE [null] END) AS wId
            OPTIONAL MATCH (w:Employee {id: wId})
            FOREACH (ignore IN CASE WHEN w IS NOT NULL THEN [1] ELSE [] END | MERGE (g)-[rel_new:ASSIGNED_TO]->(w) SET rel_new.lastUpdatedBy = $userEmail)
            SET g.lastUpdatedBy = $userEmail RETURN DISTINCT g
          `, { 
            activeFarmId, userEmail, id, title, fromDate, toDate, workerIds: workerIds ? JSON.stringify(workerIds) : '[]', workerIdList: workerIds || [], parentGoalId: parentGoalId || null,
            estimatedHours: estimatedHours || null, actualHours: actualHours || null, startDate: startDate || null, completionDate: completionDate || null
          });
          results.push({ actionId: action.meta?.id, status: 'success' });
        }
        else if (action.type === 'planning/saveObjective') {
          const { id, goalId, title, fromDate, toDate, workerIds, estimatedHours, actualHours, startDate, completionDate } = action.payload;
          await session.run(`
            MATCH (farm:Farm {id: $activeFarmId})
            MERGE (o:Objective {id: $id})
            MERGE (o)-[:BELONGS_TO]->(farm)
            SET o.goalId = $goalId, o.title = $title, o.fromDate = $fromDate, o.toDate = $toDate, o.workerIds = $workerIds,
                o.estimatedHours = $estimatedHours, o.actualHours = $actualHours, o.startDate = $startDate, o.completionDate = $completionDate
            WITH o, farm
            OPTIONAL MATCH ()-[r1:HAS_OBJECTIVE]->(o) DELETE r1
            WITH o, farm
            OPTIONAL MATCH (g:Goal {id: $goalId})
            FOREACH (ignore IN CASE WHEN g IS NOT NULL THEN [1] ELSE [] END | MERGE (g)-[rel_new:HAS_OBJECTIVE]->(o) SET rel_new.lastUpdatedBy = $userEmail)
            WITH o, farm
            OPTIONAL MATCH (o)-[r2:ASSIGNED_TO]->() DELETE r2
            WITH o, farm
            UNWIND (CASE WHEN size($workerIdList) > 0 THEN $workerIdList ELSE [null] END) AS wId
            OPTIONAL MATCH (w:Employee {id: wId})
            FOREACH (ignore IN CASE WHEN w IS NOT NULL THEN [1] ELSE [] END | MERGE (o)-[rel_new:ASSIGNED_TO]->(w) SET rel_new.lastUpdatedBy = $userEmail)
            SET o.lastUpdatedBy = $userEmail RETURN DISTINCT o
          `, { 
            activeFarmId, userEmail, id, goalId, title, fromDate, toDate, workerIds: workerIds ? JSON.stringify(workerIds) : '[]', workerIdList: workerIds || [],
            estimatedHours: estimatedHours || null, actualHours: actualHours || null, startDate: startDate || null, completionDate: completionDate || null
          });
          results.push({ actionId: action.meta?.id, status: 'success' });
        }
        else if (action.type === 'livestockDiseases/saveDisease') {
          const { id, name, description, treatment, animalTypes } = action.payload;
          await session.run(`
            MATCH (farm:Farm {id: $activeFarmId})
            MERGE (d:LivestockDisease {id: $id})
            MERGE (d)-[:BELONGS_TO]->(farm)
            SET d.name = $name, d.description = $description, d.treatment = $treatment, d.animalTypes = $animalTypes
            SET d.lastUpdatedBy = $userEmail RETURN d
          `, { activeFarmId, userEmail, id, name, description, treatment, animalTypes: animalTypes ? JSON.stringify(animalTypes) : '[]' });
          results.push({ actionId: action.meta?.id, status: 'success' });
        }
        else if (action.type === 'payroll/savePayroll') {
          const { id, fromDate, toDate, exchangeRate, attendance, pulledEmployees, customRates, totals } = action.payload;
          
          let employeeIds = [];
          try {
            const employeesList = typeof pulledEmployees === 'string' ? JSON.parse(pulledEmployees) : pulledEmployees || [];
            employeeIds = employeesList.map(e => e.id).filter(Boolean);
          } catch (e) {
            console.warn('Failed to parse pulledEmployees list for relationships:', e.message);
          }

          // Fetch workdayHours setting from DB, default to 7.0
          const targetFarmId = activeFarmId || 'default_farm';
          const settingsRes = await session.run(`
            MATCH (s:GlobalSettings)-[:BELONGS_TO]->(:Farm {id: $targetFarmId})
            RETURN s.workdayHours AS workdayHours
          `, { targetFarmId });
          
          let workdayHours = 7.0;
          if (settingsRes.records.length > 0) {
            const rawHrs = settingsRes.records[0].get('workdayHours');
            if (rawHrs !== null && rawHrs !== undefined) {
              workdayHours = parseFloat(rawHrs);
            }
          }

          await session.run(`
            MERGE (f:Farm {id: $targetFarmId})
            MERGE (p:Payroll {id: $id})
            MERGE (p)-[:BELONGS_TO]->(f)
            SET p.fromDate = $fromDate, p.toDate = $toDate, p.exchangeRate = toFloat($exchangeRate),
                p.attendance = $attendance, p.pulledEmployees = $pulledEmployees, p.customRates = $customRates, p.totals = $totals
            SET p.lastUpdatedBy = $userEmail
            WITH p
            OPTIONAL MATCH (p)-[r:INCLUDES_EMPLOYEE]->() DELETE r
            WITH p
            UNWIND (CASE WHEN size($employeeIds) > 0 THEN $employeeIds ELSE [null] END) AS empId
            OPTIONAL MATCH (e:Employee {id: empId})
            FOREACH (ignore IN CASE WHEN e IS NOT NULL THEN [1] ELSE [] END | MERGE (p)-[:INCLUDES_EMPLOYEE]->(e))
            RETURN p
          `, { 
            targetFarmId, userEmail, id, fromDate, toDate, exchangeRate, 
            attendance: typeof attendance === 'string' ? attendance : JSON.stringify(attendance), 
            pulledEmployees: typeof pulledEmployees === 'string' ? pulledEmployees : JSON.stringify(pulledEmployees), 
            customRates: typeof customRates === 'string' ? customRates : JSON.stringify(customRates || {}),
            totals: typeof totals === 'string' ? totals : JSON.stringify(totals),
            employeeIds
          });

          // Parse attendance and create/update ContractDay nodes
          let attendanceObj = {};
          try {
            attendanceObj = typeof attendance === 'string' ? JSON.parse(attendance) : attendance || {};
          } catch (e) {
            console.warn('Failed to parse attendance for contractday:', e.message);
          }

          const contractDays = [];
          const activeCdIds = [];
          for (const empId of Object.keys(attendanceObj)) {
            const empDates = attendanceObj[empId] || {};
            for (const dateStr of Object.keys(empDates)) {
              const status = String(empDates[dateStr]);
              let hours = workdayHours;
              if (status === 'X') {
                hours = 0.0;
              } else if (status === '1') {
                hours = workdayHours;
              } else if (status === '0') {
                hours = workdayHours;
              }
              const cdId = `${empId}_${dateStr}_${id}`;
              contractDays.push({
                id: cdId,
                employeeId: empId,
                dateStr,
                status,
                hours
              });
              activeCdIds.push(cdId);
            }
          }

          if (contractDays.length > 0) {
            await session.run(`
              UNWIND $contractDays AS cdInfo
              MERGE (cd:ContractDay {id: cdInfo.id})
              SET cd.date = cdInfo.dateStr, cd.status = cdInfo.status, cd.hours = toFloat(cdInfo.hours), cd.lastUpdatedBy = $userEmail
              WITH cd, cdInfo
              OPTIONAL MATCH (e:Employee {id: cdInfo.employeeId})
              FOREACH (ignore IN CASE WHEN e IS NOT NULL THEN [1] ELSE [] END | MERGE (cd)-[:FOR_EMPLOYEE]->(e))
              WITH cd, cdInfo
              OPTIONAL MATCH (p:Payroll {id: $id})
              FOREACH (ignore IN CASE WHEN p IS NOT NULL THEN [1] ELSE [] END | MERGE (cd)-[:FOR_PAYROLL]->(p))
            `, { contractDays, id, userEmail });
          }

          // Delete obsolete ContractDay nodes linked to this Payroll that are not in the current save batch
          await session.run(`
            MATCH (p:Payroll {id: $id})<-[:FOR_PAYROLL]-(cd:ContractDay)
            WHERE NOT cd.id IN $activeCdIds
            DETACH DELETE cd
          `, { id, activeCdIds });

          updatedIds.push(id);
          results.push({ actionId: action.meta?.id, status: 'success' });
        }
        else if (action.type === 'payroll/deletePayroll') {
          const id = typeof action.payload === 'string' ? action.payload : action.payload?.id;
          if (id) {
            await session.run(`
              MATCH (p:Payroll {id: $id})
              OPTIONAL MATCH (cd:ContractDay)-[:FOR_PAYROLL]->(p)
              DETACH DELETE cd, p
            `, { id });
          }
          results.push({ actionId: action.meta?.id, status: 'success' });
        }
        else if (action.type === 'core/createRelationship') {
          const { sourceId, targetId, relationshipType } = action.payload;
          const safeRelType = /^[A-Z0-9_]+$/i.test(relationshipType) ? relationshipType : 'RELATED_TO';
          await session.run(`
            MATCH (s {id: $sourceId})
            MATCH (t {id: $targetId})
            MERGE (s)-[r:${safeRelType}]->(t)
            SET r.lastUpdatedBy = $userEmail
            RETURN r
          `, { sourceId, targetId, userEmail });
          results.push({ actionId: action.meta?.id, status: 'success' });
        }
        else if (action.type === 'core/deleteRelationship') {
          const { sourceId, targetId, relationshipType } = action.payload;
          const safeRelType = /^[A-Z0-9_]+$/i.test(relationshipType) ? relationshipType : 'RELATED_TO';
          await session.run(`
            MATCH (s {id: $sourceId})-[r:${safeRelType}]->(t {id: $targetId})
            DELETE r
          `, { sourceId, targetId });
          results.push({ actionId: action.meta?.id, status: 'success' });
        }
        else {
          console.warn('Unknown sync action:', action.type);
          results.push({ actionId: action.meta?.id, status: 'ignored' });
        }
      } catch (actionErr) {
        console.error(`Failed to process action ${action.type}:`, actionErr);
        // We log the error but do NOT throw it, allowing the rest of the queue to process.
        // The action is marked as failed/ignored so the queue will be cleared and not permanently blocked.
        results.push({ actionId: action.meta?.id, status: 'error', error: actionErr.message });
      }
    }

    // Post-processing: link only the newly created/updated nodes to the active farm and reconcile relationships
    if (updatedIds.length > 0) {
      await session.run(`
        MATCH (f:Farm {id: $activeFarmId})
        WITH f
        UNWIND $updatedIds AS nodeId
        MATCH (n {id: nodeId})
        WHERE NOT n:Farm AND NOT (n)-[:BELONGS_TO]->(:Farm)
        MERGE (n)-[:BELONGS_TO]->(f)
      `, { activeFarmId, updatedIds });
    }

    await reconcileRelationships(session, activeFarmId);

    res.json({ success: true, processed: results });
  } catch (err) {
    console.warn('Sync queue failed:', err.message);
    res.status(200).json({ ok: false, error: 'DATABASE_UNAVAILABLE', details: err.message });
  } finally {
    await session.close();
  }
});

// GET Admin Boundaries GeoJSON Endpoint
app.get('/api/admin-boundaries', async (req, res) => {
  const session = driver.session();
  try {
    const result = await session.run(`
      MATCH (b:AdminBoundary)
      RETURN b.geojson AS geojson
    `);
    const features = result.records.map(record => {
      try {
        return JSON.parse(record.get('geojson'));
      } catch (e) {
        return null;
      }
    }).filter(Boolean);
    res.json({
      type: "FeatureCollection",
      features
    });
  } catch (err) {
    console.error('[API Error] Failed to fetch admin boundaries:', err);
    res.status(500).json({ error: 'Failed to fetch admin boundaries' });
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

// Global Error Handler to prevent unhandled exceptions from crashing the server
app.use((err, req, res, next) => {
  console.error('[Global Error Handler]', err.stack || err.message || err);
  if (!res.headersSent) {
    res.status(500).json({ ok: false, error: 'Internal Server Error' });
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Node Server proxy running on port ${port}`);
});

// Cleanup driver gracefully
process.on('SIGINT', async () => {
  await driver.close();
  process.exit(0);
});
