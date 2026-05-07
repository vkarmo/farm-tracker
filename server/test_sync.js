async function test() {
  try {
    const res = await fetch('http://127.0.0.1:3001/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        queue: [
          {
            type: 'fields/addField',
            payload: { id: 'test_field_1', name: 'Test', area: 10, soil_type: 'clay', irrigation: 'drip', status: 'active', year: '2026', polygon: [] },
            meta: { id: Date.now() }
          }
        ]
      })
    });
    console.log(res.status);
    console.log(await res.text());
  } catch (e) {
    console.error(e);
  }
}
test();
