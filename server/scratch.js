const neo4j = require('neo4j-driver');
require('dotenv').config();

const REMEDIES_DATA = [
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

async function run() {
  let uri = process.env.NEO4J_URI || 'neo4j+s://3fa11aa8.databases.neo4j.io:7687';
  if (uri.includes('.databases.neo4j.io') && uri.startsWith('bolt+s://')) {
    uri = uri.replace('bolt+s://', 'neo4j+s://');
  }
  const user = process.env.NEO4J_USER || '3fa11aa8';
  const pass = process.env.NEO4J_PASSWORD || '86pHNuUi5baXVA7X05y_0gVQAHyZ72L3uCM1PQ3frUo';
  
  const driver = neo4j.driver(uri, neo4j.auth.basic(user, pass));
  const session = driver.session();
  try {
    // Fetch all pests
    const pestsRes = await session.run('MATCH (p:Pest) RETURN p.id AS id, p.name AS name, p.description AS description, p.treatment AS treatment');
    const pests = pestsRes.records.map(r => ({
      id: r.get('id'),
      name: r.get('name'),
      description: r.get('description') || '',
      treatment: r.get('treatment') || ''
    }));

    console.log(`Loaded ${pests.length} pests from database.`);

    let remediesCreated = 0;
    let linksCreated = 0;

    for (const rem of REMEDIES_DATA) {
      // Create or update Remedy node
      await session.run(`
        MERGE (r:Remedy {id: $id})
        SET r.name = $name,
            r.type = $type,
            r.description = $description,
            r.lastUpdatedBy = 'system-remedy-migration'
        RETURN r
      `, {
        id: rem.id,
        name: rem.name,
        type: rem.type,
        description: rem.description
      });
      remediesCreated++;

      // Check which pests match
      for (const pest of pests) {
        const pestText = `${pest.name} ${pest.description} ${pest.treatment}`.toLowerCase();
        let isMatch = false;

        for (const kw of rem.keywords) {
          if (pestText.includes(kw)) {
            isMatch = true;
            break;
          }
        }

        if (isMatch) {
          console.log(`Linking Remedy "${rem.name}" [${rem.type}] -> Pest "${pest.name}"`);
          await session.run(`
            MATCH (r:Remedy {id: $remedyId})
            MATCH (p:Pest {id: $pestId})
            MERGE (r)-[rel:TREATS]->(p)
            SET rel.lastUpdatedBy = 'system-remedy-migration'
            RETURN count(rel) AS cnt
          `, { remedyId: rem.id, pestId: pest.id });
          linksCreated++;
        }
      }
    }

    console.log(`Successfully created/updated ${remediesCreated} Remedy nodes.`);
    console.log(`Successfully linked ${linksCreated} TREATS relationships.`);

  } catch (e) {
    console.error('Error during remedies migration:', e);
  } finally {
    await session.close();
    await driver.close();
  }
}
run();
