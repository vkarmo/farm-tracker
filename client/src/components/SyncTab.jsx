import React, { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { flushQueue, clearAllQueue } from '../store/syncSlice';
import { RefreshCw, Database, Trash2 } from 'lucide-react';
import localforage from 'localforage';

const getRecordCount = (key, value) => {
  if (!value) return 0;
  switch (key) {
    case 'settings':
      return 1;
    case 'assets':
      return (
        (value.crops?.length || 0) +
        (value.livestock?.length || 0) +
        (value.harvests?.length || 0) +
        (value.equipment?.length || 0) +
        (value.kits?.length || 0)
      );
    case 'breeding':
      return (value.pairings?.length || 0) + (value.kits?.length || 0);
    case 'planning':
      return (value.goals?.length || 0) + (value.objectives?.length || 0);
    case 'fields':
      return value.data?.length || 0;
    case 'recommendations':
      return value.data?.length || 0;
    case 'financials':
      return value.transactions?.length || 0;
    case 'nurseries':
      return value.beds?.length || 0;
    case 'activities':
      return value.log?.length || 0;
    case 'audit':
      return value.logs?.length || 0;
    case 'gps':
      return value.locations?.length || 0;
    case 'soilTests':
      return value.tests?.length || 0;
    case 'sync':
      return value.offlineActionQueue?.length || 0;
    case 'auth':
      return value.usersList?.length || 0;
    default:
      if (Array.isArray(value)) return value.length;
      if (typeof value === 'object') {
        if (Array.isArray(value.list)) return value.list.length;
        
        let sum = 0;
        let hasArray = false;
        for (const k of Object.keys(value)) {
          if (Array.isArray(value[k])) {
            sum += value[k].length;
            hasArray = true;
          }
        }
        if (hasArray) return sum;
      }
      return 0;
  }
};

const getAllRecords = (state) => {
  const records = [];

  const addItems = (arr, nodeType, nameField = 'name') => {
    if (Array.isArray(arr)) {
      arr.forEach(item => {
        records.push({
          id: item.id || item.timestamp || Math.random().toString(),
          nodeType,
          name: item[nameField] || item.title || item.crop || item.cropName || item.diseaseName || item.pestName || item.description || item.id || 'Unnamed Record',
          data: item
        });
      });
    }
  };

  // 1. fields
  addItems(state.fields?.data, 'Field');
  // 2. nurseries
  addItems(state.nurseries?.beds, 'NurseryBed');
  // 3. assets
  addItems(state.assets?.crops, 'Crop');
  addItems(state.assets?.livestock, 'Livestock');
  addItems(state.assets?.harvests, 'Harvest', 'crop');
  addItems(state.assets?.equipment, 'Equipment');
  addItems(state.assets?.kits, 'LivestockKit');
  // 4. breeding
  addItems(state.breeding?.pairings, 'BreedingEvent', 'id');
  addItems(state.breeding?.kits, 'LivestockKit', 'id');
  // 5. planning
  addItems(state.planning?.goals, 'Goal', 'title');
  addItems(state.planning?.objectives, 'Objective', 'title');
  // 6. recommendations
  addItems(state.recommendations?.data, 'Recommendation', 'id');
  // 7. financials
  addItems(state.financials?.transactions, 'Transaction', 'description');
  // 8. audit
  addItems(state.audit?.logs, 'AuditLog', 'action');
  // 9. gps
  addItems(state.gps?.locations, 'GpsLog', 'id');
  // 10. soilTests
  addItems(state.soilTests?.list, 'SoilTest', 'id');
  // 11. auth
  addItems(state.auth?.usersList, 'User', 'email');
  // 12. budgets
  addItems(state.budgets?.list, 'Budget', 'name');
  // 13. deadlines
  addItems(state.deadlines?.list, 'Deadline', 'title');
  // 14. incidents
  addItems(state.incidents?.list, 'Incident', 'title');
  // 15. assignments
  addItems(state.assignments?.list, 'TaskAssignment', 'task');
  // 16. employees
  addItems(state.employees?.list, 'Employee', 'name');
  // 17. pests
  addItems(state.pests?.list, 'Pest', 'name');
  // 18. livestockDiseases
  addItems(state.livestockDiseases?.list, 'LivestockDisease', 'diseaseName');
  // 19. poi
  addItems(state.poi?.list, 'PointOfInterest', 'name');

  // 20. settings
  if (state.settings && Object.keys(state.settings).length > 0) {
    records.push({
      id: 'settings_node',
      nodeType: 'GlobalSettings',
      name: 'Global settings configuration',
      data: state.settings
    });
  }

  return records;
};

const renderRecordSummary = (record) => {
  const { nodeType, data } = record;
  if (!data) return null;

  switch (nodeType) {
    case 'Field':
      return (
        <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
          <div><strong>Area:</strong> {data.area} acres</div>
          <div><strong>Soil Type:</strong> {data.soil_type}</div>
          <div><strong>Irrigation:</strong> {data.irrigation || 'None'}</div>
        </div>
      );
    case 'NurseryBed':
      return (
        <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
          <div><strong>Capacity:</strong> {data.capacity} plants</div>
          <div><strong>Status:</strong> {data.status}</div>
        </div>
      );
    case 'Crop':
      return (
        <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
          <div><strong>Variety:</strong> {data.variety}</div>
          <div><strong>Planting Date:</strong> {data.plantingDate}</div>
          <div><strong>Expected Harvest:</strong> {data.expectedHarvest}</div>
        </div>
      );
    case 'Livestock':
      return (
        <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
          <div><strong>Type:</strong> {data.type}</div>
          <div><strong>Breed:</strong> {data.breed}</div>
          <div><strong>Status:</strong> {data.status}</div>
        </div>
      );
    case 'Harvest':
      return (
        <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
          <div><strong>Quantity:</strong> {data.quantity} {data.unit}</div>
          <div><strong>Date:</strong> {data.harvestDate || data.date}</div>
        </div>
      );
    case 'Equipment':
      return (
        <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
          <div><strong>Status:</strong> {data.status}</div>
          <div><strong>Last Maintained:</strong> {data.lastMaintenance}</div>
        </div>
      );
    case 'Transaction':
      return (
        <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
          <div><strong>Type:</strong> {data.type}</div>
          <div><strong>Amount:</strong> ${data.amount}</div>
          <div><strong>Category:</strong> {data.category}</div>
        </div>
      );
    case 'Budget':
      return (
        <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
          <div><strong>Limit:</strong> ${data.limit}</div>
          <div><strong>Spent:</strong> ${data.spent}</div>
        </div>
      );
    case 'TaskAssignment':
      return (
        <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
          <div><strong>Status:</strong> {data.status}</div>
          <div><strong>Assigned To:</strong> {data.workerId || data.assignedTo}</div>
        </div>
      );
    case 'Employee':
      return (
        <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
          <div><strong>Role:</strong> {data.role}</div>
          <div><strong>Phone:</strong> {data.phone}</div>
        </div>
      );
    case 'AuditLog':
      return (
        <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
          <div><strong>Action:</strong> {data.action}</div>
          <div><strong>User:</strong> {data.userEmail}</div>
        </div>
      );
    case 'GpsLog':
      return (
        <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
          <div><strong>Coordinates:</strong> {data.lat?.toFixed(5)}, {data.lng?.toFixed(5)}</div>
          <div><strong>Time:</strong> {data.timestamp ? new Date(data.timestamp).toLocaleTimeString() : 'N/A'}</div>
        </div>
      );
    case 'PointOfInterest':
      return (
        <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
          <div><strong>Type:</strong> {data.type}</div>
          <div><strong>Notes:</strong> {data.notes || 'None'}</div>
        </div>
      );
    default:
      // Fallback for others
      const keys = Object.keys(data).filter(k => k !== 'id' && typeof data[k] !== 'object');
      return (
        <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
          {keys.slice(0, 3).map(k => (
            <div key={k}><strong>{k}:</strong> {String(data[k])}</div>
          ))}
        </div>
      );
  }
};

const deleteRecordFromRedux = (dispatch, record) => {
  const { nodeType, id, data } = record;
  
  switch (nodeType) {
    case 'Field':
      dispatch({ type: 'fields/deleteField', payload: id });
      break;
    case 'NurseryBed':
      dispatch({ type: 'nurseries/deleteBed', payload: id });
      break;
    case 'Crop':
      dispatch({ type: 'assets/deleteCrop', payload: id });
      break;
    case 'Livestock':
      dispatch({ type: 'assets/deleteLivestock', payload: id });
      break;
    case 'Harvest':
      dispatch({ type: 'assets/deleteHarvest', payload: id });
      break;
    case 'Equipment':
      dispatch({ type: 'assets/deleteEquipment', payload: id });
      break;
    case 'LivestockKit':
      dispatch({ type: 'breeding/deleteKit', payload: id });
      dispatch({ type: 'assets/deleteKit', payload: id });
      break;
    case 'BreedingEvent':
      dispatch({ type: 'breeding/deletePairing', payload: id });
      break;
    case 'Goal':
      dispatch({ type: 'planning/removeGoal', payload: id });
      break;
    case 'Objective':
      dispatch({ type: 'planning/removeObjective', payload: id });
      break;
    case 'Recommendation':
      dispatch({ type: 'recommendations/deleteRecommendation', payload: id });
      break;
    case 'Transaction':
      dispatch({ type: 'financials/deleteTransaction', payload: id });
      break;
    case 'AuditLog':
      dispatch({ type: 'audit/deleteLogs', payload: [id] });
      break;
    case 'GpsLog':
      dispatch({ type: 'gps/deleteLocations', payload: [id] });
      break;
    case 'SoilTest':
      dispatch({ type: 'soilTests/removeSoilTest', payload: id });
      break;
    case 'User':
      dispatch({ type: 'auth/removeUserOffline', payload: data.email || id });
      break;
    case 'Budget':
      dispatch({ type: 'budgets/deleteBudget', payload: id });
      break;
    case 'Deadline':
      dispatch({ type: 'deadlines/deleteDeadline', payload: id });
      break;
    case 'Incident':
      dispatch({ type: 'incidents/deleteIncident', payload: id });
      break;
    case 'TaskAssignment':
      dispatch({ type: 'assignments/deleteAssignment', payload: id });
      break;
    case 'Employee':
      dispatch({ type: 'employees/deleteEmployee', payload: id });
      break;
    case 'Pest':
      dispatch({ type: 'pests/removePest', payload: id });
      break;
    case 'LivestockDisease':
      dispatch({ type: 'livestockDiseases/removeDisease', payload: id });
      break;
    case 'PointOfInterest':
      dispatch({ type: 'poi/deletePoi', payload: id });
      break;
    case 'GlobalSettings':
      dispatch({ type: 'settings/setAllSettings', payload: {} });
      break;
    default:
      console.warn('No delete mapper defined for node type:', nodeType);
      break;
  }
};

export default function SyncTab() {
  const dispatch = useDispatch();
  const fullState = useSelector(state => state);
  const currentUser = fullState.auth?.currentUser;
  const syncModule = fullState.sync || {};
  const { offlineActionQueue = [], isSyncing = false, lastSynced, backendAvailable = true, backendFailures = 0 } = syncModule;

  const [dbConfig, setDbConfig] = React.useState(null);
  const [selectedTypeFilter, setSelectedTypeFilter] = React.useState('all');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [expandedRecordIds, setExpandedRecordIds] = React.useState({});
  const [isClearingQueue, setIsClearingQueue] = React.useState(false);

  useEffect(() => {
    if (currentUser?.role === 'admin') {
      fetch('/api/admin/db-config')
        .then(res => res.json())
        .then(data => setDbConfig(data))
        .catch(err => console.error("Failed to fetch DB config", err));
    }
  }, [currentUser]);

  const handleForceSync = () => {
    dispatch(flushQueue(true));
  };

  const allRecords = React.useMemo(() => getAllRecords(fullState), [fullState]);

  const nodeTypes = React.useMemo(() => {
    const types = new Set();
    allRecords.forEach(r => {
      if (r.nodeType) types.add(r.nodeType);
    });
    return Array.from(types).sort();
  }, [allRecords]);

  const filteredRecords = React.useMemo(() => {
    return allRecords.filter(r => {
      const matchesFilter = selectedTypeFilter === 'all' || r.nodeType === selectedTypeFilter;
      const matchesSearch = searchQuery === '' || 
        r.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        r.nodeType.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesFilter && matchesSearch;
    });
  }, [allRecords, selectedTypeFilter, searchQuery]);

  const groupedRecords = React.useMemo(() => {
    const groups = {};
    filteredRecords.forEach(r => {
      if (!groups[r.nodeType]) {
        groups[r.nodeType] = [];
      }
      groups[r.nodeType].push(r);
    });
    return groups;
  }, [filteredRecords]);

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '15px' }}>
        <div>
          <h2>System Data Engine & Synchronization</h2>
          <p style={{ fontSize: '0.9rem', color: 'var(--color-text-light)', marginBottom: '15px' }}>
            Monitor local Redux storage memory usage, offline action queues, and directly communicate with the external backend APIs.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={handleForceSync}
            disabled={isSyncing || offlineActionQueue.length === 0}
            className="btn btn-primary"
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              background: isSyncing ? '#aaa' : 'var(--color-primary)'
            }}
          >
            {isSyncing ? (
              <RefreshCw size={16} className="spin" />
            ) : (
              <Database size={16} />
            )}
            {isSyncing ? `Pushing Data (${offlineActionQueue.length} actions left)...` : `Force Sync Context Queue (${offlineActionQueue.length} actions)`}
          </button>
          
          <button
            onClick={() => {
              if (confirm('Are you sure you want to purge all local storage and local Redux cache? This will wipe all local data and reload the application.')) {
                setIsClearingQueue(true);
                localStorage.clear();
                localforage.clear()
                  .then(() => {
                    setTimeout(() => {
                      window.location.reload();
                    }, 1200);
                  })
                  .catch(err => {
                    console.error('Failed to purge localForage database:', err);
                    setTimeout(() => {
                      window.location.reload();
                    }, 1200);
                  });
              }
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: '#fee2e2',
              color: '#991b1b',
              border: '1px solid #fca5a5',
              borderRadius: '4px',
              padding: '6px 12px',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              outline: 'none'
            }}
          >
            <Trash2 size={16} />
            Purge Local Storage
          </button>
        </div>
      </div>

      {isSyncing && (
        <div style={{ padding: '15px', background: '#fff3e0', borderLeft: '4px solid #ef6c00', borderRadius: '4px', color: '#e65100', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <RefreshCw size={24} className="spin" />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <strong style={{ fontSize: '1rem' }}>Uploading Local Storage Database to Cloud...</strong>
            <span style={{ fontSize: '0.85rem' }}>The application is actively transmitting your locally cached Redux telemetry directly to the specified backend routing node. Please avoid closing the window until fully synchronized.</span>
          </div>
        </div>
      )}

      {(!backendAvailable || backendFailures > 0) && !isSyncing && (
        <div style={{ padding: '10px 15px', background: '#ffebee', borderRadius: '4px', color: '#c62828', marginBottom: '20px', fontSize: '0.9rem' }}>
          <strong>Network Warning:</strong> Experienced {backendFailures} synchronization failures. The backend server might be unreachable or currently sleeping.
        </div>
      )}

      <div style={{ marginBottom: '25px', display: 'flex', flexWrap: 'wrap', gap: '15px' }}>
        <div className="status-indicator" style={{ background: '#f5f5f5', color: '#333' }}>
          <strong>Last Synced At:</strong> {lastSynced ? new Date(lastSynced).toLocaleString() : 'Never Synced In Current Session'}
        </div>
        <div className={`status-indicator ${backendAvailable ? 'status-online' : 'status-offline'}`}>
          <strong>Neo4j Connect Node:</strong> {backendAvailable ? 'Reachable' : 'Unreachable'}
        </div>
      </div>

      {currentUser?.role === 'admin' && dbConfig && (
        <details style={{ marginBottom: '20px', background: '#f5f7fa', border: '1px solid var(--color-border)', padding: '15px', borderRadius: '8px' }}>
          <summary style={{ cursor: 'pointer', fontWeight: 600, color: 'var(--color-primary-dark)', fontSize: '1.05rem', outline: 'none' }}>
            <Database size={16} style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: '6px' }} />
            Admin: Redux-to-Neo4j Connection Bridge Config
          </summary>
          <div style={{ marginTop: '15px', fontFamily: 'monospace', fontSize: '0.9rem', background: '#1e1e1e', color: '#a6e22e', padding: '15px', borderRadius: '4px', overflowX: 'auto' }}>
            <div style={{ marginBottom: '8px' }}><strong style={{ color: '#66d9ef' }}>NEO4J_URI:</strong> {dbConfig.NEO4J_URI}</div>
            <div style={{ marginBottom: '8px' }}><strong style={{ color: '#66d9ef' }}>NEO4J_USER:</strong> {dbConfig.NEO4J_USER}</div>
            <div><strong style={{ color: '#66d9ef' }}>NEO4J_PASSWORD:</strong> {dbConfig.NEO4J_PASSWORD}</div>
          </div>
        </details>
      )}

      <hr style={{ border: 'none', borderTop: '1px solid var(--color-border)', margin: '20px 0' }} />

      <h3>Local Redux Node Diagnostics Grid</h3>
      <p style={{ fontSize: '0.85rem', color: 'var(--color-text-light)', marginBottom: '20px' }}>
        Search, filter, and inspect all active records saved inside the local browser telemetry cache.
      </p>

      {/* Filter and Search Bar */}
      <div style={{
        display: 'flex',
        gap: '15px',
        marginBottom: '20px',
        flexWrap: 'wrap',
        alignItems: 'flex-end',
        background: '#f8fafc',
        padding: '12px 16px',
        borderRadius: '8px',
        border: '1px solid #cbd5e1'
      }}>
        <div style={{ flex: '1 1 200px' }}>
          <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
            Filter by Node Type
          </label>
          <select
            value={selectedTypeFilter}
            onChange={(e) => setSelectedTypeFilter(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              backgroundColor: 'white',
              fontSize: '0.85rem',
              color: '#334155',
              outline: 'none'
            }}
          >
            <option value="all">All Types ({allRecords.length} records)</option>
            {nodeTypes.map(t => {
              const count = allRecords.filter(r => r.nodeType === t).length;
              return (
                <option key={t} value={t}>
                  {t} ({count})
                </option>
              );
            })}
          </select>
        </div>

        <div style={{ flex: '2 1 250px' }}>
          <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
            Search Records
          </label>
          <input
            type="text"
            placeholder="Search by name, ID, or type..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              fontSize: '0.85rem',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
        </div>

        <div style={{ flex: '0 0 auto' }}>
          <button
            onClick={() => {
              const targetType = selectedTypeFilter;
              const count = filteredRecords.length;
              const confirmMsg = targetType === 'all'
                ? `Are you sure you want to purge ALL ${count} local records in the current view?`
                : `Are you sure you want to purge all ${count} records of type "${targetType}"?`;
              if (confirm(confirmMsg)) {
                filteredRecords.forEach(record => {
                  deleteRecordFromRedux(dispatch, record);
                });
              }
            }}
            disabled={filteredRecords.length === 0}
            style={{
              padding: '9px 16px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: filteredRecords.length === 0 ? '#cbd5e1' : '#dc2626',
              color: 'white',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: filteredRecords.length === 0 ? 'not-allowed' : 'pointer',
              outline: 'none',
              boxShadow: filteredRecords.length === 0 ? 'none' : '0 1px 2px rgba(0,0,0,0.05)'
            }}
          >
            Purge Filtered Group ({filteredRecords.length})
          </button>
        </div>
      </div>

      {filteredRecords.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '30px', color: '#64748b', background: 'white', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
          No records found matching your filters.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
          {Object.entries(groupedRecords).map(([nodeType, recordsOfType]) => {
            // Find columns dynamically
            const allKeys = new Set();
            recordsOfType.forEach(r => {
              Object.keys(r.data || {}).forEach(k => {
                const lowerK = k.toLowerCase();
                if (lowerK !== 'polygon' && !lowerK.endsWith('id') && !lowerK.endsWith('ids')) {
                  allKeys.add(k);
                }
              });
            });
            
            // Ensure ID and Name are first
            const columns = Array.from(allKeys).sort((a, b) => {
              const priority = { name: 1, variety: 2, type: 3, status: 4 };
              const pA = priority[a.toLowerCase()] || 99;
              const pB = priority[b.toLowerCase()] || 99;
              if (pA !== pB) return pA - pB;
              return a.localeCompare(b);
            });

            const badgeColorMap = {
              'Field': { bg: '#e8f5e9', text: '#2e7d32' },
              'NurseryBed': { bg: '#efebe9', text: '#5d4037' },
              'Crop': { bg: '#e8f5e9', text: '#1b5e20' },
              'Livestock': { bg: '#f1f8e9', text: '#558b2f' },
              'Harvest': { bg: '#fff3e0', text: '#e65100' },
              'Equipment': { bg: '#eceff1', text: '#455a64' },
              'Transaction': { bg: '#e3f2fd', text: '#1565c0' },
              'Budget': { bg: '#ede7f6', text: '#5e35b1' },
              'TaskAssignment': { bg: '#fffde7', text: '#f57f17' },
              'Employee': { bg: '#f3e5f5', text: '#7b1fa2' },
              'User': { bg: '#e0f2f1', text: '#00796b' },
              'Goal': { bg: '#e8eaf6', text: '#1a237e' },
              'Objective': { bg: '#e0f7fa', text: '#006064' },
              'AuditLog': { bg: '#fafafa', text: '#616161' },
              'GpsLog': { bg: '#ffebee', text: '#c62828' },
              'Pest': { bg: '#fbe9e7', text: '#d84315' },
              'SoilTest': { bg: '#e0f2f1', text: '#004d40' },
              'LivestockDisease': { bg: '#ffebee', text: '#b71c1c' },
              'PointOfInterest': { bg: '#fff8e1', text: '#ff8f00' },
              'GlobalSettings': { bg: '#eceff1', text: '#37474f' },
              'Recommendation': { bg: '#ede7f6', text: '#4a148c' }
            };
            
            const badgeColors = badgeColorMap[nodeType] || { bg: '#f1f5f9', text: '#475569' };

            return (
              <div key={nodeType} style={{ background: '#f8fafc', padding: '15px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#1e293b' }}>{nodeType} Records</h3>
                  <span style={{
                    background: badgeColors.bg,
                    color: badgeColors.text,
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontSize: '0.72rem',
                    fontWeight: 'bold'
                  }}>
                    {recordsOfType.length}
                  </span>
                </div>
                
                <div style={{
                  width: '100%',
                  overflowX: 'auto',
                  background: 'white',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                }}>
                  <table style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: '0.82rem',
                    textAlign: 'left'
                  }}>
                    <thead>
                      <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
                        <th style={{ padding: '10px 14px', fontWeight: 600, color: '#475569', width: '50px' }}></th>
                        {columns.map(col => (
                          <th key={col} style={{ padding: '10px 14px', fontWeight: 600, color: '#475569', textTransform: 'capitalize', whiteSpace: 'nowrap' }}>
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {recordsOfType.map(record => (
                        <tr key={record.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                          <td style={{ padding: '10px 14px', verticalAlign: 'middle', width: '50px', textAlign: 'center' }}>
                            <button
                              onClick={() => {
                                if (confirm(`Are you sure you want to purge this individual ${record.nodeType} record from local cache?`)) {
                                  deleteRecordFromRedux(dispatch, record);
                                }
                              }}
                              title={`Purge ${record.nodeType}`}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: '#dc2626',
                                cursor: 'pointer',
                                padding: '4px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: '4px',
                                outline: 'none',
                                transition: 'background-color 0.15s ease'
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#fee2e2'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                          {columns.map(col => {
                            const val = (record.data || {})[col];
                            let displayVal = '';
                            if (val === null || val === undefined) {
                              displayVal = '-';
                            } else if (typeof val === 'object') {
                              displayVal = JSON.stringify(val);
                            } else {
                              displayVal = String(val);
                            }
                            return (
                              <td key={col} style={{
                                padding: '10px 14px',
                                color: '#334155',
                                fontFamily: 'monospace',
                                fontSize: '0.75rem',
                                whiteSpace: 'normal',
                                wordBreak: 'keep-all',
                                overflowWrap: 'normal'
                              }}>
                                {displayVal}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {isClearingQueue && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: '#111111', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#ffffff' }}>
          <RefreshCw size={54} className="spin" style={{ marginBottom: '24px', color: '#ffffff' }} />
          <h2 style={{ color: '#ffffff', marginBottom: '8px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', textTransform: 'none', fontWeight: 'bold' }}>Purging Local Storage...</h2>
          <p style={{ color: '#9ca3af', maxWidth: '280px', textAlign: 'center', wordWrap: 'break-word', whiteSpace: 'normal', lineHeight: '1.4', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>Please wait while we purge the local cache.</p>
        </div>
      )}
    </div>
  );
}
