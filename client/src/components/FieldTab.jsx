import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { queueAction } from '../store/syncSlice';
import { addField, updateField, deleteField } from '../store/fieldsSlice';
import { CheckCircle2, Target, X } from 'lucide-react';
import CrudTable from './CrudTable';
import { MapContainer, TileLayer, Polygon, Marker, useMapEvents } from 'react-leaflet';
import { MapSearchBox, MapFlyTo, CurrentLocationControl } from './MapSearchBox';
import area from '@turf/area';
import { polygon } from '@turf/helpers';
import 'leaflet/dist/leaflet.css';

const ClickToDrawComponent = ({ polygon, setPolygon }) => {
  useMapEvents({
    click(e) {
      setPolygon([...polygon, [e.latlng.lat, e.latlng.lng]]);
    }
  });
  return null;
};

const INIT_STATE = { name: '', area: '', year: String(new Date().getFullYear()), soil_type: 'Loam', irrigation: 'None', status: 'Fallow', gps: '' };

export default function FieldTab() {
  const dispatch = useDispatch();
  const fields = useSelector(state => state.fields.data) || [];
  const polygonColor = useSelector(state => state.settings?.polygonColor) || '#ffffff';
  const mapCenter = useSelector(state => state.settings?.mapCenter) || [51.505, -0.09];
  const mapZoom = useSelector(state => state.settings?.mapZoom) || 13;

  const [formData, setFormData] = useState(INIT_STATE);
  const [editingId, setEditingId] = useState(null);
  const [polygonPositions, setPolygonPositions] = useState([]);
  const [searchResultCenter, setSearchResultCenter] = useState(null);

  const handleLocationFound = (loc) => {
    setSearchResultCenter(loc);
    setPolygonPositions(prev => [...prev, loc]);
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
        setPolygonPositions(JSON.parse(row.polygon));
      } catch (e) { setPolygonPositions([]); }
    } else {
      setPolygonPositions([]);
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

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>{editingId ? 'Edit Field Geometry' : 'Track New Field Geometry'}</h2>
        {editingId && (
          <button onClick={() => { setEditingId(null); setFormData(INIT_STATE); setPolygonPositions([]); }} className="btn" style={{ background: '#f5f5f5', color: '#333' }}>
            <X size={14} style={{ marginRight: 4 }} /> Cancel Edit
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit}>
        <div className="form-grid">
          <div className="form-group form-grid-full" style={{ marginBottom: '15px' }}>
            <label style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Draw Field Location on Map (Click to add points to polygon)</span>
              {polygonPositions.length > 0 && (
                <button type="button" onClick={() => setPolygonPositions([])} className="btn" style={{ padding: '2px 8px', fontSize: '12px' }}>
                  Clear Drawing
                </button>
              )}
            </label>
            <div style={{ marginBottom: '10px' }}>
              <MapSearchBox onLocationFound={handleLocationFound} />
            </div>
            <div style={{ height: '300px', width: '100%', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
              <MapContainer key={editingId || 'new'} center={polygonPositions.length > 0 ? polygonPositions[0] : mapCenter} zoom={polygonPositions.length > 0 ? 16 : mapZoom} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
                <MapFlyTo center={searchResultCenter} />
                <TileLayer
                  attribution="Google Maps"
                  url="http://mt0.google.com/vt/lyrs=y&hl=en&x={x}&y={y}&z={z}&s=Ga"
                />
                <CurrentLocationControl onLocationFound={handleLocationFound} />
                <ClickToDrawComponent polygon={polygonPositions} setPolygon={setPolygonPositions} />
                {polygonPositions.map((pos, idx) => (
                  <Marker key={`pin_${idx}`} position={pos} />
                ))}
                {polygonPositions.length > 0 && (
                  <Polygon positions={polygonPositions} pathOptions={{ color: polygonColor }} />
                )}
              </MapContainer>
            </div>
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
              <option>Loam</option><option>Clay</option><option>Sandy</option><option>Silt</option>
            </select>
          </div>
          <div className="form-group">
            <label>Irrigation Type</label>
            <select value={formData.irrigation} onChange={e => setFormData({ ...formData, irrigation: e.target.value })}>
              <option>None</option><option>Drip</option><option>Sprinkler</option><option>Flood</option><option>Creek</option><option>Well</option><option>Rain</option>
            </select>
          </div>
          <div className="form-group">
            <label>Current Status</label>
            <select value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })}>
              <option>Fallow</option><option>Cover Crop</option><option>Prepared</option><option>Planted</option>
            </select>
          </div>
        </div>
        <button type="submit" className="btn btn-primary" style={{ marginTop: 10 }}>
          <CheckCircle2 size={16} style={{ marginRight: 6 }} /> {editingId ? 'Update Field' : 'Save Field Data'}
        </button>
      </form>

      <hr style={{ border: 'none', borderTop: '1px solid var(--color-border)', margin: '30px 0' }} />

      <CrudTable
        data={fields}
        columns={columns}
        onEdit={handleEdit}
        onDelete={handleDelete}
        itemLabel="Field"
      />
    </div>
  );
}
