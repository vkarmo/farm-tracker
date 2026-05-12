import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { queueAction } from '../store/syncSlice';
import { addPoi, deletePoi } from '../store/poiSlice';
import { MapPin, X } from 'lucide-react';
import CrudTable from './CrudTable';
import { MapContainer, TileLayer, Polygon, Polyline, Marker, useMapEvents } from 'react-leaflet';
import { MapSearchBox, MapFlyTo, FarmLocationButton } from './MapSearchBox';
import area from '@turf/area';
import length from '@turf/length';
import { polygon, lineString } from '@turf/helpers';
import 'leaflet/dist/leaflet.css';


const ClickToDrawComponent = ({ points, setPoints, setCenter }) => {
  useMapEvents({
    click(e) {
      setPoints([...points, [e.latlng.lat, e.latlng.lng, Date.now()]]);
    }
  });
  return null;
};

const INIT_STATE = { name: '', type: 'Terrain Feature', description: '', area: '', length: '', drawColor: '' };

export default function PoiTab() {
  const dispatch = useDispatch();
  const poiList = useSelector(state => state.poi?.list) || [];
  const polygonColor = useSelector(state => state.settings?.polygonColor) || '#ffffff';
  const mapCenter = useSelector(state => state.settings?.mapCenter) || [51.505, -0.09];
  const mapZoom = useSelector(state => state.settings?.mapZoom) || 13;

  const [formData, setFormData] = useState(INIT_STATE);
  const [editingId, setEditingId] = useState(null);
  const [points, setPoints] = useState([]);
  const [searchResultCenter, setSearchResultCenter] = useState(null);

  const handleLocationFound = (loc) => {
    const newLoc = loc.length >= 3 ? loc : [loc[0], loc[1], Date.now()];
    setSearchResultCenter(newLoc);
    setPoints(prev => [...prev, newLoc]);
  };

  useEffect(() => {
    if (points.length >= 2) {
      try {
        const lineRing = points.map(p => [p[1], p[0]]); // Turf expects [lng, lat]
        const turfLine = lineString(lineRing);
        const lineLengthKm = length(turfLine, { units: 'kilometers' });
        const lineLengthMeters = lineLengthKm * 1000;
        
        let calculatedArea = 0;
        if (points.length >= 3) {
          const polyRing = [...lineRing];
          if (polyRing[0][0] !== polyRing[polyRing.length - 1][0] || polyRing[0][1] !== polyRing[polyRing.length - 1][1]) {
            polyRing.push([...polyRing[0]]); // Close the ring for area calculation
          }
          const turfPoly = polygon([polyRing]);
          const sqMeters = area(turfPoly);
          calculatedArea = sqMeters * 0.000247105; // Acres
        }

        setFormData(prev => ({ 
          ...prev, 
          length: lineLengthMeters.toFixed(2),
          area: calculatedArea ? calculatedArea.toFixed(2) : prev.area 
        }));
      } catch (err) {
        console.warn("Geographic computation failed:", err);
      }
    } else {
      setFormData(prev => ({ ...prev, length: '', area: '' }));
    }
  }, [points]);

  const handleSubmit = (e) => {
    e.preventDefault();
        if (!formData.name.trim()) return alert("Validation Error: POI Name is required.");

    const finalData = { ...formData, points: JSON.stringify(points) };

    if (editingId) {
      // UPDATE
      const updatedPoi = { ...finalData, id: editingId };
      dispatch(addPoi(updatedPoi)); // Handles update logic based on findIndex
      dispatch(queueAction({ type: 'core/updateNode', payload: { id: editingId, properties: updatedPoi }, meta: { id: Date.now() } }));
    } else {
      // CREATE
      const newPoi = { ...finalData, id: `poi_${Date.now()}` };
      dispatch(addPoi(newPoi));
      dispatch(queueAction({ type: 'poi/addPoi', payload: newPoi, meta: { id: Date.now() } }));
    }

    setFormData(INIT_STATE);
    setEditingId(null);
    setPoints([]);
  };

  const handleEdit = (row) => {
    setFormData(row);
    setEditingId(row.id);
    if (row.points) {
      try {
        setPoints(JSON.parse(row.points));
      } catch (e) { setPoints([]); }
    } else {
      setPoints([]);
    }
  };

  const clearDrawing = () => {
    setPoints([]);
    setFormData(prev => ({ ...prev, area: '', length: '' }));
  };

  const columns = [
    { key: 'name', header: 'POI Name' },
    { key: 'type', header: 'Type' },
    { key: 'description', header: 'Description' },
    { key: 'area', header: 'Area (Acres)', render: r => r.area || '-' },
    { key: 'length', header: 'Length (Meters)', render: r => r.length || '-' }
  ];

  // Map rendering logic
  const sortedPositions = points
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
        <h2>{editingId ? 'Edit Point of Interest' : 'Record Point of Interest'}</h2>
        {editingId && (
          <button onClick={() => { setEditingId(null); setFormData(INIT_STATE); setPoints([]); }} className="btn" style={{ background: '#f5f5f5', color: '#333' }}>
            <X size={14} style={{ marginRight: 4 }} /> Cancel Edit
          </button>
        )}
      </div>

      <div style={{ marginBottom: '10px' }}>
        <MapSearchBox onLocationFound={handleLocationFound} onClear={clearDrawing} />
      </div>
      <div style={{ marginBottom: '20px', height: '400px', width: '100%', borderRadius: '8px', overflow: 'hidden', border: '2px solid var(--color-border)', position: 'relative' }}>

        <MapContainer center={mapCenter} zoom={mapZoom} maxZoom={24} style={{ height: '100%', width: '100%' }} zoomControl={false}>
          <TileLayer attribution="Google Maps" url="http://mt0.google.com/vt/lyrs=y&hl=en&x={x}&y={y}&z={z}&s=Ga" maxZoom={24} maxNativeZoom={20} />
          
          <MapFlyTo center={searchResultCenter} />
          <ClickToDrawComponent points={points} setPoints={setPoints} setCenter={setSearchResultCenter} />

          {latLngs.length > 2 && <Polygon positions={latLngs} pathOptions={{ color: formData.drawColor || polygonColor, weight: 2, fillOpacity: 0.3 }} />}
          {latLngs.length > 1 && latLngs.length <= 2 && <Polyline positions={latLngs} pathOptions={{ color: formData.drawColor || polygonColor, weight: 3 }} />}
          {latLngs.map((pos, idx) => (
            <Marker key={idx} position={pos} opacity={0.8} />
          ))}

          {/* Render existing POIs for context */}
          {poiList.filter(p => p.id !== editingId).map(p => {
             let existingPts = [];
             try { existingPts = JSON.parse(p.points); } catch(e){}
             if (!existingPts || existingPts.length === 0) return null;
             const mappedPts = existingPts.map(pt => [pt[0], pt[1]]);
             if (mappedPts.length > 2) {
                return <Polygon key={p.id} positions={mappedPts} pathOptions={{ color: p.drawColor || polygonColor, weight: 1, fillOpacity: 0.1 }} />
             } else if (mappedPts.length > 1) {
                return <Polyline key={p.id} positions={mappedPts} pathOptions={{ color: p.drawColor || polygonColor, weight: 2 }} />
             } else {
                return <Marker key={p.id} position={mappedPts[0]} opacity={0.5} />
             }
          })}
        </MapContainer>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="form-grid">
          <div className="form-group form-grid-full">
            <label>POI Name</label>
            <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. North Creek, Water Well 1" required />
          </div>
          <div className="form-group">
            <label>Type</label>
            <select value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value })}>
              <option value="Water Source">Water Source</option>
              <option value="Terrain Feature">Terrain Feature</option>
              <option value="Infrastructure">Infrastructure</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div className="form-group">
            <label>Description</label>
            <input type="text" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder="Short description" />
          </div>
          <div className="form-group">
            <label>Calculated Length (Meters)</label>
            <input type="number" step="0.01" value={formData.length} onChange={e => setFormData({ ...formData, length: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Calculated Area (Acres)</label>
            <input type="number" step="0.01" value={formData.area} onChange={e => setFormData({ ...formData, area: e.target.value })} />
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
          <MapPin size={16} style={{ marginRight: 6 }} /> {editingId ? 'Update POI' : 'Save POI'}
        </button>
      </form>

      <hr style={{ border: 'none', borderTop: '1px solid var(--color-border)', margin: '30px 0' }} />

      <CrudTable 
        data={poiList} 
        columns={columns} 
        onEdit={handleEdit} 
        onDelete={(id) => {
          dispatch(deletePoi(id));
          dispatch(queueAction({ type: 'core/deleteNode', payload: { id }, meta: { id: Date.now() } }));
        }} 
        itemLabel="Point of Interest" 
      />
    </div>
  );
}
