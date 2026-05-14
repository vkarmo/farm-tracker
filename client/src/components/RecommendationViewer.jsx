import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { ExternalLink, Plus, Link as LinkIcon, Unlink, ArrowLeft } from 'lucide-react';
import { addRecommendation } from '../store/recommendationsSlice';
import { updateField } from '../store/fieldsSlice';
import { queueAction } from '../store/syncSlice';

export default function RecommendationViewer({ fieldId, onToggleBack }) {
  const dispatch = useDispatch();
  const allRecommendations = useSelector(state => state.recommendations?.data) || [];
  const fields = useSelector(state => state.fields.data) || [];
  
  const currentField = fields.find(f => f.id === fieldId) || { recommendationIds: [] };
  const linkedIds = currentField.recommendationIds || [];
  
  const linkedRecommendations = allRecommendations.filter(r => linkedIds.includes(r.id));
  const unlinkedRecommendations = allRecommendations.filter(r => !linkedIds.includes(r.id) && r.active !== false);

  const [selectedViewerRecId, setSelectedViewerRecId] = useState(linkedRecommendations.length > 0 ? linkedRecommendations[0].id : '');
  
  const [showNewForm, setShowNewForm] = useState(false);
  const [newRec, setNewRec] = useState({ name: '', link: '', active: true });
  const [existingRecToAdd, setExistingRecToAdd] = useState('');

  const handleCreateNew = (e) => {
    e.preventDefault();
    if (!newRec.name || !newRec.link) return alert("Name and link are required.");
    
    const newId = `rec_${Date.now()}`;
    const recObj = { ...newRec, id: newId, createdAt: Date.now() };
    
    dispatch(addRecommendation(recObj));
    dispatch(queueAction({ type: 'core/updateNode', payload: recObj, meta: { id: Date.now() } }));

    // Link to field
    handleLinkToField(newId);
    
    setNewRec({ name: '', link: '', active: true });
    setShowNewForm(false);
  };

  const handleLinkToField = (recId) => {
    if (!recId) return;
    const updatedIds = [...linkedIds, recId];
    updateFieldLinks(updatedIds);
    setExistingRecToAdd('');
    setSelectedViewerRecId(recId);
    
    // Send relationship action
    dispatch(queueAction({ 
      type: 'core/createRelationship', 
      payload: { sourceId: fieldId, targetId: recId, relationshipType: 'HAS_RECOMMENDATION' }, 
      meta: { id: Date.now() } 
    }));
  };

  const handleUnlink = (recId) => {
    const updatedIds = linkedIds.filter(id => id !== recId);
    updateFieldLinks(updatedIds);
    if (selectedViewerRecId === recId) {
      setSelectedViewerRecId('');
    }
    
    // Send relationship action
    dispatch(queueAction({ 
      type: 'core/deleteRelationship', 
      payload: { sourceId: fieldId, targetId: recId, relationshipType: 'HAS_RECOMMENDATION' }, 
      meta: { id: Date.now() } 
    }));
  };

  const updateFieldLinks = (newIds) => {
    const updatedField = { ...currentField, recommendationIds: newIds };
    dispatch(updateField(updatedField));
    dispatch(queueAction({ type: 'core/updateNode', payload: { id: fieldId, properties: updatedField }, meta: { id: Date.now() } }));
  };

  const activeRec = linkedRecommendations.find(r => r.id === selectedViewerRecId);

  return (
    <div className="card recommendation-viewer">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>Recommendations for {currentField.name}</h2>
        <button type="button" onClick={onToggleBack} className="btn" style={{ background: '#f5f5f5', color: '#333' }}>
          <ArrowLeft size={14} style={{ marginRight: 4 }} /> Back to Data Entry
        </button>
      </div>

      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
        {/* Left column: Manage Links */}
        <div style={{ flex: '1 1 300px', background: '#f9f9f9', padding: '15px', borderRadius: '8px', border: '1px solid #e0e0e0' }}>
          <h3>Linked Recommendations</h3>
          
          {linkedRecommendations.length === 0 ? (
            <p style={{ color: '#666', fontSize: '0.9rem' }}>No recommendations linked to this field yet.</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 20px 0' }}>
              {linkedRecommendations.map(r => (
                <li key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px', background: selectedViewerRecId === r.id ? '#e3f2fd' : '#fff', border: '1px solid #ccc', borderRadius: '4px', marginBottom: '8px', cursor: 'pointer' }} onClick={() => setSelectedViewerRecId(r.id)}>
                  <span>{r.name} {r.active === false && '(Inactive)'}</span>
                  <button type="button" onClick={(e) => { e.stopPropagation(); handleUnlink(r.id); }} className="btn btn-icon" style={{ padding: '4px', color: '#dc3545', background: 'transparent' }} title="Unlink">
                    <Unlink size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <hr style={{ margin: '15px 0' }} />

          <h4>Link Existing</h4>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '15px' }}>
            <select value={existingRecToAdd} onChange={(e) => setExistingRecToAdd(e.target.value)} style={{ flex: 1, padding: '8px' }}>
              <option value="">Select recommendation...</option>
              {unlinkedRecommendations.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
            <button type="button" onClick={() => handleLinkToField(existingRecToAdd)} disabled={!existingRecToAdd} className="btn btn-secondary">
              <LinkIcon size={14} />
            </button>
          </div>

          <div style={{ textAlign: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: '#666', display: 'block', marginBottom: '10px' }}>or</span>
            <button type="button" onClick={() => setShowNewForm(!showNewForm)} className="btn btn-primary" style={{ width: '100%' }}>
              <Plus size={14} style={{ marginRight: 4 }} /> {showNewForm ? 'Cancel New Recommendation' : 'Create New Recommendation'}
            </button>
          </div>

          {showNewForm && (
            <form onSubmit={handleCreateNew} style={{ marginTop: '15px', background: '#fff', padding: '15px', borderRadius: '6px', border: '1px solid #ccc' }}>
              <div className="form-group">
                <label>Name</label>
                <input type="text" value={newRec.name} onChange={e => setNewRec({...newRec, name: e.target.value})} required placeholder="Recommendation Name" />
              </div>
              <div className="form-group">
                <label>Link (URL)</label>
                <input type="url" value={newRec.link} onChange={e => setNewRec({...newRec, link: e.target.value})} required placeholder="https://" />
              </div>
              <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '8px', display: 'flex' }}>
                <input type="checkbox" checked={newRec.active} onChange={e => setNewRec({...newRec, active: e.target.checked})} id="recActive" style={{ width: 'auto', margin: 0 }} />
                <label htmlFor="recActive" style={{ margin: 0 }}>Active Recommendation</label>
              </div>
              <button type="submit" className="btn btn-primary" style={{ marginTop: '10px', width: '100%' }}>Save & Link</button>
            </form>
          )}
        </div>

        {/* Right column: Viewer */}
        <div style={{ flex: '2 1 400px', display: 'flex', flexDirection: 'column' }}>
          {activeRec ? (
            <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '30px', textAlign: 'center', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
              <ExternalLink size={48} color="#2e7d32" style={{ marginBottom: '20px' }} />
              <h3 style={{ marginBottom: '10px' }}>{activeRec.name}</h3>
              <p style={{ color: '#666', marginBottom: '30px', wordBreak: 'break-all', maxWidth: '100%' }}>
                {activeRec.link}
              </p>
              <a href={activeRec.link} target="_blank" rel="noopener noreferrer" className="btn btn-primary" style={{ padding: '12px 24px', fontSize: '1.1rem', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
                Open Recommendation in New Window <ExternalLink size={18} />
              </a>
              <p style={{ marginTop: '20px', fontSize: '0.85rem', color: '#888' }}>
                (This link will open safely in a new tab)
              </p>
            </div>
          ) : (
            <div style={{ background: '#f5f5f5', border: '1px dashed #ccc', borderRadius: '8px', padding: '30px', textAlign: 'center', flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <p style={{ color: '#888' }}>Select a recommendation to view details.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
