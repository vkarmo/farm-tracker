import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { saveSoilTest, removeSoilTest } from '../store/soilTestsSlice';
import { queueAction } from '../store/syncSlice';
import CrudTable from './CrudTable';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, Polygon, Polyline } from 'react-leaflet';
import FieldImageryOverlay, { getDeterministicSceneDate, getDeterministicCloudCover } from './FieldImageryOverlay';
import ResizableMapWrapper, { MapResizer } from './ResizableMapWrapper';
import { MapSearchBox, MapFlyTo, FarmLocationButton } from './MapSearchBox';
import { MapPin, X, FlaskConical, Copy } from 'lucide-react';
import 'leaflet/dist/leaflet.css';


const INIT_TEST_STATE = { 
  fieldId: '', 
  description: '',
  testResults: [],
  drawColor: ''
};

const ClickToPlaceMarker = ({ position, setPosition, setCenter }) => {
  useMapEvents({
    click(e) {
      setPosition([e.latlng.lat, e.latlng.lng]);
    }
  });
  return null;
};

export default function SoilTestingTab() {
  const dispatch = useDispatch();
  const soilTests = useSelector(state => state.soilTests?.tests) || [];
  const fields = useSelector(state => state.fields?.data) || [];
  const nurseries = useSelector(state => state.assets?.nurseries) || [];
  const pois = useSelector(state => state.assets?.pois) || [];
  const mapCenter = useSelector(state => state.settings?.mapCenter) || [51.505, -0.09];
  const mapZoom = useSelector(state => state.settings?.mapZoom) || 13;
  const polygonColor = useSelector(state => state.settings?.polygonColor) || '#ffffff';

  const [testData, setTestData] = useState(INIT_TEST_STATE);
  const [editingId, setEditingId] = useState(null);
  
  const [markerPosition, setMarkerPosition] = useState(null);
  const [searchResultCenter, setSearchResultCenter] = useState(null);
  const [fieldImagery, setFieldImagery] = useState({});
  const [fieldImageryOffsets, setFieldImageryOffsets] = useState({});
  const [geeStatus, setGeeStatus] = useState({});

  useEffect(() => {
    const handler = (e) => {
      const { fieldId, status, error } = e.detail;
      setGeeStatus(prev => ({ ...prev, [fieldId]: { status, error } }));
    };
    window.addEventListener('gee-status-change', handler);
    return () => window.removeEventListener('gee-status-change', handler);
  }, []);

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
    const newLoc = loc.length >= 3 ? loc : [loc[0], loc[1], Date.now()];
    setSearchResultCenter(newLoc);
    setMarkerPosition(newLoc);
    setTestData({ ...testData, lat: newLoc[0], lng: newLoc[1] });
    
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

            <div className="form-group">
              <label>Draw Color</label>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <input type="color" value={testData.drawColor || polygonColor} onChange={e => setTestData({ ...testData, drawColor: e.target.value })} />
                {testData.drawColor && (
                  <button type="button" onClick={() => setTestData({ ...testData, drawColor: '' })} className="btn" style={{ padding: '2px 8px', fontSize: '0.8rem' }}>Clear</button>
                )}
              </div>
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
              <div style={{ marginBottom: '10px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <MapSearchBox 
                    onLocationFound={handleLocationFound}
                    onClear={markerPosition ? () => { setMarkerPosition(null); setNewResultLat(''); setNewResultLng(''); setNewResultElevation(''); } : null}
                  />
                </div>
                {markerPosition && (
                  <button 
                    type="button" 
                    className="btn map-toolbar-btn" 
                    style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    onClick={() => {
                      const str = `[(${markerPosition[0]}, ${markerPosition[1]})]`;
                      navigator.clipboard.writeText(str);
                      window.dispatchEvent(new CustomEvent('show-toast', { detail: 'Coordinates copied to clipboard!' }));
                    }} 
                    title="Copy Coordinates to Clipboard"
                  >
                    <Copy size={16} />
                  </button>
                )}
              </div>
              <ResizableMapWrapper initialHeight={500} style={{ marginBottom: '15px' }}>
                <MapContainer key={editingId || 'new_test'} center={markerPosition || mapCenter} zoom={markerPosition ? 16 : mapZoom} maxZoom={24} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
                  <MapResizer />
                  <MapFlyTo center={searchResultCenter} />
                  <TileLayer
                    attribution="Google Maps"
                    url="https://mt0.google.com/vt/lyrs=y&hl=en&x={x}&y={y}&z={z}&s=Ga"
                    maxZoom={24}
                    maxNativeZoom={20}
                  />
                  <ClickToPlaceMarker position={markerPosition} setPosition={setMarkerPosition} setCenter={setSearchResultCenter} />
                  {markerPosition && <Marker position={markerPosition} />}

                  {/* Render fields for context (interactive for imagery toggle) */}
                  {fields.map(f => {
                    let positions = [];
                    if (f.polygon) { try { positions = typeof f.polygon === 'string' ? JSON.parse(f.polygon) : f.polygon; } catch(e){} }
                    if (positions.length === 0) return null;

                    const showImagery = fieldImagery[f.id] && fieldImagery[f.id] !== 'none';
                    const isLoaded = geeStatus[f.id]?.status === 'success' || geeStatus[f.id]?.status === 'failed';
                    const makeTransparent = showImagery && isLoaded;

                    return (
                      <React.Fragment key={f.id}>
                        <Polygon 
                          key={f.id}
                          positions={positions} 
                          pathOptions={{ 
                            color: f.drawColor || '#ffffff', 
                            weight: 0.8, 
                            opacity: 0.5,
                            dashArray: '5,5', 
                            fill: true,
                            fillOpacity: makeTransparent ? 0.0 : 0.1 
                          }} 
                          interactive={true}
                        >
                          <Popup>
                            <div style={{ minWidth: '200px' }}>
                              <strong>{f.name}</strong><br/>
                              Area: {f.area} ac<br/>
                              <div style={{ marginTop: '8px' }}>
                                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Field Imagery:</label>
                                <select 
                                  value={fieldImagery[f.id] || 'none'} 
                                  onChange={(e) => setFieldImagery(prev => ({ ...prev, [f.id]: e.target.value }))}
                                  style={{ padding: '4px', fontSize: '0.8rem', borderRadius: '4px', width: '100%', background: 'white' }}
                                >
                                  <option value="none">None (Standard)</option>
                                  <optgroup label="Satellite Indices">
                                    <option value="CurrentSatellite">Current Satellite View</option>
                                    <option value="NDVI">NDVI (Vegetation Index)</option>
                                    <option value="NDWI">NDWI (Water Index)</option>
                                    <option value="EVI">EVI (Enhanced Vegetation)</option>
                                    <option value="SoilMoisture">Soil Moisture</option>
                                    <option value="FalseColor">False Color (Biomass)</option>
                                    <option value="TrueColor">True Color (RGB)</option>
                                  </optgroup>
                                  <optgroup label="Weather Map Overlays">
                                    <option value="OWM_Clouds">Weather: Clouds (OpenWeather)</option>
                                    <option value="OWM_Precipitation">Weather: Precipitation (OpenWeather)</option>
                                    <option value="OWM_Temperature">Weather: Temperature (OpenWeather)</option>
                                    <option value="OWM_Wind">Weather: Wind Speed (OpenWeather)</option>
                                    <option value="OWM_Pressure">Weather: Sea Level Pressure (OpenWeather)</option>
                                  </optgroup>
                                </select>
                              </div>
                              {fieldImagery[f.id] && fieldImagery[f.id] !== 'none' && (
                                <div style={{ marginTop: '8px', padding: '6px', background: '#f1f8e9', borderRadius: '4px', border: '1px solid #c5e1a5', fontSize: '0.72rem', color: '#33691e' }}>
                                  <div style={{ fontWeight: 700, marginBottom: '2px' }}>
                                    {fieldImagery[f.id] === 'OWM_Clouds' ? 'Weather: Clouds' :
                                     fieldImagery[f.id] === 'OWM_Precipitation' ? 'Weather: Precipitation' :
                                     fieldImagery[f.id] === 'OWM_Temperature' ? 'Weather: Temperature' :
                                     fieldImagery[f.id] === 'OWM_Wind' ? 'Weather: Wind Speed' :
                                     fieldImagery[f.id] === 'OWM_Pressure' ? 'Weather: Sea Level Pressure' :
                                     fieldImagery[f.id] === 'CurrentSatellite' ? 'Current Satellite (High-Res)' : 'Sentinel-2 (10m Index)'}
                                  </div>
                                  {geeStatus[f.id] && geeStatus[f.id].status === 'failed' && (
                                    <div style={{ marginTop: '4px', color: '#c62828', fontWeight: 600, fontSize: '0.65rem', lineHeight: '1.2' }}>
                                      {fieldImagery[f.id].startsWith('OWM_') 
                                        ? `⚠ Weather Map Failed: ${geeStatus[f.id].error}` 
                                        : `⚠ GEE Failed: ${geeStatus[f.id].error}. Showing simulation.`}
                                    </div>
                                  )}
                                  {geeStatus[f.id] && geeStatus[f.id].status === 'success' && (
                                    <div style={{ marginTop: '4px', color: '#2e7d32', fontWeight: 600, fontSize: '0.65rem', lineHeight: '1.2' }}>
                                      {fieldImagery[f.id].startsWith('OWM_') 
                                        ? '✓ Live weather overlay loaded.' 
                                        : '✓ Live Earth Engine imagery loaded.'}
                                    </div>
                                  )}
                                  {geeStatus[f.id] && geeStatus[f.id].status === 'loading' && (
                                    <div style={{ marginTop: '4px', color: '#1565c0', fontSize: '0.65rem', lineHeight: '1.2' }}>
                                      {fieldImagery[f.id].startsWith('OWM_') 
                                        ? 'Fetching weather overlay tiles...' 
                                        : 'Fetching GEE tiles...'}
                                    </div>
                                  )}
                                  {!fieldImagery[f.id]?.startsWith('OWM_') && (
                                    <>
                                      <div>Scene Date: {getDeterministicSceneDate(f.id, fieldImageryOffsets[f.id] || 0)}</div>
                                      <div>Cloud Cover: {getDeterministicCloudCover(f.id, fieldImageryOffsets[f.id] || 0)}%</div>
                                      
                                      <div style={{ display: 'flex', marginTop: '6px', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                                          <span style={{ fontSize: '0.62rem', fontWeight: 600, color: '#558b2f' }}>Older</span>
                                          <button
                                            type="button"
                                            className="btn btn-secondary"
                                            style={{ padding: '2px 8px', fontSize: '0.75rem', cursor: 'pointer', marginTop: '2px', width: '100%', lineHeight: 1 }}
                                            onClick={() => setFieldImageryOffsets(prev => ({ ...prev, [f.id]: (prev[f.id] || 0) - 30 }))}
                                          >
                                            ←
                                          </button>
                                        </div>
                                        
                                        <span style={{ fontWeight: 700, fontSize: '0.68rem', margin: '0 8px', minWidth: '55px', textAlign: 'center', alignSelf: 'flex-end', marginBottom: '4px' }}>
                                          {(fieldImageryOffsets[f.id] || 0) === 0 ? 'Latest' : `${Math.abs(fieldImageryOffsets[f.id] || 0)}d ago`}
                                        </span>

                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                                          <span style={{ fontSize: '0.62rem', fontWeight: 600, color: '#558b2f' }}>Newer</span>
                                          <button
                                            type="button"
                                            className="btn btn-secondary"
                                            style={{ padding: '2px 8px', fontSize: '0.75rem', cursor: 'pointer', marginTop: '2px', width: '100%', lineHeight: 1 }}
                                            disabled={(fieldImageryOffsets[f.id] || 0) >= 0}
                                            onClick={() => setFieldImageryOffsets(prev => ({ ...prev, [f.id]: (prev[f.id] || 0) + 30 }))}
                                          >
                                            →
                                          </button>
                                        </div>
                                      </div>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          </Popup>
                        </Polygon>
                        {fieldImagery[f.id] && fieldImagery[f.id] !== 'none' && (
                          <FieldImageryOverlay 
                            polygon={positions} 
                            indexType={fieldImagery[f.id]} 
                            dateOffset={fieldImageryOffsets[f.id] || 0}
                            fieldId={f.id}
                          />
                        )}
                      </React.Fragment>
                    );
                  })}

                  {/* Render nurseries for context (unclickable) */}
                  {nurseries.map(n => {
                    let positions = [];
                    if (n.polygon) { try { positions = typeof n.polygon === 'string' ? JSON.parse(n.polygon) : n.polygon; } catch(e){} }
                    if (positions.length === 0) return null;
                    return <Polygon key={n.id} positions={positions} pathOptions={{ color: n.drawColor || 'orange', weight: 0.8, opacity: 0.5, dashArray: '5,5', fillOpacity: 0.1 }} interactive={false} />;
                  })}

                  {/* Render POIs for context (unclickable) */}
                  {pois.map(p => {
                    let existingPts = [];
                    try { existingPts = typeof p.points === 'string' ? JSON.parse(p.points) : p.points; } catch(e){}
                    if (!existingPts || existingPts.length === 0) return null;
                    const mappedPts = existingPts.map(pt => [pt[0], pt[1]]);
                    if (mappedPts.length > 2) {
                       return <Polygon key={p.id} positions={mappedPts} pathOptions={{ color: p.drawColor || polygonColor, weight: 0.8, opacity: 0.5, dashArray: '5,5', fillOpacity: 0.1 }} interactive={false} />
                    } else if (mappedPts.length > 1) {
                       return <Polyline key={p.id} positions={mappedPts} pathOptions={{ color: p.drawColor || polygonColor, weight: 2, dashArray: '5,5' }} interactive={false} />
                    } else {
                       return <Marker key={p.id} position={mappedPts[0]} opacity={0.5} interactive={false} />
                    }
                  })}
                </MapContainer>
              </ResizableMapWrapper>
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
        <CrudTable activeRowId={editingId} 
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
