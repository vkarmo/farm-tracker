import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { queueAction } from '../store/syncSlice';
import { updateField, addField, deleteField } from '../store/fieldsSlice';
import { CheckCircle2, Target, X, PlusCircle, Copy } from 'lucide-react';
import CrudTable from './CrudTable';
import { MapContainer, TileLayer, Polygon, Marker, useMapEvents } from 'react-leaflet';
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

const INIT_STATE = { name: '', area: '', year: String(new Date().getFullYear()), soil_type: 'Loam', irrigation: 'None', status: 'Fallow', gps: '', drawColor: '' };
const INIT_TEST_STATE = { date: new Date().toISOString().split('T')[0], ph: '', nitrogen: '', phosphorus: '', potassium: '', notes: '' };

export default function FieldTab() {
  const dispatch = useDispatch();
  const fields = useSelector(state => state.fields.data) || [];
  const nurseries = useSelector(state => state.nurseries?.beds) || [];
  const pois = useSelector(state => state.poi?.list) || [];
  const soilTests = useSelector(state => state.soilTests?.tests) || [];
  const polygonColor = useSelector(state => state.settings?.polygonColor) || '#ffffff';
  const mapCenter = useSelector(state => state.settings?.mapCenter) || [51.505, -0.09];
  const mapZoom = useSelector(state => state.settings?.mapZoom) || 13;

  const [formData, setFormData] = useState(INIT_STATE);
  const [editingId, setEditingId] = useState(null);
  const [polygonPositions, setPolygonPositions] = useState([]);
  const [searchResultCenter, setSearchResultCenter] = useState(null);

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
        const acres = sqMeters * 0.000247105;
        // Do not violently overwrite if they typed something manually right before, 
        // but if it's explicitly calculated, update state
        setFormData(prev => ({ ...prev, area: acres.toFixed(2) }));
      } catch (err) {
        console.warn("Geographic computation failed:", err);
      }
    }
  }, [polygonPositions]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return alert("Validation Error: Field Name is strictly required.");
    if (parseFloat(formData.area) < 0) return alert("Validation Error: Mathematical acreage cannot be negative.");
    if (!formData.name || !formData.area) return;

    const finalData = { ...formData, polygon: JSON.stringify(polygonPositions) };

    if (editingId) {
      // UPDATE
      const updatedField = { ...finalData, id: editingId };
      dispatch(updateField(updatedField));
      dispatch(queueAction({ type: 'core/updateNode', payload: { id: editingId, properties: updatedField }, meta: { id: Date.now() } }));
    } else {
      // CREATE
      const newField = { ...finalData, id: `f_${Date.now()}` };
      dispatch(addField(newField));
      // fields/addField logic on server uses MERGE and sets all props, so it acts like an update/create.
      dispatch(queueAction({ type: 'fields/addField', payload: newField, meta: { id: Date.now() } }));
    }

    setFormData(INIT_STATE);
    setEditingId(null);
    setPolygonPositions([]);
  };

  const handleEdit = (row) => {
    setFormData(row);
    setEditingId(row.id);
    if (row.polygon) {
      try {
        const poly = typeof row.polygon === 'string' ? JSON.parse(row.polygon) : row.polygon;
        setPolygonPositions(Array.isArray(poly) ? poly : []);
        if (poly.length > 0) setSearchResultCenter(poly[0]);
      } catch (e) { setPolygonPositions([]); }
    } else {
      setPolygonPositions([]);
      setSearchResultCenter(mapCenter);
    }
  };

  const handleDelete = (id) => {
    dispatch(deleteField(id));
    dispatch(queueAction({ type: 'core/deleteNode', payload: { id }, meta: { id: Date.now() } }));
  };

  const columns = [
    { key: 'name', header: 'Field Name' },
    { key: 'year', header: 'Vintage' },
    { key: 'area', header: 'Acres' },
    { key: 'soil_type', header: 'Soil' },
    { key: 'status', header: 'Status' }
  ];



  const fieldTests = soilTests.filter(t => t.fieldId === editingId);
  const testColumns = [
    { key: 'description', header: 'Description' },
    { key: 'gps', header: 'GPS Points', render: (r) => (r.testResults || []).some(res => res.lat && res.lng) ? 'Yes' : 'No' },
    { key: 'results', header: 'Results', render: (r) => `${(r.testResults || []).length} Recorded` }
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
        <h2>{editingId ? 'Edit Field Data' : 'Enter New Field Data'}</h2>
        {editingId && (
          <button onClick={() => { setEditingId(null); setFormData(INIT_STATE); setPolygonPositions([]); }} className="btn" style={{ background: '#f5f5f5', color: '#333' }}>
            <X size={14} style={{ marginRight: 4 }} /> Cancel Edit
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit}>
        <div className="form-grid">
          <div className="form-group form-grid-full" style={{ marginBottom: '15px' }}>
            <label>Draw Field Location on Map (Click to add points to polygon)</label>
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
            <ResizableMapWrapper initialHeight={300} style={{ marginBottom: '15px' }}>
              <MapContainer key={editingId || 'new'} center={latLngs.length > 0 ? latLngs[0] : mapCenter} zoom={latLngs.length > 0 ? 16 : mapZoom} maxZoom={24} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
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
                  <Polygon positions={latLngs} pathOptions={{ color: formData.drawColor || polygonColor }} />
                )}
                {/* Render existing saved fields (clickable for editing) */}
                {fields.filter(f => f.id !== editingId).map(field => {
                  let positions = [];
                  if (field.polygon) {
                    try { positions = typeof field.polygon === 'string' ? JSON.parse(field.polygon) : field.polygon; } catch (e) { }
                  }
                  if (positions.length === 0) return null;
                  return (
                    <Polygon
                      key={field.id}
                      positions={positions}
                      pathOptions={{ color: field.drawColor || polygonColor, weight: 2, fillOpacity: 0.3, bubblingMouseEvents: false }}
                      eventHandlers={{
                        click: (e) => {
                          e.originalEvent.stopPropagation();
                          if (editingId || polygonPositions.length > 0) return;
                          handleEdit(field);
                        }
                      }}
                    />
                  );
                })}
                {/* Render nurseries for context (unclickable) */}
                {nurseries.map(n => {
                  let positions = [];
                  if (n.polygon) { try { positions = typeof n.polygon === 'string' ? JSON.parse(n.polygon) : n.polygon; } catch (e) { } }
                  if (positions.length === 0) return null;
                  return <Polygon key={n.id} positions={positions} pathOptions={{ color: n.drawColor || 'orange', weight: 1, dashArray: '5,5', fillOpacity: 0.1 }} interactive={false} />;
                })}
                {/* Render POIs for context (unclickable) */}
                {pois.map(p => {
                  let positions = [];
                  if (p.points) { try { positions = typeof p.points === 'string' ? JSON.parse(p.points) : p.points; } catch (e) { } }
                  if (positions.length === 0) return null;
                  return <Polygon key={p.id} positions={positions} pathOptions={{ color: 'purple', weight: 1, dashArray: '5,5', fillOpacity: 0.1 }} interactive={false} />;
                })}
              </MapContainer>
            </ResizableMapWrapper>
          </div>
          <div className="form-group">
            <label>Field Name / Identifier</label>
            <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. North Pasture" />
          </div>
          <div className="form-group">
            <label>Harvest Year / Vintage</label>
            <input type="number" value={formData.year} onChange={e => setFormData({ ...formData, year: e.target.value })} placeholder="2026" />
          </div>
          <div className="form-group">
            <label>Area Size (Acres)</label>
            <input type="number" step="0.01" value={formData.area} onChange={e => setFormData({ ...formData, area: e.target.value })} placeholder="5.5" />
          </div>
          <div className="form-group">
            <label>Soil Type</label>
            <select value={formData.soil_type} onChange={e => setFormData({ ...formData, soil_type: e.target.value })}>
              <option>Clay</option><option>Loam</option><option>Sandy</option><option>Silt</option>
            </select>
          </div>
          <div className="form-group">
            <label>Irrigation Type</label>
            <select value={formData.irrigation} onChange={e => setFormData({ ...formData, irrigation: e.target.value })}>
              <option>Creek</option><option>Drip</option><option>Flood</option><option>None</option><option>Rain</option><option>Sprinkler</option><option>Well</option>
            </select>
          </div>
          <div className="form-group">
            <label>Current Status</label>
            <select value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })}>
              <option>Cover Crop</option><option>Fallow</option><option>Planted</option><option>Prepared</option>
            </select>
          </div>
          <div className="form-group">
            <label>Draw Color</label>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <input type="color" value={formData.drawColor || polygonColor} onChange={e => setFormData({ ...formData, drawColor: e.target.value })} />
              {formData.drawColor && (
                <button type="button" onClick={() => setFormData({ ...formData, drawColor: '' })} className="btn" style={{ padding: '2px 8px', fontSize: '0.8rem' }}>Clear</button>
              )}
            </div>
          </div>
        </div>
        <button type="submit" className="btn btn-primary" style={{ marginTop: 10 }}>
          <CheckCircle2 size={16} style={{ marginRight: 6 }} /> {editingId ? 'Update Field' : 'Save Field Data'}
        </button>
      </form>

      {editingId && fieldTests.length > 0 && (
        <div style={{ marginTop: '30px', background: '#f9f9f9', padding: '15px', borderRadius: '8px', border: '1px solid #e0e0e0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>Soil Tests for {formData.name}</h3>
            <span style={{ fontSize: '0.85rem', color: '#666' }}>Add new tests in the Soil Tests tab</span>
          </div>
          <div style={{ marginTop: '15px' }}>
            <CrudTable activeRowId={editingId}
              data={fieldTests}
              columns={testColumns}
              onEdit={() => alert("Please edit soil tests from the dedicated Soil Tests tab.")}
              onDelete={() => alert("Please delete soil tests from the dedicated Soil Tests tab.")}
              itemLabel="Test"
              customTitle="Recorded Tests"
              defaultSort={{ key: 'date', direction: 'desc' }}
            />
          </div>
        </div>
      )}

      <hr style={{ border: 'none', borderTop: '1px solid var(--color-border)', margin: '30px 0' }} />

      <CrudTable activeRowId={editingId}
        data={fields}
        columns={columns}
        onEdit={handleEdit}
        onDelete={handleDelete}
        itemLabel="Field"
      />
    </div>
  );
}
