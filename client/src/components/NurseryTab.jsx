import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { queueAction } from '../store/syncSlice';
import { addBed, deleteBed } from '../store/nurserySlice';
import { transplantCrop } from '../store/assetsSlice';
import { Box, MoveRight, X, Copy } from 'lucide-react';
import CrudTable from './CrudTable';
import { MapContainer, TileLayer, Polygon, Marker, Popup, useMapEvents } from 'react-leaflet';
import FieldImageryOverlay, { getDeterministicSceneDate, getDeterministicCloudCover } from './FieldImageryOverlay';
import ResizableMapWrapper, { MapResizer } from './ResizableMapWrapper';
import { MapSearchBox, MapFlyTo, FarmLocationButton } from './MapSearchBox';
import area from '@turf/area';
import { polygon } from '@turf/helpers';
import 'leaflet/dist/leaflet.css';


const ClickToDrawComponent = ({ polygon, setPolygon, setCenter }) => {
  useMapEvents({
    click(e) {
      setPolygon([...polygon, [e.latlng.lat, e.latlng.lng, Date.now()]]);
    }
  });
  return null;
};

const INIT_BED = { name: '', capacity: '', area: '', status: 'Available', gps: '', drawColor: '' };

export default function NurseryTab() {
  const dispatch = useDispatch();
  const nurseries = useSelector(state => state.nurseries?.beds) || [];
  const crops = useSelector(state => state.assets.crops) || [];
  const polygonColor = useSelector(state => state.settings?.polygonColor) || '#ffffff';
  const mapCenter = useSelector(state => state.settings?.mapCenter) || [51.505, -0.09];
  const mapZoom = useSelector(state => state.settings?.mapZoom) || 13;
  const fields = useSelector(state => state.fields.data) || [];
  const pois = useSelector(state => state.poi?.list) || [];

  const [bedData, setBedData] = useState(INIT_BED);
  const [editingId, setEditingId] = useState(null);
  const [transplantFieldId, setTransplantFieldId] = useState('');
  const [polygonPositions, setPolygonPositions] = useState([]);
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

  const handleLocationFound = (loc) => {
    const newLoc = loc.length >= 3 ? loc : [loc[0], loc[1], Date.now()];
    setSearchResultCenter(newLoc);
    setPolygonPositions(prev => [...prev, newLoc]);
  };

  useEffect(() => {
    if (polygonPositions.length >= 3) {
      try {
        const ring = polygonPositions.map(p => [p[1], p[0]]); // Turf expects [lng, lat]
        if (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1]) {
          ring.push([...ring[0]]); // Close the ring
        }
        const turfPoly = polygon([ring]);
        const sqMeters = area(turfPoly);
        const sqFeet = sqMeters * 10.7639; // Use sq ft for Nursery beds since they are intimately smaller than Fields
        setBedData(prev => ({ ...prev, area: sqFeet.toFixed(2) }));
      } catch (err) {
        console.warn("Geographic computation failed:", err);
      }
    }
  }, [polygonPositions]);

  const handleAddBed = (e) => {
    e.preventDefault();
        if (!bedData.name.trim()) return alert("Validation Error: Bed/Tray Name is required.");
    const parsedCap = parseFloat(bedData.capacity);
    if (bedData.capacity && (isNaN(parsedCap) || parsedCap < 0)) return alert("Validation Error: Bed Capacity must be positive.");
    if (!bedData.name) return;
    
    const finalData = { ...bedData, polygon: JSON.stringify(polygonPositions) };

    if (editingId) {
      const updatedBed = { ...finalData, id: editingId };
      dispatch(addBed(updatedBed)); // addBed actually functions as an upsert/merge locally
      dispatch(queueAction({ type: 'core/updateNode', payload: { id: editingId, properties: updatedBed }, meta: { id: Date.now() } }));
    } else {
      const newBed = { id: `n_${Date.now()}`, ...finalData };
      dispatch(addBed(newBed));
      dispatch(queueAction({ type: 'nurseries/addBed', payload: newBed, meta: { id: Date.now() } }));
    }
    
    setBedData(INIT_BED);
    setEditingId(null);
    setPolygonPositions([]);
  };

  const handleTransplant = (cropId) => {
    if (!transplantFieldId) return alert("Select a destination field first!");
    const tData = { id: cropId, fieldId: transplantFieldId, transplantDate: new Date().toISOString().split('T')[0] };
    dispatch(transplantCrop(tData));
    dispatch(queueAction({ type: 'assets/transplantCrop', payload: tData, meta: { id: Date.now() } }));
    setTransplantFieldId('');
  };

  const nurseryColumns = [
    { key: 'name', header: 'Bed/Tray Name' },
    { key: 'area', header: 'Est. Area (Sq Ft)', render: (r) => r.area ? `${r.area} sqft` : '-' },
    { key: 'capacity', header: 'Plug Capacity' },
    { key: 'status', header: 'Status' }
  ];

  const sortedPositions = polygonPositions
    .map((p, i) => ({ pos: p, idx: i, time: p.length > 2 ? p[2] : 0 }))
    .sort((a, b) => {
      if (a.time === 0 && b.time === 0) return a.idx - b.idx;
      return a.time - b.time;
    })
    .map(obj => obj.pos);

  const latLngs = sortedPositions.map(p => [p[0], p[1]]);

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>{editingId ? 'Edit Nursery Bed' : 'Nursery Bed Management'}</h2>
        {editingId && (
          <button onClick={() => { setEditingId(null); setBedData(INIT_BED); setPolygonPositions([]); }} className="btn" style={{ background: '#f5f5f5', color: '#333' }}>
            <X size={14} style={{ marginRight: 4 }} /> Cancel Edit
          </button>
        )}
      </div>
      
      {!editingId && <p style={{fontSize: '0.85rem', color: 'var(--color-text-light)', marginBottom: 20}}>Define greenhouse tables, plug trays, or starter beds where you germinate crops before field-transplantation.</p>}
      
      <form onSubmit={handleAddBed} style={{marginBottom: 30}}>
        <div className="form-grid">
          <div className="form-group form-grid-full" style={{ marginBottom: '15px' }}>
            <label>Draw Nursery Location on Map (Click to add points to polygon)</label>
            <div style={{ marginBottom: '10px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <MapSearchBox 
                  onLocationFound={handleLocationFound} 
                  onClear={polygonPositions.length > 0 ? () => setPolygonPositions([]) : null}
                  polygon={polygonPositions}
                  setPolygon={setPolygonPositions}
                  activeId={editingId}
                />
              </div>
            </div>
            <ResizableMapWrapper initialHeight={500} style={{ marginBottom: '15px' }}>
              <MapContainer key={editingId || 'new'} center={latLngs.length > 0 ? latLngs[0] : mapCenter} zoom={latLngs.length > 0 ? 17 : mapZoom} maxZoom={24} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
                <MapResizer />
                <MapFlyTo center={searchResultCenter} />
                <TileLayer
                  attribution="Google Maps"
                  url="https://mt0.google.com/vt/lyrs=y&hl=en&x={x}&y={y}&z={z}&s=Ga"
                  maxZoom={24}
                  maxNativeZoom={20}
                />
                <ClickToDrawComponent polygon={polygonPositions} setPolygon={setPolygonPositions} setCenter={setSearchResultCenter} />
                {latLngs.map((pos, idx) => (
                  <Marker key={`pin_${idx}`} position={pos} />
                ))}
                {latLngs.length > 0 && (
                  <Polygon positions={latLngs} pathOptions={{ color: bedData.drawColor || polygonColor }} />
                )}
                {/* Render existing saved beds (clickable for editing) */}
                {nurseries.filter(b => b.id !== editingId).map(bed => {
                  let positions = [];
                  if (bed.polygon) {
                    try { positions = typeof bed.polygon === 'string' ? JSON.parse(bed.polygon) : bed.polygon; } catch (e) {}
                  }
                  if (positions.length === 0) return null;
                  return (
                    <Polygon 
                      key={bed.id} 
                      positions={positions} 
                      pathOptions={{ color: bed.drawColor || polygonColor, weight: 2, fillOpacity: 0.4, bubblingMouseEvents: false }} 
                      eventHandlers={{ click: (e) => {
                        e.originalEvent.stopPropagation();
                        if (editingId || polygonPositions.length > 0) return;
                        handleEdit(bed);
                      } }}
                    />
                  );
                })}
                {/* Render fields for context (interactive for imagery toggle) */}
                {fields.map(f => {
                  let positions = [];
                  if (f.polygon) { try { positions = typeof f.polygon === 'string' ? JSON.parse(f.polygon) : f.polygon; } catch(e){} }
                  if (positions.length === 0) return null;
                  return (
                    <React.Fragment key={f.id}>
                      <Polygon 
                        positions={positions} 
                        pathOptions={{ 
                          color: f.drawColor || '#ffffff', 
                          weight: 1, 
                          dashArray: '5,5', 
                          fillOpacity: fieldImagery[f.id] && fieldImagery[f.id] !== 'none' ? 0.0 : 0.1 
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
                                <option value="CurrentSatellite">Current Satellite View</option>
                                <option value="NDVI">NDVI (Vegetation Index)</option>
                                <option value="NDWI">NDWI (Water Index)</option>
                                <option value="EVI">EVI (Enhanced Vegetation)</option>
                                <option value="SoilMoisture">Soil Moisture</option>
                                <option value="FalseColor">False Color (Biomass)</option>
                                <option value="TrueColor">True Color (RGB)</option>
                              </select>
                            </div>
                             {fieldImagery[f.id] && fieldImagery[f.id] !== 'none' && (
                               <div style={{ marginTop: '8px', padding: '6px', background: '#f1f8e9', borderRadius: '4px', border: '1px solid #c5e1a5', fontSize: '0.72rem', color: '#33691e' }}>
                                  <div style={{ fontWeight: 700, marginBottom: '2px' }}>
                                    {fieldImagery[f.id] === 'CurrentSatellite' ? 'Current Satellite (High-Res)' : 'Sentinel-2 (10m Index)'}
                                  </div>
                                  {geeStatus[f.id] && geeStatus[f.id].status === 'failed' && (
                                    <div style={{ marginTop: '4px', color: '#c62828', fontWeight: 600, fontSize: '0.65rem', lineHeight: '1.2' }}>
                                      ⚠ GEE Failed: {geeStatus[f.id].error}. Showing simulation.
                                    </div>
                                  )}
                                  {geeStatus[f.id] && geeStatus[f.id].status === 'success' && (
                                    <div style={{ marginTop: '4px', color: '#2e7d32', fontWeight: 600, fontSize: '0.65rem', lineHeight: '1.2' }}>
                                      ✓ Live Earth Engine imagery loaded.
                                    </div>
                                  )}
                                  {geeStatus[f.id] && geeStatus[f.id].status === 'loading' && (
                                    <div style={{ marginTop: '4px', color: '#1565c0', fontSize: '0.65rem', lineHeight: '1.2' }}>
                                      Fetching GEE tiles...
                                    </div>
                                  )}
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
                {/* Render POIs for context (unclickable) */}
                {pois.map(p => {
                  let positions = [];
                  if (p.points) { try { positions = typeof p.points === 'string' ? JSON.parse(p.points) : p.points; } catch(e){} }
                  if (positions.length === 0) return null;
                  return <Polygon key={p.id} positions={positions} pathOptions={{ color: 'purple', weight: 1, dashArray: '5,5', fillOpacity: 0.1 }} interactive={false} />;
                })}
              </MapContainer>
            </ResizableMapWrapper>
          </div>
          <div className="form-group">
            <label>Bed/Tray Designation</label>
            <input type="text" value={bedData.name} onChange={e => setBedData({...bedData, name: e.target.value})} placeholder="e.g. Greenhouse Rack A"/>
          </div>
          <div className="form-group">
            <label>Physical Area (Sq Ft)</label>
            <input type="number" step="0.01" value={bedData.area} onChange={e => setBedData({...bedData, area: e.target.value})} placeholder="e.g. 50.0"/>
          </div>
          <div className="form-group">
            <label>Plug Capacity</label>
            <input type="number" value={bedData.capacity} onChange={e => setBedData({...bedData, capacity: e.target.value})} placeholder="e.g. 72"/>
          </div>
          <div className="form-group">
            <label>Draw Color</label>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <input type="color" value={bedData.drawColor || polygonColor} onChange={e => setBedData({ ...bedData, drawColor: e.target.value })} />
              {bedData.drawColor && (
                <button type="button" onClick={() => setBedData({ ...bedData, drawColor: '' })} className="btn" style={{ padding: '2px 8px', fontSize: '0.8rem' }}>Clear</button>
              )}
            </div>
          </div>
        </div>
        <button type="submit" className="btn btn-primary" style={{marginTop: 10}}><Box size={16} style={{marginRight: 6}}/> {editingId ? 'Update Bed' : 'Save Nursery Bed Data'}</button>
      </form>

      <CrudTable activeRowId={editingId} 
        data={nurseries} 
        columns={nurseryColumns} 
        onEdit={(row) => { 
          setBedData(row); 
          setEditingId(row.id); 
          if (row.polygon) {
            try {
              const poly = typeof row.polygon === 'string' ? JSON.parse(row.polygon) : row.polygon;
              setPolygonPositions(Array.isArray(poly) ? poly : []);
              if (Array.isArray(poly) && poly.length > 0) setSearchResultCenter(poly[0]);
            } catch(e) { 
              setPolygonPositions([]); 
            }
          } else { 
            setPolygonPositions([]); 
            setSearchResultCenter(mapCenter);
          }
        }} 
        onDelete={(id) => {
          dispatch(deleteBed(id));
          dispatch(queueAction({ type: 'core/deleteNode', payload: { id }, meta: { id: Date.now() } }));
        }} 
        itemLabel="Bed" 
        defaultSort={{ key: 'name', direction: 'asc' }}
      />

      <hr style={{border: 'none', borderTop: '1px solid var(--color-border)', margin: '40px 0 20px 0'}} />
      
      <h3>Transplant Required Seedlings</h3>
      <p style={{fontSize: '0.85rem', color: 'var(--color-text-light)', marginBottom: 10}}>Crops below were Sown in a Nursery. Select a destination field to formally Transplant them into the ground.</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {crops.filter(c => c.sowType === 'Nursery').length === 0 && <span style={{fontStyle: 'italic', color: '#888'}}>No seedlings currently germinating...</span>}
        {crops.filter(c => c.sowType === 'Nursery').map(crop => (
          <div key={crop.id} className="list-item" style={{display: 'flex', flexDirection: 'column', gap: 10}}>
              <div style={{fontWeight: 600}}>{crop.name} ({crop.variety})</div>
              <div style={{fontSize: '0.85rem', color: '#555'}}>Sown on: {crop.plantingDate} in Bed: {nurseries.find(n => n.id === crop.fieldId)?.name || crop.fieldId}</div>
              
              <div style={{display: 'flex', gap: 10, marginTop: 5}}>
                <select value={transplantFieldId} onChange={e => setTransplantFieldId(e.target.value)} style={{flex: 1}}>
                  <option value="">Choose Destination Field...</option>
                  {[...fields].sort((a,b) => (a.name || '').localeCompare(b.name || '')).map(f => <option key={f.id} value={f.id}>{f.name} - {f.year}</option>)}
                </select>
                <button onClick={() => handleTransplant(crop.id)} className="btn btn-primary"><MoveRight size={14} style={{marginRight: 4}}/> Move to Field</button>
              </div>
          </div>
        ))}
      </div>
    </div>
  );
}
