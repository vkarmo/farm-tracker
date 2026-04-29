import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { queueAction } from '../store/syncSlice';
import { addEquipment, updateEquipment, deleteEquipment } from '../store/assetsSlice';
import { CheckCircle2, X } from 'lucide-react';
import CrudTable from './CrudTable';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import { MapSearchBox, MapFlyTo, CurrentLocationControl } from './MapSearchBox';
import 'leaflet/dist/leaflet.css';

const ClickToMarkComponent = ({ setGpsLocation }) => {
  useMapEvents({
    click(e) {
      setGpsLocation([e.latlng.lat, e.latlng.lng]);
    }
  });
  return null;
};

const INIT_STATE = { name: '', type: 'Machinery', value: '', status: 'Active', purchaseDate: '' };

export default function EquipmentTab() {
  const dispatch = useDispatch();
  const equipment = useSelector(state => state.assets?.equipment) || [];
  const mapCenter = useSelector(state => state.settings?.mapCenter) || [51.505, -0.09];
  
  const [formData, setFormData] = useState(INIT_STATE);
  const [editingId, setEditingId] = useState(null);
  const [gpsLocation, setGpsLocation] = useState(null);
  const [searchResultCenter, setSearchResultCenter] = useState(null);

  const handleLocationFound = (loc) => {
    setSearchResultCenter(loc);
    setGpsLocation(loc); // Equipments only have 1 active pin
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
    
    setFormData(INIT_STATE);
    setEditingId(null);
    setGpsLocation(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleEdit = (row) => {
    setFormData({
      name: row.name || '',
      type: row.type || 'Machinery',
      value: row.value || '',
      status: row.status || 'Active',
      purchaseDate: row.purchaseDate || ''
    });
    setEditingId(row.id);
    
    if (row.gpsLocation) {
      try {
        setGpsLocation(JSON.parse(row.gpsLocation));
      } catch(e) { setGpsLocation(null); }
    } else {
      setGpsLocation(null);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = (id) => {
    if(window.confirm("Permanently delete this core asset profile?")) {
      dispatch(deleteEquipment(id));
      dispatch(queueAction({ type: 'core/deleteNode', payload: { id }, meta: { id: Date.now() } }));
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
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>{editingId ? 'Edit Configuration' : 'Register Hard Asset'}</h2>
        {editingId && (
          <button onClick={() => { setEditingId(null); setFormData(INIT_STATE); setGpsLocation(null); }} className="btn" style={{ background: '#f5f5f5', color: '#333' }}>
            <X size={14} style={{ marginRight: 4 }} /> Close Route
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit}>
        <div className="form-grid">
          <div className="form-group form-grid-full" style={{ marginBottom: '15px' }}>
            <label style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Drop Hardware Map Pin (Click to mark location)</span>
              {gpsLocation && (
                <button type="button" onClick={() => setGpsLocation(null)} className="btn" style={{ padding: '2px 8px', fontSize: '12px' }}>
                  Clear Pin Drop
                </button>
              )}
            </label>
            <div style={{ marginBottom: '10px' }}>
              <MapSearchBox onLocationFound={handleLocationFound} />
            </div>
            <div style={{ height: '280px', width: '100%', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
              <MapContainer key={editingId || 'new'} center={gpsLocation || mapCenter} zoom={gpsLocation ? 16 : 14} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
                <MapFlyTo center={searchResultCenter} />
                <TileLayer
                  attribution="Google Maps"
                  url="http://mt0.google.com/vt/lyrs=y&hl=en&x={x}&y={y}&z={z}&s=Ga"
                />
                <CurrentLocationControl onLocationFound={handleLocationFound} />
                <ClickToMarkComponent setGpsLocation={setGpsLocation} />
                {gpsLocation && (
                  <Marker position={gpsLocation} />
                )}
              </MapContainer>
            </div>
          </div>

          <div className="form-group">
            <label>Asset Identifier *</label>
            <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. Ford F-150, Camera 1" required/>
          </div>

          <div className="form-group">
            <label>Asset Classification</label>
            <select value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>
              <option>Machinery</option>
              <option>Vehicle</option>
              <option>Infrastructure</option>
              <option>Security</option>
              <option>Tools</option>
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
              <option>Maintenance</option>
              <option>Broken</option>
              <option>Missing</option>
              <option>Decommissioned</option>
            </select>
          </div>
          
          <div className="form-group">
            <label>Purchase / Acquisition Date</label>
            <input type="date" value={formData.purchaseDate} onChange={e => setFormData({...formData, purchaseDate: e.target.value})} />
          </div>
        </div>

        <button type="submit" className="btn btn-primary" style={{marginTop: 20}}>
          <CheckCircle2 size={16} style={{marginRight: 6}}/> {editingId ? 'Update Asset Core' : 'Register To Database'}
        </button>
      </form>

      <hr style={{border: 'none', borderTop: '1px solid var(--color-border)', margin: '30px 0'}} />

      <CrudTable 
        data={equipment} 
        columns={columns} 
        onEdit={handleEdit} 
        onDelete={handleDelete} 
        itemLabel="Asset" 
      />
    </div>
  );
}
