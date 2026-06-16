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
      'CREATE (f:Field {id: $id, name: $name, area: $area, soil_type: $soil_type, irrigation: $irrigation, status: $status, year: $year, polygon: $polygon}) RETURN f', { userEmail, id, name, area, soil_type, irrigation, status, year, polygon }
    );
    const field = result.records[0].get('f').properties;
    res.json(field);
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    await session.close();
  }
});

// GEE Connection Test endpoint
app.post('/api/gee/test-connection', async (req, res) => {
  const session = driver.session();
  try {
    const { client_email, private_key, project_id, polygon } = req.body;
    
    let creds = { client_email, private_key, project_id };
    
    if (!creds.client_email || !creds.private_key || !creds.project_id) {
      const result = await session.run("MATCH (n:GlobalSettings {id: 'default'}) RETURN n");
      if (result.records.length > 0) {
        const props = result.records[0].get('n').properties;
        creds = {
          client_email: props.geeClientEmail || creds.client_email,
          private_key: props.geePrivateKey || creds.private_key,
          project_id: props.geeProjectId || creds.project_id
        };
      }
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
    const { clientId, clientSecret, phoneNumber, message, environment } = req.body;
    
    let creds = { clientId, clientSecret, environment };
    
    if (!creds.clientId || !creds.clientSecret || !creds.environment) {
      const result = await session.run("MATCH (n:GlobalSettings {id: 'default'}) RETURN n");
      if (result.records.length > 0) {
        const props = result.records[0].get('n').properties;
        creds = {
          clientId: props.mtnClientId || creds.clientId,
          clientSecret: props.mtnClientSecret || creds.clientSecret,
          environment: props.mtnEnvironment || creds.environment
        };
      }
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
    const { polygon, dateOffset } = req.body;
    
    // 1. Fetch credentials from settings
    const result = await session.run("MATCH (n:GlobalSettings {id: 'default'}) RETURN n");
    if (result.records.length === 0) {
      return res.status(404).json({ error: 'Global settings not found.' });
    }
    
    const settingsNode = result.records[0].get('n').properties;
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
    const { polygon, indexType, dateOffset, fieldId, geeScale } = req.body;
    
    // 1. Fetch credentials from settings
    const result = await session.run("MATCH (n:GlobalSettings {id: 'default'}) RETURN n");
    if (result.records.length === 0) {
      return res.status(404).json({ error: 'Global settings not found.' });
    }
    
    const props = result.records[0].get('n').properties;
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
    if (indexType === 'Elevation') {
      scaleValue = Math.min(requestedScale, 1); // 1m for USGS 3DEP native minimum
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

    if (indexType !== 'Elevation' && !isGeeWeather) {
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
        .select(selectedBands);
        
      // Sort by lowest cloud cover
      let sorted = collection.sort('CLOUDY_PIXEL_PERCENTAGE');
      
      // Get the size of collection asynchronously
      const count = await new Promise((resolve, reject) => {
        sorted.size().evaluate((c, err) => {
          if (err) reject(err);
          else resolve(c);
        });
      });
      
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
    } else if (indexType === 'Elevation') {
      // Resample individual datasets to bicubic before mosaicking to preserve projection details
      const usgs3dep1m = ee.ImageCollection('USGS/3DEP/1m').map(img => img.resample('bicubic')).mosaic();
      const usgs3dep10m = ee.Image('USGS/3DEP/10m').resample('bicubic');
      const srtm = ee.Image('USGS/SRTMGL1_003').select('elevation').resample('bicubic');
      // unmask() loses default projection info, so we assign srtm's projection as the default for the composite
      const elevation = usgs3dep1m.unmask(usgs3dep10m).unmask(srtm).select(['elevation']).setDefaultProjection(srtm.projection());
      
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
      
      processedImage = elevation.resample('bicubic').reproject({ crs: 'EPSG:3857', scale: scaleValue }).clip(geometry);
      visParams = {
        min: visMin,
        max: visMax,
        palette: ['#08306b', '#006837', '#31a354', '#78c679', '#c2e699', '#fee08b', '#fdae61', '#f46d43', '#d73027', '#a50026']
      };
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

// GEE Find Waterways Endpoint
app.post('/api/gee/find-waterways', async (req, res) => {
  const session = driver.session();
  try {
    const { minLat, maxLat, minLng, maxLng } = req.body;
    if (minLat === undefined || maxLat === undefined || minLng === undefined || maxLng === undefined) {
      return res.status(400).json({ error: 'Missing bounding box bounds' });
    }

    const result = await session.run("MATCH (n:GlobalSettings {id: 'default'}) RETURN n");
    if (result.records.length === 0) {
      return res.status(404).json({ error: 'Global settings not found.' });
    }

    const props = result.records[0].get('n').properties;
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
    const srtm = ee.Image('USGS/SRTMGL1_003').select('elevation');

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

      // Filter to find the points that satisfy intersection and compute scores
      const intersectionPoints = [];
      const allPointsWithScores = [];

      // Calculate min/max elevation to scale relative depth
      const elevations = data.map(d => d.elevation).filter(e => e !== null);
      const maxElev = elevations.length > 0 ? Math.max(...elevations) : 1000;
      const minElev = elevations.length > 0 ? Math.min(...elevations) : 0;
      const elevRange = maxElev - minElev || 1;

      for (const d of data) {
        // 1. DEM valley depth: lower elevation in the current bounding box gets higher score
        let depthScore = 0;
        if (d.elevation !== null) {
          depthScore = ((maxElev - d.elevation) / elevRange) * 1000;
        }

        // 2. DEM Flow Accumulation and Drainage channels from MERIT Hydro
        let meritScore = 0;
        if (d.upa !== null) {
          // Upstream drainage area (upa) in km2. Prefer channels.
          meritScore += Math.min(d.upa * 1000, 500);
        }
        if (d.hnd !== null) {
          // Height above nearest drainage (hnd) in meters. Closer to 0 is the valley floor.
          meritScore += Math.max(0, 500 - d.hnd * 100);
        }

        // 3. Active water (Sentinel-1 SAR VV backscatter < -16 dB)
        let sarScore = 0;
        const hasSar = d.sar_vv !== null && d.sar_vv !== 0 && d.sar_vv < -16;
        if (hasSar) {
          sarScore = 500 + Math.max(0, -16 - d.sar_vv) * 50;
        }

        // 4. Permanent water (Sentinel-2 dry-season NDWI > 0.0)
        let ndwiScore = 0;
        const hasNdwi = d.ndwi_dry !== null && d.ndwi_dry !== -1 && d.ndwi_dry > 0.0;
        if (hasNdwi) {
          ndwiScore = 500 + d.ndwi_dry * 1000;
        }

        const score = depthScore + meritScore + sarScore + ndwiScore;
        const intersect = hasSar && hasNdwi;

        const pt = {
          lat: d.lat,
          lng: d.lng,
          score,
          intersect
        };

        allPointsWithScores.push(pt);
        if (intersect) {
          intersectionPoints.push(pt);
        }
      }

      // Determine the general orientation of the waterway inside the bounding box
      let isEastWest = false;
      // We look at the top 15% highest scoring points (which represent the valley floor / waterway corridor)
      const sortedPoints = [...allPointsWithScores].sort((a, b) => b.score - a.score);
      const topPoints = sortedPoints.slice(0, Math.max(5, Math.floor(allPointsWithScores.length * 0.15)));
      
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

      const waterwayPoints = [];

      if (isEastWest) {
        // Group by longitude, pick the highest-scoring latitude
        for (const lng of lngsList) {
          const colPoints = allPointsWithScores.filter(p => p.lng === lng);
          let bestPt = null;
          let maxScore = -Infinity;
          for (const p of colPoints) {
            if (p.score > maxScore) {
              maxScore = p.score;
              bestPt = p;
            }
          }
          if (bestPt) {
            waterwayPoints.push([bestPt.lat, bestPt.lng]);
          }
        }
      } else {
        // Group by latitude, pick the highest-scoring longitude
        for (const lat of latsList) {
          const rowPoints = allPointsWithScores.filter(p => p.lat === lat);
          let bestPt = null;
          let maxScore = -Infinity;
          for (const p of rowPoints) {
            if (p.score > maxScore) {
              maxScore = p.score;
              bestPt = p;
            }
          }
          if (bestPt) {
            waterwayPoints.push([bestPt.lat, bestPt.lng]);
          }
        }
      }

      // Smooth the waterway coordinates to prevent jagged lines
      const smoothedPoints = [];
      const windowSize = 7;
      const halfWindow = Math.floor(windowSize / 2);

      if (waterwayPoints.length > 0) {
        if (isEastWest) {
          // Smooth the latitudes (index 0) along the West-East line
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
          // Smooth the longitudes (index 1) along the North-South line
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

      const validElevations = data.map(d => d.elevation).filter(e => e !== null);
      const avgElevation = validElevations.length > 0 
        ? Number((validElevations.reduce((sum, e) => sum + e, 0) / validElevations.length).toFixed(2))
        : null;

      res.json({ points: smoothedPoints, mapElevation: avgElevation });
    });
  } catch (err) {
    console.error('find-waterways endpoint error:', err);
    res.status(500).json({ error: err.message || err });
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
       financials: 'MATCH (n:Transaction) RETURN n',
       budgets: 'MATCH (n:Budget) OPTIONAL MATCH (n)-[:CONTAINS]->(i:BudgetItem) RETURN n, collect(i) as items',
       incidents: 'MATCH (n:Incident) RETURN n',
       deadlines: 'MATCH (n:Deadline) RETURN n',
       gps: 'MATCH (n:GpsLog) RETURN n',
       audit: 'MATCH (n:AuditLog) RETURN n',
       users: 'MATCH (n:User) RETURN n',
       harvests: 'MATCH (n:Harvest) RETURN n',
       kits: 'MATCH (n:LivestockKit) RETURN n',
       breeding: 'MATCH (n:BreedingEvent) RETURN n',
       settings: "MATCH (n:GlobalSettings {id: 'default'}) RETURN n",
       pests: 'MATCH (n:Pest) RETURN n',
       soilTests: 'MATCH (n:SoilTest) RETURN n',
       goals: 'MATCH (n:Goal) RETURN n',
       objectives: 'MATCH (n:Objective) RETURN n',
       livestockDiseases: 'MATCH (n:LivestockDisease) RETURN n',
       poi: 'MATCH (n:PointOfInterest) RETURN n'
    };

    const data = {};
    for (const [key, query] of Object.entries(collections)) {
       const result = await session.run(query);
       data[key] = result.records.map(r => {
           const props = r.get('n').properties;
           if (key === 'budgets') {
               const itemsVal = r.get('items');
               props.items = Array.isArray(itemsVal) ? itemsVal.map(i => i.properties) : [];
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
               ['units', 'jobTitles', 'kmlUrls', 'mapCenter', 'expenseCategories', 'incomeCategories', 'animalTypes'].forEach(field => {
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
  const { queue } = req.body;
  if (!queue || !Array.isArray(queue)) {
    return res.status(400).json({ error: 'Invalid queue format' });
  }

  const session = driver.session();
  try {
    const results = [];
    
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
          UNWIND $events AS event
          MERGE (g:GpsLog {id: event.id})
          SET g.lat = event.lat, g.lng = event.lng, g.timestamp = event.timestamp, g.userEmail = event.userEmail
          WITH g, event
          OPTIONAL MATCH (u:User {email: event.userEmail})
          FOREACH (ignoreMe IN CASE WHEN u IS NOT NULL THEN [1] ELSE [] END |
            MERGE (u)-[r1:LOGGED_LOCATION]->(g) SET r1.lastUpdatedBy = event.userEmail
          )
          SET g.lastUpdatedBy = event.userEmail
        `, { events });
        
        gpsActions.forEach(action => {
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
            SET u.name = $name, u.role = $role, u.profile_pic = $profilePic
            ${allowedTabs !== undefined ? ', u.allowedTabs = $allowedTabs' : ''}
            ${canApprove !== undefined ? ', u.canApprove = $canApprove' : ''}
            SET u.lastUpdatedBy = $userEmail RETURN u
          `, { userEmail, id, email, name, role, profilePic, allowedTabs: allowedTabs !== undefined ? JSON.stringify(allowedTabs) : null, canApprove: canApprove !== undefined ? !!canApprove : false });
          results.push({ actionId: action.meta?.id, status: 'success' });
        }
        else if (action.type === 'users/updateUserAccess') {
          const { email, allowedTabs } = action.payload;
          await session.run(`
            MATCH (u:User {email: $email})
            SET u.allowedTabs = $allowedTabs
            SET u.lastUpdatedBy = $userEmail RETURN u
          `, { userEmail, email, allowedTabs: JSON.stringify(allowedTabs) });
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
            MERGE (a:TaskAssignment {id: $id})
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
          `, { userEmail, id, taskName, assignedTo, priority, dueDate, status, fieldId: fieldId || null, equipmentId: equipmentId || null, workerIds: workerIds ? JSON.stringify(workerIds) : '[]', workerIdList: workerIds || [], workerCount: workerCount || 0, workers: workers || '', hours: hours || 0, task: task || '', assignmentDate: assignmentDate || '', completedDate: completedDate || '', planningId: planningId || null, reviewStatus: reviewStatus || null });
          results.push({ actionId: action.meta?.id, status: 'success' });
        }
        else if (action.type === 'incidents/upsertIncident') {
          const { id, title, type, date, severity, associatedAsset, resolutionStatus, notes } = action.payload;
          await session.run(`
            MERGE (i:Incident {id: $id})
            SET i.title = $title, i.type = $type, i.date = $date, i.severity = $severity,
                i.associatedAsset = $associatedAsset, i.resolutionStatus = $resolutionStatus, i.notes = $notes
            SET i.lastUpdatedBy = $userEmail RETURN i
          `, { userEmail, id, title, type, date, severity, associatedAsset, resolutionStatus, notes });
          results.push({ actionId: action.meta?.id, status: 'success' });
        }
        else if (action.type === 'deadlines/upsertDeadline') {
          const { id, category, targetDate, title, status, autoAlert, notes } = action.payload;
          await session.run(`
            MERGE (d:Deadline {id: $id})
            SET d.category = $category, d.targetDate = $targetDate, d.title = $title,
                d.status = $status, d.autoAlert = $autoAlert, d.notes = $notes
            SET d.lastUpdatedBy = $userEmail RETURN d
          `, { userEmail, id, category, targetDate, title, status, autoAlert, notes });
          results.push({ actionId: action.meta?.id, status: 'success' });
        }
        else if (action.type === 'employees/upsertEmployee') {
          const { id, firstName, lastName, gender, address, phone, jobTitle, type, skills, startDate, endDate, isTerminated, terminationReason, dailyRateLD, twoWeekPayUSD } = action.payload;
          await session.run(`
            MERGE (e:Employee {id: $id})
            SET e.firstName = $firstName, e.lastName = $lastName, e.gender = $gender, e.address = $address, e.phone = $phone, 
                e.jobTitle = $jobTitle, e.type = $type, e.skills = $skills, e.startDate = $startDate, 
                e.endDate = $endDate, e.isTerminated = $isTerminated, e.terminationReason = $terminationReason, 
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
            SET s.lastUpdatedBy = $userEmail RETURN s
          `, { userEmail, properties });
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
            MERGE (g:Goal {id: $id})
            SET g.title = $title, g.fromDate = $fromDate, g.toDate = $toDate, g.workerIds = $workerIds, g.parentGoalId = $parentGoalId,
                g.estimatedHours = $estimatedHours, g.actualHours = $actualHours, g.startDate = $startDate, g.completionDate = $completionDate
            WITH g
            OPTIONAL MATCH (g)-[r1:PARENT_GOAL]->() DELETE r1
            WITH g
            OPTIONAL MATCH (p:Goal {id: $parentGoalId})
            FOREACH (ignore IN CASE WHEN p IS NOT NULL THEN [1] ELSE [] END | MERGE (g)-[rel_new:PARENT_GOAL]->(p) SET rel_new.lastUpdatedBy = $userEmail)
            WITH g
            OPTIONAL MATCH (g)-[r2:ASSIGNED_TO]->() DELETE r2
            WITH g
            UNWIND (CASE WHEN size($workerIdList) > 0 THEN $workerIdList ELSE [null] END) AS wId
            OPTIONAL MATCH (w:Employee {id: wId})
            FOREACH (ignore IN CASE WHEN w IS NOT NULL THEN [1] ELSE [] END | MERGE (g)-[rel_new:ASSIGNED_TO]->(w) SET rel_new.lastUpdatedBy = $userEmail)
            SET g.lastUpdatedBy = $userEmail RETURN DISTINCT g
          `, { 
            userEmail, id, title, fromDate, toDate, workerIds: workerIds ? JSON.stringify(workerIds) : '[]', workerIdList: workerIds || [], parentGoalId: parentGoalId || null,
            estimatedHours: estimatedHours || null, actualHours: actualHours || null, startDate: startDate || null, completionDate: completionDate || null
          });
          results.push({ actionId: action.meta?.id, status: 'success' });
        }
        else if (action.type === 'planning/saveObjective') {
          const { id, goalId, title, fromDate, toDate, workerIds, estimatedHours, actualHours, startDate, completionDate } = action.payload;
          await session.run(`
            MERGE (o:Objective {id: $id})
            SET o.goalId = $goalId, o.title = $title, o.fromDate = $fromDate, o.toDate = $toDate, o.workerIds = $workerIds,
                o.estimatedHours = $estimatedHours, o.actualHours = $actualHours, o.startDate = $startDate, o.completionDate = $completionDate
            WITH o
            OPTIONAL MATCH ()-[r1:HAS_OBJECTIVE]->(o) DELETE r1
            WITH o
            OPTIONAL MATCH (g:Goal {id: $goalId})
            FOREACH (ignore IN CASE WHEN g IS NOT NULL THEN [1] ELSE [] END | MERGE (g)-[rel_new:HAS_OBJECTIVE]->(o) SET rel_new.lastUpdatedBy = $userEmail)
            WITH o
            OPTIONAL MATCH (o)-[r2:ASSIGNED_TO]->() DELETE r2
            WITH o
            UNWIND (CASE WHEN size($workerIdList) > 0 THEN $workerIdList ELSE [null] END) AS wId
            OPTIONAL MATCH (w:Employee {id: wId})
            FOREACH (ignore IN CASE WHEN w IS NOT NULL THEN [1] ELSE [] END | MERGE (o)-[rel_new:ASSIGNED_TO]->(w) SET rel_new.lastUpdatedBy = $userEmail)
            SET o.lastUpdatedBy = $userEmail RETURN DISTINCT o
          `, { 
            userEmail, id, goalId, title, fromDate, toDate, workerIds: workerIds ? JSON.stringify(workerIds) : '[]', workerIdList: workerIds || [],
            estimatedHours: estimatedHours || null, actualHours: actualHours || null, startDate: startDate || null, completionDate: completionDate || null
          });
          results.push({ actionId: action.meta?.id, status: 'success' });
        }
        else if (action.type === 'livestockDiseases/saveDisease') {
          const { id, name, description, treatment, animalTypes } = action.payload;
          await session.run(`
            MERGE (d:LivestockDisease {id: $id})
            SET d.name = $name, d.description = $description, d.treatment = $treatment, d.animalTypes = $animalTypes
            SET d.lastUpdatedBy = $userEmail RETURN d
          `, { userEmail, id, name, description, treatment, animalTypes: animalTypes ? JSON.stringify(animalTypes) : '[]' });
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

    res.json({ success: true, processed: results });
  } catch (err) {
    console.warn('Sync queue failed:', err.message);
    res.status(200).json({ ok: false, error: 'DATABASE_UNAVAILABLE', details: err.message });
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
