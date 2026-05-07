import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { saveSoilTest, removeSoilTest } from '../store/soilTestsSlice';
import { queueAction } from '../store/syncSlice';
import CrudTable from './CrudTable';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import { MapSearchBox, MapFlyTo } from './MapSearchBox';
import { MapPin, X, FlaskConical } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

let isSubmitting = false;

const INIT_TEST_STATE = { 
  fieldId: '', 
  description: '',
  testResults: []
};

const ClickToPlaceMarker = ({ position, setPosition, setCenter }) => {
  useMapEvents({
    click(e) {
      setPosition([e.latlng.lat, e.latlng.lng]);
      if (setCenter) setCenter([e.latlng.lat, e.latlng.lng]);
    }
  });
  return null;
};

export default function SoilTestingTab() {
  const dispatch = useDispatch();
  const soilTests = useSelector(state => state.soilTests?.tests) || [];
  const fields = useSelector(state => state.fields?.data) || [];
  const mapCenter = useSelector(state => state.settings?.mapCenter) || [51.505, -0.09];
  const mapZoom = useSelector(state => state.settings?.mapZoom) || 13;

  const [testData, setTestData] = useState(INIT_TEST_STATE);
  const [editingId, setEditingId] = useState(null);
  
  const [markerPosition, setMarkerPosition] = useState(null);
  const [searchResultCenter, setSearchResultCenter] = useState(null);

  // Sub-form for test results
  const [newResultDate, setNewResultDate] = useState(new Date().toISOString().split('T')[0]);
  const [newResultPh, setNewResultPh] = useState('');
  const [newResultN, setNewResultN] = useState('');
  const [newResultP, setNewResultP] = useState('');
  const [newResultK, setNewResultK] = useState('');
  const [newResultLat, setNewResultLat] = useState('');
  const [newResultLng, setNewResultLng] = useState('');
  const [newResultElevation, setNewResultElevation] = useState('');

  // Sync marker position with form data
  useEffect(() => {
    if (markerPosition) {
      setNewResultLat(markerPosition[0]);
      setNewResultLng(markerPosition[1]);
    }
  }, [markerPosition]);

  const handleLocationFound = (loc) => {
    setSearchResultCenter(loc);
    setMarkerPosition(loc);
    
    // Attempt to get elevation if HTML5 geolocation is available
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (pos.coords.altitude !== null) {
            setNewResultElevation(pos.coords.altitude.toFixed(2));
          }
        },
        (err) => console.warn("Could not get altitude:", err),
        { enableHighAccuracy: true }
      );
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    isSubmitting = true;
    setTimeout(() => { isSubmitting = false; }, 1000);
        if (isSubmitting) return;
    isSubmitting = true;
    setTimeout(() => { isSubmitting = false; }, 1000);
        if (!testData.fieldId) return alert("Please select a related Field.");

    const payload = {
      ...testData,
      id: editingId || `st_${Date.now()}`,
      testResults: testData.testResults || []
    };

    dispatch(saveSoilTest(payload));
    dispatch(queueAction({ type: 'soilTests/saveSoilTest', payload, meta: { id: Date.now() } }));

    setTestData(INIT_TEST_STATE);
    setEditingId(null);
    setMarkerPosition(null);
  };

  const handleDelete = (id) => {
    if (window.confirm("Delete this soil test?")) {
      dispatch(removeSoilTest(id));
      dispatch(queueAction({ type: 'core/deleteNode', payload: { id }, meta: { id: Date.now() } }));
      if (editingId === id) {
        setTestData(INIT_TEST_STATE);
        setEditingId(null);
        setMarkerPosition(null);
      }
    }
  };

  const handleEdit = (row) => {
    setTestData({ ...INIT_TEST_STATE, ...row });
    setEditingId(row.id);
    setMarkerPosition(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAddResult = () => {
    if (!newResultDate) return alert("Date is required for a test result.");
    const rec = { 
      id: Date.now(), 
      date: newResultDate, 
      ph: newResultPh, 
      nitrogen: newResultN, 
      phosphorus: newResultP, 
      potassium: newResultK,
      lat: newResultLat,
      lng: newResultLng,
      elevation: newResultElevation
    };
    setTestData(prev => ({
      ...prev,
      testResults: [...(prev.testResults || []), rec]
    }));
    setNewResultPh('');
    setNewResultN('');
    setNewResultP('');
    setNewResultK('');
    setNewResultLat('');
    setNewResultLng('');
    setNewResultElevation('');
    setMarkerPosition(null);
  };

  const handleRemoveResult = (recId) => {
    setTestData(prev => ({
      ...prev,
      testResults: (prev.testResults || []).filter(r => r.id !== recId)
    }));
  };

  const columns = [
    { key: 'description', header: 'Description' },
    { key: 'fieldId', header: 'Field', render: (r) => fields.find(f => f.id === r.fieldId)?.name || 'Unknown' },
    { key: 'results', header: 'Results', render: (r) => `${(r.testResults || []).length} Recorded` }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>{editingId ? 'Edit Soil Test' : 'Record Soil Test'}</h2>
          {editingId && (
            <button onClick={() => { setEditingId(null); setTestData(INIT_TEST_STATE); setMarkerPosition(null); }} className="btn" style={{ background: '#f5f5f5', color: '#333' }}>
              <X size={14} style={{ marginRight: 4 }} /> Cancel Edit
            </button>
          )}
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            
            <div className="form-group form-grid-full">
              <label>Related Field *</label>
              <select value={testData.fieldId} onChange={e => setTestData({ ...testData, fieldId: e.target.value })} required>
                <option value="">Select a Field...</option>
                {[...fields].sort((a,b) => (a.name || '').localeCompare(b.name || '')).map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>

            <div className="form-group form-grid-full">
              <label>Description / Notes</label>
              <input type="text" value={testData.description} onChange={e => setTestData({ ...testData, description: e.target.value })} placeholder="Observations, lab name, sample depth..." />
            </div>

          </div>

          <div style={{ marginTop: '20px', padding: '15px', background: '#f8f9fa', borderRadius: '8px', border: '1px solid #e0e0e0' }}>
            <h4 style={{ margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: '6px' }}><FlaskConical size={14} /> Individual Test Results</h4>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '15px' }}>
              {(testData.testResults || []).length === 0 ? (
                <span style={{fontSize: '0.85rem', color: '#888', fontStyle: 'italic'}}>No test results recorded yet.</span>
              ) : (
                (testData.testResults || []).map(r => (
                  <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: 'white', borderRadius: '4px', border: '1px solid #ddd', fontSize: '0.9rem' }}>
                    <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
                      <span><strong>{r.date}</strong></span>
                      {r.ph && <span>pH: {r.ph}</span>}
                      {r.nitrogen && <span>N: {r.nitrogen}</span>}
                      {r.phosphorus && <span>P: {r.phosphorus}</span>}
                      {r.potassium && <span>K: {r.potassium}</span>}
                      {r.lat && r.lng && <span style={{ color: '#0066cc' }}><MapPin size={12} style={{marginRight: 2}}/> {r.lat}, {r.lng}</span>}
                      {r.elevation && <span>Elev: {r.elevation}m</span>}
                    </div>
                    <button type="button" onClick={() => handleRemoveResult(r.id)} style={{ border: 'none', background: 'none', color: '#d32f2f', cursor: 'pointer' }}><X size={14}/></button>
                  </div>
                ))
              )}
            </div>

            <hr style={{ borderTop: '1px solid #ddd', borderBottom: 'none', margin: '15px 0' }} />
            
            <div className="form-group form-grid-full" style={{ marginBottom: '15px' }}>
              <label style={{ fontSize: '0.85rem' }}>Capture GPS Location for this result (Optional)</label>
              <div style={{ marginBottom: '10px' }}>
                <MapSearchBox 
                  onLocationFound={handleLocationFound}
                  onClear={markerPosition ? () => { setMarkerPosition(null); setNewResultLat(''); setNewResultLng(''); setNewResultElevation(''); } : null}
                />
              </div>
              <div style={{ height: '200px', width: '100%', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
                <MapContainer key={editingId || 'new_test'} center={markerPosition || mapCenter} zoom={markerPosition ? 16 : mapZoom} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
                  <MapFlyTo center={searchResultCenter} />
                  <TileLayer
                    attribution="Google Maps"
                    url="http://mt0.google.com/vt/lyrs=y&hl=en&x={x}&y={y}&z={z}&s=Ga"
                  />
                  <ClickToPlaceMarker position={markerPosition} setPosition={setMarkerPosition} setCenter={setSearchResultCenter} />
                  {markerPosition && <Marker position={markerPosition} />}
                </MapContainer>
              </div>
            </div>

            <div className="form-group form-grid-full" style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'flex-end', marginTop: '10px' }}>
              <div style={{ flex: '1 1 60px', marginBottom: 0 }}>
                <label style={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}>Lat</label>
                <input type="number" step="any" style={{ padding: '8px 4px', fontSize: '0.8rem' }} value={newResultLat} onChange={e => { setNewResultLat(e.target.value); if (e.target.value && newResultLng) setMarkerPosition([parseFloat(e.target.value), parseFloat(newResultLng)]) }} placeholder="Auto" />
              </div>
              <div style={{ flex: '1 1 60px', marginBottom: 0 }}>
                <label style={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}>Lng</label>
                <input type="number" step="any" style={{ padding: '8px 4px', fontSize: '0.8rem' }} value={newResultLng} onChange={e => { setNewResultLng(e.target.value); if (newResultLat && e.target.value) setMarkerPosition([parseFloat(newResultLat), parseFloat(e.target.value)]) }} placeholder="Auto" />
              </div>
              <div style={{ flex: '1 1 50px', marginBottom: 0 }}>
                <label style={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}>Elev(m)</label>
                <input type="number" step="any" style={{ padding: '8px 4px', fontSize: '0.8rem' }} value={newResultElevation} onChange={e => setNewResultElevation(e.target.value)} placeholder="150" />
              </div>
              <div style={{ flex: '1 1 100px', marginBottom: 0 }}>
                <label style={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}>Date</label>
                <input type="date" style={{ padding: '8px 4px', fontSize: '0.8rem' }} value={newResultDate} onChange={e => setNewResultDate(e.target.value)} />
              </div>
              <div style={{ flex: '1 1 40px', marginBottom: 0 }}>
                <label style={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}>pH</label>
                <input type="number" step="0.1" style={{ padding: '8px 4px', fontSize: '0.8rem' }} value={newResultPh} onChange={e => setNewResultPh(e.target.value)} placeholder="6.5" />
              </div>
              <div style={{ flex: '1 1 40px', marginBottom: 0 }}>
                <label style={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}>N</label>
                <input type="number" step="0.1" style={{ padding: '8px 4px', fontSize: '0.8rem' }} value={newResultN} onChange={e => setNewResultN(e.target.value)} placeholder="ppm" />
              </div>
              <div style={{ flex: '1 1 40px', marginBottom: 0 }}>
                <label style={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}>P</label>
                <input type="number" step="0.1" style={{ padding: '8px 4px', fontSize: '0.8rem' }} value={newResultP} onChange={e => setNewResultP(e.target.value)} placeholder="ppm" />
              </div>
              <div style={{ flex: '1 1 40px', marginBottom: 0 }}>
                <label style={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}>K</label>
                <input type="number" step="0.1" style={{ padding: '8px 4px', fontSize: '0.8rem' }} value={newResultK} onChange={e => setNewResultK(e.target.value)} placeholder="ppm" />
              </div>
              <button type="button" onClick={handleAddResult} className="btn" style={{ height: '32px', padding: '0 10px', background: '#e3f2fd', color: '#1565c0', marginBottom: 0, whiteSpace: 'nowrap' }}>
                Add
              </button>
            </div>
          </div>

          <button type="submit" className="btn btn-primary" style={{ marginTop: 20 }}>
            <FlaskConical size={16} style={{ marginRight: 6 }} /> {editingId ? 'Update Soil Test' : 'Save Soil Test'}
          </button>
        </form>
      </div>

      <div className="card">
        <CrudTable 
          data={soilTests}
          columns={columns}
          onEdit={handleEdit}
          onDelete={handleDelete}
          itemLabel="Soil Test"
          defaultSort={{ key: 'date', direction: 'desc' }}
        />
      </div>
    </div>
  );
}
