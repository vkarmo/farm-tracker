const neo4j = require('neo4j-driver');
require('dotenv').config();
const ee = require('@google/earthengine');

// Initialize Neo4j Driver
let neo4jUri = process.env.NEO4J_URI || 'bolt://localhost:7687';
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

async function run() {
  const session = driver.session({ database: neo4jDatabase });
  try {
    const result = await session.run('MATCH (n:GlobalSettings) RETURN n LIMIT 1');
    if (result.records.length === 0) {
      console.error('No GlobalSettings found.');
      return;
    }
    const settingsNode = result.records[0].get('n').properties;
    const perfectPrivateKey = (settingsNode.geePrivateKey || '').replace(/\\n/g, '\n');
    const creds = {
      client_email: settingsNode.geeClientEmail || '',
      private_key: perfectPrivateKey,
      project_id: settingsNode.geeProjectId || ''
    };

    if (!creds.client_email || !creds.private_key || !creds.project_id) {
      console.error('Missing GEE credentials in GlobalSettings.');
      return;
    }

    console.log('Authenticating Earth Engine...');
    await new Promise((resolve, reject) => {
      ee.data.authenticateViaPrivateKey(
        { client_email: creds.client_email, private_key: creds.private_key },
        () => {
          ee.initialize(null, creds.project_id, () => {
            console.log('Earth Engine initialized.');
            resolve();
          }, (err) => reject(err));
        },
        (err) => reject(err)
      );
    });

    // Bounding Box
    const minLat = 6.7290;
    const maxLat = 6.7366;
    const minLng = -10.8759;
    const maxLng = -10.8622;

    const srtm = ee.Image('USGS/SRTMGL1_003').select('elevation');
    
    // Sample on a grid
    const latSteps = 30;
    const lngSteps = 30;
    const points = [];
    for (let i = 0; i <= latSteps; i++) {
      const lat = minLat + (i / latSteps) * (maxLat - minLat);
      for (let j = 0; j <= lngSteps; j++) {
        const lng = minLng + (j / lngSteps) * (maxLng - minLng);
        points.push(ee.Feature(ee.Geometry.Point([lng, lat]), { lat, lng }));
      }
    }

    const featureCollection = ee.FeatureCollection(points);
    // Reduce regions / sample regions
    console.log('Sampling elevation data from GEE...');
    const sampled = srtm.reduceRegions({
      collection: featureCollection,
      reducer: ee.Reducer.first(),
      scale: 30
    });

    sampled.evaluate((result, err) => {
      if (err) {
        console.error('Error sampling data:', err);
        return;
      }
      const data = result.features.map(f => ({
        lat: f.properties.lat,
        lng: f.properties.lng,
        elevation: f.properties.first
      }));

      // Let's print out the data as JSON or inspect it
      console.log('Sampled data points count:', data.length);
      
      // Find the minimum elevation point
      const sorted = [...data].sort((a, b) => a.elevation - b.elevation);
      console.log('Lowest 20 points:');
      console.log(JSON.stringify(sorted.slice(0, 20), null, 2));

      // Let's write the whole sampled data to a json file
      const fs = require('fs');
      fs.writeFileSync('elevation_samples.json', JSON.stringify(data, null, 2));
      console.log('Saved to elevation_samples.json');
      process.exit(0);
    });

  } catch (err) {
    console.error('Failed:', err);
  } finally {
    await session.close();
  }
}

run();
