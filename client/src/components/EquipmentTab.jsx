import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { queueAction } from '../store/syncSlice';
import { addEquipment, updateEquipment, deleteEquipment } from '../store/assetsSlice';
import { CheckCircle2, X, Copy } from 'lucide-react';
import CrudTable from './CrudTable';
import { MapContainer, TileLayer, Marker, useMapEvents, Polygon, Polyline } from 'react-leaflet';
import ResizableMapWrapper, { MapResizer } from './ResizableMapWrapper';
import { MapSearchBox, MapFlyTo, FarmLocationButton } from './MapSearchBox';
import 'leaflet/dist/leaflet.css';


const ClickToMarkComponent = ({ setGpsLocation, setCenter }) => {
  useMapEvents({
    click(e) {
      setGpsLocation([e.latlng.lat, e.latlng.lng]);
    }
  });
  return null;
};

const INIT_STATE = { name: '', type: 'Machinery', value: '', status: 'Active', purchaseDate: '', drawColor: '' };

export default function EquipmentTab() {
  const dispatch = useDispatch();
  const equipment = useSelector(state => state.assets?.equipment) || [];
  const fields = useSelector(state => state.fields?.data) || [];
  const nurseries = useSelector(state => state.assets?.nurseries) || [];
  const pois = useSelector(state => state.assets?.pois) || [];
  const mapCenter = useSelector(state => state.settings?.mapCenter) || [51.505, -0.09];
  const polygonColor = useSelector(state => state.settings?.polygonColor) || '#ffffff';
  
  const [formData, setFormData] = useState(INIT_STATE);
  const [editingId, setEditingId] = useState(null);
  const [gpsLocation, setGpsLocation] = useState(null);
  const [searchResultCenter, setSearchResultCenter] = useState(null);
  const [activeTab, setActiveTab] = useState('roster');

  const handleLocationFound = (loc) => {
    const newLoc = loc.length >= 3 ? loc : [loc[0], loc[1], Date.now()];
    setSearchResultCenter(newLoc);
    setGpsLocation(newLoc); // Equipments only have 1 active pin
  };

  const resetForm = () => {
    setFormData(INIT_STATE);
    setEditingId(null);
    setGpsLocation(null);
    setActiveTab('roster');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return alert("Validation Error: Asset Name is strictly required.");

    const finalData = { 
      ...formData, 
      gpsLocation: gpsLocation ? JSON.stringify(gpsLocation) : '' 
    };

    if (editingId) {
      const updatedAsset = { ...finalData, id: editingId };
      dispatch(updateEquipment(updatedAsset));
      dispatch(queueAction({ type: 'core/updateNode', payload: { id: editingId, properties: updatedAsset }, meta: { id: Date.now() } }));
    } else {
      const newAsset = { ...finalData, id: `eq_${Date.now()}` };
      dispatch(addEquipment(newAsset));
      dispatch(queueAction({ type: 'assets/addEquipment', payload: newAsset, meta: { id: Date.now() } }));
    }
    
    resetForm();
  };

  const handleEdit = (row) => {
    setFormData({
      name: row.name || '',
      type: row.type || 'Machinery',
      value: row.value || '',
      status: row.status || 'Active',
      purchaseDate: row.purchaseDate || '',
      drawColor: row.drawColor || ''
    });
    setEditingId(row.id);
    
    if (row.gpsLocation) {
      try {
        const loc = typeof row.gpsLocation === 'string' ? JSON.parse(row.gpsLocation) : row.gpsLocation;
        setGpsLocation(Array.isArray(loc) ? loc : null);
      } catch (e) { setGpsLocation(null); }
    } else {
      setGpsLocation(null);
    }
    setActiveTab('entry');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = (id) => {
    if(window.confirm("Permanently delete this core asset profile?")) {
      dispatch(deleteEquipment(id));
      dispatch(queueAction({ type: 'core/deleteNode', payload: { id }, meta: { id: Date.now() } }));
      if (editingId === id) resetForm();
    }
  };

  const columns = [
    { key: 'name', header: 'Asset Identifier' },
    { key: 'type', header: 'Classification' },
    { key: 'status', header: 'Hardware Status' },
    { 
      key: 'value', 
      header: 'Est. Value',
      render: (row) => row.value ? `$${parseFloat(row.value).toLocaleString()}` : '-'
    }
  ];

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
            Hardware Assets
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
            {editingId ? 'Edit Configuration' : 'Register Hard Asset'}
          </button>
        </div>

        <div style={{ padding: '20px' }}>
          {activeTab === 'roster' ? (
            <CrudTable activeRowId={editingId} 
              data={equipment} 
              columns={columns} 
              onEdit={handleEdit} 
              onDelete={handleDelete} 
              itemLabel="Asset" 
              defaultSort={{ key: 'name', direction: 'asc' }}
            />
          ) : (
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', justifyContent: 'flex-end' }}>
                {editingId && (
                  <button type="button" className="btn" onClick={resetForm}>
                    Cancel
                  </button>
                )}
                <button type="submit" className="btn btn-primary">
                  <CheckCircle2 size={16} style={{marginRight: 6}}/> {editingId ? 'Update Asset Core' : 'Register To Database'}
                </button>
              </div>
              <div className="form-grid">
                <div className="form-group form-grid-full">
                  <label>Asset Identifier *</label>
                  <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. Ford F-150, Camera 1" required/>
                </div>
                <div className="form-group form-grid-full" style={{ marginBottom: '15px' }}>
                  <label>Drop Hardware Map Pin (Click to mark location)</label>
                  <div style={{ marginBottom: '10px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <MapSearchBox 
                        onLocationFound={handleLocationFound}
                        onClear={gpsLocation ? () => setGpsLocation(null) : null}
                      />
                    </div>
                    {gpsLocation && (
                      <button 
                        type="button" 
                        className="btn map-toolbar-btn" 
                        style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        onClick={() => {
                          const str = `[(${gpsLocation[0]}, ${gpsLocation[1]})]`;
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
                    <MapContainer key={editingId || 'new'} center={gpsLocation || mapCenter} zoom={gpsLocation ? 16 : 14} maxZoom={24} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
                      <MapResizer />
                      <MapFlyTo center={searchResultCenter} />
                      <TileLayer
                        attribution="Google Maps"
                        url="https://mt0.google.com/vt/lyrs=y&hl=en&x={x}&y={y}&z={z}&s=Ga"
                        maxZoom={24}
                        maxNativeZoom={20}
                      />
                      <ClickToMarkComponent setGpsLocation={setGpsLocation} setCenter={setSearchResultCenter} />
                      {gpsLocation && (
                        <Marker position={gpsLocation} />
                      )}

                      {/* Render fields for context (unclickable) */}
                      {fields.map(f => {
                        let positions = [];
                        if (f.polygon) { try { positions = typeof f.polygon === 'string' ? JSON.parse(f.polygon) : f.polygon; } catch(e){} }
                        if (positions.length === 0) return null;
                        return <Polygon key={f.id} positions={positions} pathOptions={{ color: f.drawColor || '#ffffff', weight: 0.8, opacity: 0.5, dashArray: '5,5', fillOpacity: 0.1 }} interactive={false} />;
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
                           return <Polyline key={p.id} positions={mappedPts} pathOptions={{ color: p.drawColor || polygonColor, weight: 1.5, opacity: 0.5, dashArray: '5,5' }} interactive={false} />
                        } else {
                           return <Marker key={p.id} position={mappedPts[0]} opacity={0.5} interactive={false} />
                        }
                      })}
                    </MapContainer>
                  </ResizableMapWrapper>
                </div>



                <div className="form-group">
                  <label>Asset Classification</label>
                  <select value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>
                    <option>Infrastructure</option>
                    <option>Machinery</option>
                    <option>Security</option>
                    <option>Tools</option>
                    <option>Vehicle</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Approximate Value ($)</label>
                  <input type="number" step="1" value={formData.value} onChange={e => setFormData({...formData, value: e.target.value})} placeholder="7500"/>
                </div>

                <div className="form-group">
                  <label>Hardware Status</label>
                  <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
                    <option>Active</option>
                    <option>Broken</option>
                    <option>Decommissioned</option>
                    <option>Maintenance</option>
                    <option>Missing</option>
                  </select>
                </div>
                
                <div className="form-group">
                  <label>Purchase / Acquisition Date</label>
                  <input type="date" value={formData.purchaseDate} onChange={e => setFormData({...formData, purchaseDate: e.target.value})} />
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

            </form>
          )}
        </div>
      </div>
    </div>
  );
}
