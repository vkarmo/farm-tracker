import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { queueAction } from '../store/syncSlice';
import { addCrop, deleteCrop } from '../store/assetsSlice';
import { Leaf, X, Search, Bug, HeartHandshake } from 'lucide-react';
import Select from 'react-select';
import CrudTable from './CrudTable';


const INIT_CROP = { sowType: 'Direct', fieldId: '', name: '', variety: '', plantingDate: '', expectedHarvest: '', seedingRate: '', targetYield: '', phHi: '', phLo: '', pestIds: [] };

export default function CropTab() {
  const dispatch = useDispatch();
  const fields = useSelector(state => state.fields.data) || [];
  const nurseries = useSelector(state => state.nurseries?.beds) || [];
  const crops = useSelector(state => state.assets.crops) || [];
  const pestsList = useSelector(state => state.pests?.list) || [];

  const [cropData, setCropData] = useState(INIT_CROP);
  const [editingId, setEditingId] = useState(null);
  const [activeTab, setActiveTab] = useState('roster');

  const [matrixData, setMatrixData] = useState([]);
  const [loadingMatrix, setLoadingMatrix] = useState(false);
  const [matrixError, setMatrixError] = useState(null);
  const [matrixSearch, setMatrixSearch] = useState('');
  const [selectedCropName, setSelectedCropName] = useState(null);

  useEffect(() => {
    if (activeTab === 'matrix') {
      setLoadingMatrix(true);
      setMatrixError(null);
      fetch('/api/crops/relationships')
        .then(res => {
          if (!res.ok) throw new Error('Failed to fetch treatment matrix');
          return res.json();
        })
        .then(data => {
          setMatrixData(data);
          setLoadingMatrix(false);
        })
        .catch(err => {
          console.error(err);
          setMatrixError(err.message);
          setLoadingMatrix(false);
        });
    }
  }, [activeTab]);

  const filteredMatrix = (matrixData || []).filter(item => {
    if (!item) return false;
    const q = (matrixSearch || '').toLowerCase();
    const cropName = (item.cropName || '').toLowerCase();
    const pestName = (item.pestName || '').toLowerCase();
    const remedies = Array.isArray(item.remedies) ? item.remedies : [];
    
    return (
      cropName.includes(q) ||
      pestName.includes(q) ||
      remedies.some(r => r && r.toLowerCase().includes(q))
    );
  });

  const resetForm = () => {
    setCropData(INIT_CROP);
    setEditingId(null);
    setActiveTab('roster');
  };

  const handleEdit = (row) => {
    setCropData(row);
    setEditingId(row.id);
    setActiveTab('entry');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!cropData.name || !cropData.name.trim()) return alert("Validation Error: Crop Name is required to initialize a batch.");
    if (!cropData.sowType || !cropData.sowType.trim()) return alert("Validation Error: Sowing Strategy is required.");

    if (editingId) {
      const updatedCrop = { ...cropData, id: editingId };
      dispatch(addCrop(updatedCrop)); // addCrop does array replacement
      dispatch(queueAction({ type: 'core/updateNode', payload: { id: editingId, properties: updatedCrop }, meta: { id: Date.now() } }));
    } else {
      const newCrop = { id: `c_${Date.now()}`, ...cropData };
      dispatch(addCrop(newCrop));
      dispatch(queueAction({ type: 'assets/addCrop', payload: newCrop, meta: { id: Date.now() } }));
    }

    resetForm();
  };

  const columns = [
    { key: 'name', header: 'Crop Name' },
    { key: 'variety', header: 'Variety' },
    { key: 'sowType', header: 'Status' },
    {
      key: 'fieldId',
      header: 'Location',
      render: (row) => {
        let name = "Unknown";
        if (row.sowType === 'Nursery') {
          name = nurseries.find(n => n.id === row.fieldId)?.name || row.fieldId;
        } else {
          name = fields.find(f => f.id === row.fieldId)?.name || row.fieldId;
        }
        return name;
      }
    },
    { key: 'expectedHarvest', header: 'Est. Harvest' }
  ];

  const pestOptions = pestsList.map(p => ({
    value: p.id,
    label: `${p.name} (${p.type})`
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="sub-tabs-container">
          <button 
            type="button"
            onClick={() => setActiveTab('roster')} 
            className="sub-tab-btn"
            style={{ 
              background: activeTab === 'roster' ? 'white' : 'transparent', 
              borderBottom: activeTab === 'roster' ? '3px solid var(--color-primary)' : 'none',
              color: activeTab === 'roster' ? 'var(--color-primary)' : 'var(--color-text-light)',
            }}
          >
            Sown Crops
          </button>
          <button 
            type="button"
            onClick={() => setActiveTab('matrix')} 
            className="sub-tab-btn"
            style={{ 
              background: activeTab === 'matrix' ? 'white' : 'transparent', 
              borderBottom: activeTab === 'matrix' ? '3px solid var(--color-primary)' : 'none',
              color: activeTab === 'matrix' ? 'var(--color-primary)' : 'var(--color-text-light)',
            }}
          >
            Treatment Matrix
          </button>
          <button 
            type="button"
            onClick={() => setActiveTab('entry')} 
            className="sub-tab-btn"
            style={{ 
              background: activeTab === 'entry' ? 'white' : 'transparent', 
              borderBottom: activeTab === 'entry' ? '3px solid var(--color-primary)' : 'none',
              color: activeTab === 'entry' ? 'var(--color-primary)' : 'var(--color-text-light)',
            }}
          >
            {editingId ? 'Edit Crop Details' : 'Sow New Crop Batch'}
          </button>
        </div>

        <div style={{ padding: '20px' }}>
          {activeTab === 'roster' && (
            <CrudTable activeRowId={editingId}
              data={crops}
              columns={columns}
              onEdit={handleEdit}
              onDelete={(id) => {
                dispatch(deleteCrop(id));
                dispatch(queueAction({ type: 'core/deleteNode', payload: { id }, meta: { id: Date.now() } }));
                if (editingId === id) resetForm();
              }}
              itemLabel="Crop"
              defaultSort={{ key: 'updatedAt', direction: 'desc' }}
            />
          )}

          {activeTab === 'matrix' && (() => {
            // Group matrixData by cropName
            const groupedCrops = {};
            (matrixData || []).forEach(item => {
              if (!item.cropName) return;
              if (!groupedCrops[item.cropName]) {
                groupedCrops[item.cropName] = [];
              }
              groupedCrops[item.cropName].push(item);
            });

            const uniqueCropNames = Object.keys(groupedCrops).filter(cName => {
              const q = (matrixSearch || '').toLowerCase();
              if (cName.toLowerCase().includes(q)) return true;
              const records = groupedCrops[cName];
              return records.some(rec => 
                (rec.pestName || '').toLowerCase().includes(q) ||
                (rec.remedies || []).some(r => r && r.toLowerCase().includes(q))
              );
            });

            const activeCrop = selectedCropName && groupedCrops[selectedCropName] ? selectedCropName : (uniqueCropNames[0] || null);
            const activeRecords = activeCrop ? groupedCrops[activeCrop] : [];

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* Search Bar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'white', padding: '10px 14px', borderRadius: '6px', border: '1px solid var(--color-border, #ccc)' }}>
                  <Search size={16} color="#666" />
                  <input
                    type="text"
                    placeholder="Search by crop, pest, or remedy..."
                    value={matrixSearch}
                    onChange={(e) => setMatrixSearch(e.target.value)}
                    style={{ border: 'none', width: '100%', outline: 'none', fontSize: '0.9rem' }}
                  />
                  {matrixSearch && (
                    <button type="button" onClick={() => setMatrixSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888' }}>
                      <X size={16} />
                    </button>
                  )}
                </div>

                {loadingMatrix ? (
                  <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>
                    Loading treatment relationships...
                  </div>
                ) : matrixError ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: '#c62828', background: '#ffebee', borderRadius: '6px' }}>
                    Error loading treatment matrix: {matrixError}
                  </div>
                ) : uniqueCropNames.length === 0 ? (
                  <div style={{ padding: '40px', textAlign: 'center', color: '#666', background: '#f8fafc', borderRadius: '6px', border: '1px dashed #cbd5e1' }}>
                    No crops found matching your search.
                  </div>
                ) : (
                  <div className="matrix-split-pane">
                    {/* Left Column: Crop List */}
                    <div className="matrix-left-pane">
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', padding: '8px 10px', borderBottom: '1px solid #e2e8f0', marginBottom: '6px' }}>
                        Crops Directory
                      </div>
                      {uniqueCropNames.map((cName) => {
                        const isActive = activeCrop === cName;
                        return (
                          <button
                            key={cName}
                            type="button"
                            onClick={() => setSelectedCropName(cName)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px',
                              width: '100%',
                              padding: '10px 14px',
                              border: 'none',
                              borderRadius: '6px',
                              background: isActive ? 'var(--color-primary, #2e7d32)' : 'transparent',
                              color: isActive ? '#ffffff' : '#334155',
                              fontWeight: isActive ? 700 : 500,
                              textAlign: 'left',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            <Leaf size={16} color={isActive ? '#ffffff' : '#64748b'} />
                            <span style={{ fontSize: '0.9rem' }}>{cName}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Right Column: Pest & Remedy details */}
                    <div className="matrix-right-pane">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '2px solid #e2e8f0', paddingBottom: '10px', marginBottom: '4px' }}>
                        <Leaf size={22} color="#2e7d32" />
                        <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>{activeCrop}</h3>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {activeRecords.map((rec, rIdx) => (
                          <div key={rIdx} style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <Bug size={16} color="#c62828" />
                              <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1e293b' }}>
                                Susceptible Pest: <span style={{ color: '#c62828' }}>{rec.pestName}</span>
                              </span>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <HeartHandshake size={12} /> Target Treatments / Remedies
                              </span>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                {rec.remedies && rec.remedies.length > 0 ? (
                                  rec.remedies.map((rem, i) => (
                                    <span key={i} style={{ background: '#fff3e0', color: '#e65100', padding: '4px 10px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 600 }}>{rem}</span>
                                  ))
                                ) : (
                                  <span style={{ fontSize: '0.72rem', fontStyle: 'italic', color: '#94a3b8' }}>No remedies linked</span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {activeTab === 'entry' && (
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', justifyContent: 'flex-end' }}>
                {editingId && (
                  <button type="button" className="btn" onClick={resetForm}>
                    Cancel
                  </button>
                )}
                <button type="submit" className="btn btn-primary">
                  <Leaf size={16} style={{ marginRight: 6 }} /> {editingId ? 'Update Crop' : 'Save Crop Data'}
                </button>
              </div>
              <div className="form-group" style={{ background: '#f1f8e9', padding: '10px', borderRadius: '4px', border: '1px solid #c5e1a5', marginBottom: 15 }}>
                <label style={{ marginBottom: 8, display: 'block', fontWeight: 'bold' }}>Sowing Strategy</label>
                <div style={{ display: 'flex', flexDirection: 'row', gap: '10px', alignItems: 'left', width: 'auto' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 9, fontWeight: 'bold', fontSize: '20px', width: 'auto', height: '35px' }}>
                    <input style={{ width: 'auto' }} type="radio" value="Direct" checked={cropData.sowType === 'Direct'} onChange={() => setCropData({ ...cropData, sowType: 'Direct', fieldId: '' })} />
                    <label style={{ marginBottom: '0px', width: 'auto', display: 'flex', alignItems: 'center' }}>Direct Field Sow</label>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 9, fontWeight: 'bold', fontSize: '20px', width: 'auto', height: '35px' }}>
                    <input style={{ width: 'auto' }} type="radio" value="Nursery" checked={cropData.sowType === 'Nursery'} onChange={() => setCropData({ ...cropData, sowType: 'Nursery', fieldId: '' })} />
                    <label style={{ marginBottom: '0px', width: 'auto', display: 'flex', alignItems: 'center' }}>Nursery Start</label>
                  </label>
                </div>
              </div>

              <div className="form-grid">
                <div className="form-group form-grid-full">
                  <label>{cropData.sowType === 'Direct' ? 'Target Destination Field (Optional)' : 'Target Nursery Bed / Tray (Optional)'}</label>
                  <select value={cropData.fieldId} onChange={e => setCropData({ ...cropData, fieldId: e.target.value })}>
                    <option value="">{cropData.sowType === 'Direct' ? 'Select a physical field...' : 'Select a configured nursery bed...'}</option>
                    {cropData.sowType === 'Direct'
                      ? [...fields].sort((a, b) => {
                          const aOverall = a.isOverallMap === true || a.isOverallMap === 'true';
                          const bOverall = b.isOverallMap === true || b.isOverallMap === 'true';
                          if (aOverall && !bOverall) return -1;
                          if (!aOverall && bOverall) return 1;
                          return (a.name || '').localeCompare(b.name || '');
                        }).map(f => <option key={f.id} value={f.id}>{f.name} ({f.year})</option>)
                      : [...nurseries].sort((a, b) => (a.name || '').localeCompare(b.name || '')).map(n => <option key={n.id} value={n.id}>{n.name} (Cap: {n.capacity})</option>)
                    }
                  </select>
                </div>
                <div className="form-group">
                  <label>Crop / Seed Name</label>
                  <input type="text" value={cropData.name} onChange={e => setCropData({ ...cropData, name: e.target.value })} placeholder="Tomato" />
                </div>
                <div className="form-group">
                  <label>Seed Variety / Cultivar</label>
                  <input type="text" value={cropData.variety} onChange={e => setCropData({ ...cropData, variety: e.target.value })} placeholder="Roma VF" />
                </div>
                <div className="form-group">
                  <label>{cropData.sowType === 'Direct' ? 'Planting Date' : 'Sowing Date'}</label>
                  <input type="date" value={cropData.plantingDate} onChange={e => setCropData({ ...cropData, plantingDate: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Expected Harvest Target</label>
                  <input type="date" value={cropData.expectedHarvest} onChange={e => setCropData({ ...cropData, expectedHarvest: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Seeding Rate {cropData.sowType === 'Nursery' && '(Plugs)'}</label>
                  <input type="number" step="0.1" value={cropData.seedingRate} onChange={e => setCropData({ ...cropData, seedingRate: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Target Yield Output</label>
                  <input type="text" value={cropData.targetYield} onChange={e => setCropData({ ...cropData, targetYield: e.target.value })} placeholder="e.g. 200 bu" />
                </div>
                <div className="form-group">
                  <label>Optimum pH Low (PhLo)</label>
                  <input type="number" step="0.1" value={cropData.phLo} onChange={e => setCropData({ ...cropData, phLo: e.target.value })} placeholder="e.g. 5.5" />
                </div>
                <div className="form-group">
                  <label>Optimum pH High (PhHi)</label>
                  <input type="number" step="0.1" value={cropData.phHi} onChange={e => setCropData({ ...cropData, phHi: e.target.value })} placeholder="e.g. 6.8" />
                </div>
                <div className="form-group form-grid-full">
                  <label>Susceptible Pests & Diseases</label>
                  <Select
                    isMulti
                    options={pestOptions}
                    value={pestOptions.filter(opt => (cropData.pestIds || []).includes(opt.value))}
                    onChange={(opts) => setCropData({ ...cropData, pestIds: opts ? opts.map(o => o.value) : [] })}
                    placeholder="Search and attach pests..."
                  />
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
