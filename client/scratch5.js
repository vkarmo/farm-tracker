const test1 = '[[1,2],[3,4],[5,6]]';
const test2 = '{"type":"Feature","geometry":{"type":"Polygon","coordinates":[[[1,2],[3,4],[5,6]]]}}';
const test3 = '{"type":"Polygon","coordinates":[[[1,2],[3,4],[5,6]]]}';

const parseIt = (poly) => {
  let arr;
  try { arr = typeof poly === 'string' ? JSON.parse(poly) : poly; } catch(e) { return; }
  
  // If it's a Feature or Geometry object
  if (arr && typeof arr === 'object' && !Array.isArray(arr)) {
    if (arr.type === 'Feature' && arr.geometry && arr.geometry.coordinates) {
      arr = arr.geometry.coordinates[0]; // Polygon has coordinates [[[lng, lat], ...]]
    } else if (arr.type === 'Polygon' && arr.coordinates) {
      arr = arr.coordinates[0];
    } else {
      console.log("Unknown object format:", arr);
      return;
    }
  }
  
  console.log("Parsed to array:", arr);
};

parseIt(test1);
parseIt(test2);
parseIt(test3);

