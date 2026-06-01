import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { queueAction } from '../store/syncSlice';
import { addPoi, deletePoi } from '../store/poiSlice';
import { MapPin, X, Copy } from 'lucide-react';
import CrudTable from './CrudTable';
import { MapContainer, TileLayer, Polygon, Polyline, Marker, useMapEvents } from 'react-leaflet';
import ResizableMapWrapper, { MapResizer } from './ResizableMapWrapper';
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
  const fields = useSelector(state => state.fields.data) || [];
  const nurseries = useSelector(state => state.nurseries?.beds) || [];

  const [activeTab, setActiveTab] = useState('roster');
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

  const resetForm = () => {
    setFormData(INIT_STATE);
    setEditingId(null);
    setPoints([]);
    setActiveTab('roster');
  };

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

    resetForm();
  };

  const handleEdit = (row) => {
    setFormData(row);
    setEditingId(row.id);
    if (row.points) {
      try {
        const pts = typeof row.points === 'string' ? JSON.parse(row.points) : row.points;
        setPoints(Array.isArray(pts) ? pts : []);
        if (Array.isArray(pts) && pts.length > 0) setSearchResultCenter(pts[0]);
      } catch (e) { setPoints([]); }
    } else {
      setPoints([]);
      setSearchResultCenter(mapCenter);
    }
    setActiveTab('entry');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = (id) => {
    if (window.confirm("Permanently delete this point of interest?")) {
      dispatch(deletePoi(id));
      dispatch(queueAction({ type: 'core/deleteNode', payload: { id }, meta: { id: Date.now() } }));
      if (editingId === id) resetForm();
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border-light)', background: '#f5f7fa' }}>
          <button 
            type="button"
            onClick={() => setActiveTab('roster')} 
            style={{ 
              flex: 1, 
              padding: '12px 16px', 
              border: 'none', 
              background: activeTab === 'roster' ? 'white' : 'transparent', 
              borderBottom: activeTab === 'roster' ? '3px solid var(--color-primary)' : 'none',
              color: activeTab === 'roster' ? 'var(--color-primary)' : 'var(--color-text-light)',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
              fontSize: '0.95rem'
            }}
          >
            POI Registry
          </button>
          <button 
            type="button"
            onClick={() => setActiveTab('entry')} 
            style={{ 
              flex: 1, 
              padding: '12px 16px', 
              border: 'none', 
              background: activeTab === 'entry' ? 'white' : 'transparent', 
              borderBottom: activeTab === 'entry' ? '3px solid var(--color-primary)' : 'none',
              color: activeTab === 'entry' ? 'var(--color-primary)' : 'var(--color-text-light)',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
              fontSize: '0.95rem'
            }}
          >
            {editingId ? 'Edit Configuration' : 'Record POI'}
          </button>
        </div>

        <div style={{ padding: '20px' }}>
          {activeTab === 'roster' ? (
            <CrudTable activeRowId={editingId}
              data={poiList}
              columns={columns}
              onEdit={handleEdit}
              onDelete={handleDelete}
              itemLabel="Point of Interest"
            />
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h2 style={{ margin: 0 }}>{editingId ? 'Edit Point of Interest' : 'Record Point of Interest'}</h2>
                {editingId && (
                  <button type="button" onClick={resetForm} className="btn" style={{ background: '#f5f5f5', color: '#333' }}>
                    <X size={14} style={{ marginRight: 4 }} /> Cancel Edit
                  </button>
                )}
              </div>

              <div style={{ marginBottom: '10px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <MapSearchBox onLocationFound={handleLocationFound} onClear={clearDrawing} polygon={points} setPolygon={setPoints} activeId={editingId} />
                </div>
              </div>
              <ResizableMapWrapper initialHeight={500} style={{ marginBottom: '20px' }}>
                <MapContainer center={mapCenter} zoom={mapZoom} maxZoom={24} style={{ height: '100%', width: '100%' }} zoomControl={false}>
                  <MapResizer />
                  <TileLayer attribution="Google Maps" url="https://mt0.google.com/vt/lyrs=y&hl=en&x={x}&y={y}&z={z}&s=Ga" maxZoom={24} maxNativeZoom={20} />

                  <MapFlyTo center={searchResultCenter} />
                  <ClickToDrawComponent points={points} setPoints={setPoints} setCenter={setSearchResultCenter} />

                  {latLngs.length > 2 && <Polygon positions={latLngs} pathOptions={{ color: formData.drawColor || polygonColor, weight: 1.5, opacity: 0.6, fillOpacity: 0.3 }} />}
                  {latLngs.length > 1 && latLngs.length <= 2 && <Polyline positions={latLngs} pathOptions={{ color: formData.drawColor || polygonColor, weight: 2, opacity: 0.7 }} />}
                  {latLngs.map((pos, idx) => (
                    <Marker key={idx} position={pos} opacity={0.8} />
                  ))}

                  {/* Render existing POIs for editing (clickable) */}
                  {poiList.filter(p => p.id !== editingId).map(p => {
                    let existingPts = [];
                    try { existingPts = typeof p.points === 'string' ? JSON.parse(p.points) : p.points; } catch (e) { }
                    if (!existingPts || existingPts.length === 0) return null;
                    const mappedPts = existingPts.map(pt => [pt[0], pt[1]]);

                    const handleClick = (e) => {
                      e.originalEvent.stopPropagation();
                      if (editingId || points.length > 0) return;
                      handleEdit(p);
                    };

                    if (mappedPts.length > 2) {
                      return <Polygon key={p.id} positions={mappedPts} pathOptions={{ color: p.drawColor || polygonColor, weight: 1.2, opacity: 0.6, fillOpacity: 0.1, bubblingMouseEvents: false }} eventHandlers={{ click: handleClick }} />
                    } else if (mappedPts.length > 1) {
                      return <Polyline key={p.id} positions={mappedPts} pathOptions={{ color: p.drawColor || polygonColor, weight: 1.5, opacity: 0.6, bubblingMouseEvents: false }} eventHandlers={{ click: handleClick }} />
                    } else {
                      return <Marker key={p.id} position={mappedPts[0]} opacity={0.5} bubblingMouseEvents={false} eventHandlers={{ click: handleClick }} />
                    }
                  })}

                  {/* Render fields for context (unclickable) */}
                  {fields.map(f => {
                    let positions = [];
                    if (f.polygon) { try { positions = typeof f.polygon === 'string' ? JSON.parse(f.polygon) : f.polygon; } catch (e) { } }
                    if (positions.length === 0) return null;
                    return <Polygon key={f.id} positions={positions} pathOptions={{ color: f.drawColor || '#ffffff', weight: 0.8, opacity: 0.5, dashArray: '5,5', fillOpacity: 0.1 }} interactive={false} />;
                  })}

                  {/* Render nurseries for context (unclickable) */}
                  {nurseries.map(n => {
                    let positions = [];
                    if (n.polygon) { try { positions = typeof n.polygon === 'string' ? JSON.parse(n.polygon) : n.polygon; } catch (e) { } }
                    if (positions.length === 0) return null;
                    return <Polygon key={n.id} positions={positions} pathOptions={{ color: n.drawColor || 'orange', weight: 0.8, opacity: 0.5, dashArray: '5,5', fillOpacity: 0.1 }} interactive={false} />;
                  })}

                </MapContainer>
              </ResizableMapWrapper>

              <form onSubmit={handleSubmit}>
                <div className="form-grid">
                  <div className="form-group form-grid-full">
                    <label>Point of Interest Name</label>
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}

