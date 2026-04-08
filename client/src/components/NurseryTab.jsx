import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { queueAction } from '../store/syncSlice';
import { addBed, deleteBed } from '../store/nurserySlice';
import { transplantCrop } from '../store/assetsSlice';
import { Box, MoveRight, X } from 'lucide-react';
import CrudTable from './CrudTable';

const INIT_BED = { name: '', capacity: '', status: 'Available', gps: '' };

export default function NurseryTab() {
  const dispatch = useDispatch();
  const nurseries = useSelector(state => state.nurseries?.beds) || [];
  const crops = useSelector(state => state.assets.crops) || [];
  const fields = useSelector(state => state.fields.data) || [];

  const [bedData, setBedData] = useState(INIT_BED);
  const [editingId, setEditingId] = useState(null);
  const [transplantFieldId, setTransplantFieldId] = useState('');

  const handleAddBed = (e) => {
    e.preventDefault();
    if (!bedData.name.trim()) return alert("Validation Error: Bed/Tray Name is required.");
    const parsedCap = parseFloat(bedData.capacity);
    if (bedData.capacity && (isNaN(parsedCap) || parsedCap < 0)) return alert("Validation Error: Bed Capacity must be positive.");
    if (!bedData.name) return;
    
    if (editingId) {
      const updatedBed = { ...bedData, id: editingId };
      dispatch(addBed(updatedBed)); // addBed actually functions as an upsert/merge locally
      dispatch(queueAction({ type: 'core/updateNode', payload: { id: editingId, properties: updatedBed }, meta: { id: Date.now() } }));
    } else {
      const newBed = { id: `n_${Date.now()}`, ...bedData };
      dispatch(addBed(newBed));
      dispatch(queueAction({ type: 'nurseries/addBed', payload: newBed, meta: { id: Date.now() } }));
    }
    
    setBedData(INIT_BED);
    setEditingId(null);
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
    { key: 'capacity', header: 'Plug Capacity' },
    { key: 'status', header: 'Status' }
  ];

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>{editingId ? 'Edit Nursery Bed' : 'Nursery Bed Management'}</h2>
        {editingId && (
          <button onClick={() => { setEditingId(null); setBedData(INIT_BED); }} className="btn" style={{ background: '#f5f5f5', color: '#333' }}>
            <X size={14} style={{ marginRight: 4 }} /> Cancel Edit
          </button>
        )}
      </div>
      
      {!editingId && <p style={{fontSize: '0.85rem', color: 'var(--color-text-light)', marginBottom: 20}}>Define greenhouse tables, plug trays, or starter beds where you germinate crops before field-transplantation.</p>}
      
      <form onSubmit={handleAddBed} style={{marginBottom: 30}}>
        <div className="form-grid">
          <div className="form-group form-grid-full">
            <label>GPS Coordinates (Location of Bed/Tray)</label>
            <input type="text" value={bedData.gps} onChange={e => setBedData({...bedData, gps: e.target.value})} placeholder="e.g. 34.0522, -118.2437"/>
          </div>
          <div className="form-group">
            <label>Bed/Tray Designation</label>
            <input type="text" value={bedData.name} onChange={e => setBedData({...bedData, name: e.target.value})} placeholder="e.g. Greenhouse Rack A"/>
          </div>
          <div className="form-group">
            <label>Plug Capacity</label>
            <input type="number" value={bedData.capacity} onChange={e => setBedData({...bedData, capacity: e.target.value})} placeholder="e.g. 72"/>
          </div>
        </div>
        <button type="submit" className="btn btn-primary" style={{marginTop: 10}}><Box size={16} style={{marginRight: 6}}/> {editingId ? 'Update Bed' : 'Save Nursery Bed Data'}</button>
      </form>

      <CrudTable 
        data={nurseries} 
        columns={nurseryColumns} 
        onEdit={(row) => { setBedData(row); setEditingId(row.id); }} 
        onDelete={(id) => {
          dispatch(deleteBed(id));
          dispatch(queueAction({ type: 'core/deleteNode', payload: { id }, meta: { id: Date.now() } }));
        }} 
        itemLabel="Bed" 
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
                  {fields.map(f => <option key={f.id} value={f.id}>{f.name} - {f.year}</option>)}
                </select>
                <button onClick={() => handleTransplant(crop.id)} className="btn btn-primary"><MoveRight size={14} style={{marginRight: 4}}/> Move to Field</button>
              </div>
          </div>
        ))}
      </div>
    </div>
  );
}
