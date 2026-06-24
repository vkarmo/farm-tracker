import React, { useState, useMemo } from 'react';
import { Search, Edit2, Trash2, ArrowUp, ArrowDown } from 'lucide-react';

export default function CrudTable({ 
  data, 
  columns, 
  onEdit, 
  onDelete, 
  itemLabel = 'Item', 
  customTitle, 
  rowStyle, 
  defaultSort, 
  maxHeight, 
  activeRowId, 
  hideTitle, 
  mobileRender,
  selectedIds = [],
  onSelectionChange
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState(defaultSort || { key: 'updatedAt', direction: 'desc' });
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedData = useMemo(() => {
    let sortableItems = [...data];
    if (sortConfig.key !== null) {
      sortableItems.sort((a, b) => {
        let valA = a[sortConfig.key];
        let valB = b[sortConfig.key];
        
        if (sortConfig.key === 'updatedAt') {
          const getTimestamp = (row, val) => {
            if (val) return val;
            if (row && typeof row.id === 'string' && row.id.includes('_')) {
              const parts = row.id.split('_');
              if (parts.length > 1 && !isNaN(Number(parts[1]))) return Number(parts[1]);
            }
            return 0;
          };
          valA = getTimestamp(a, valA);
          valB = getTimestamp(b, valB);
        }

        if (valA === undefined || valA === null) valA = '';
        if (valB === undefined || valB === null) valB = '';
        
        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();
        
        const numA = Number(valA);
        const numB = Number(valB);
        if (!isNaN(numA) && !isNaN(numB) && valA !== '' && valB !== '') {
           valA = numA;
           valB = numB;
        }

        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [data, sortConfig]);

  // Filter data across all string/number columns
  const filteredData = sortedData.filter(row => {
    // Global search term
    const matchesGlobal = Object.values(row).some(val => 
      String(val).toLowerCase().includes(searchTerm.toLowerCase())
    );
    return matchesGlobal;
  });

  return (
    <div style={{ marginTop: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', flexWrap: 'wrap', gap: '10px' }}>
        {!hideTitle && (
          <h3 style={{ margin: 0 }}>{customTitle || `Active ${itemLabel}s`}</h3>
        )}
        
        <div style={{ position: 'relative', width: '250px', maxWidth: '100%' }}>
          <Search size={16} style={{ position: 'absolute', left: '10px', top: '10px', color: '#888' }} />
          <input 
            type="text" 
            placeholder={`Search ${itemLabel.toLowerCase()}s...`}
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ width: '100%', paddingLeft: '35px', paddingRight: '10px', height: '36px', borderRadius: '20px', border: '1px solid var(--color-border)' }}
          />
        </div>
      </div>

      <div className="desktop-table-container" style={{ overflowX: 'auto', overflowY: maxHeight ? 'auto' : 'visible', maxHeight: maxHeight || 'none', WebkitOverflowScrolling: 'touch', margin: '0 -20px', padding: '0 20px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', background: 'white', minWidth: '600px', position: 'relative' }}>
          <thead>
            <tr style={{ background: '#f5f7fa', borderBottom: '2px solid var(--color-border)' }}>
              {onSelectionChange && (
                <th style={{ position: 'sticky', top: 0, zIndex: 2, background: '#f5f7fa', padding: '8px 10px', width: '40px', textAlign: 'center' }}>
                  <input 
                    type="checkbox" 
                    checked={filteredData.length > 0 && filteredData.every(row => selectedIds.includes(row.id))}
                    onChange={(e) => {
                      if (e.target.checked) {
                        onSelectionChange(filteredData.map(row => row.id));
                      } else {
                        onSelectionChange([]);
                      }
                    }}
                  />
                </th>
              )}
              {columns.map((col, i) => (
                <th key={i} onClick={() => handleSort(col.key)} style={{ position: 'sticky', top: 0, zIndex: 1, background: '#f5f7fa', padding: '8px 10px', color: '#555', fontSize: '0.85rem', textTransform: 'uppercase', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', ...(col.style || {}) }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {col.header}
                    {sortConfig.key === col.key && (
                      sortConfig.direction === 'asc' ? <ArrowUp size={14} color="#1565c0" /> : <ArrowDown size={14} color="#1565c0" />
                    )}
                  </div>
                </th>
              ))}
              {(onEdit || onDelete) && (
                <th style={{ position: 'sticky', top: 0, zIndex: 1, background: '#f5f7fa', padding: '8px 10px', textAlign: 'right', color: '#555', fontSize: '0.85rem', textTransform: 'uppercase' }}>Actions</th>
              )}
            </tr>
          </thead>
          <tbody>
            {filteredData.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (onEdit || onDelete ? 1 : 0) + (onSelectionChange ? 1 : 0)} style={{ padding: '30px', textAlign: 'center', color: '#999', fontStyle: 'italic' }}>
                  No {itemLabel.toLowerCase()}s found matching your search.
                </td>
              </tr>
            ) : (
              filteredData.map((row, rowIndex) => (
                <tr 
                  key={row.id || rowIndex} 
                  className={onEdit ? 'crud-table-row clickable' : 'crud-table-row'}
                  onClick={() => onEdit && onEdit(row)}
                  style={{ 
                    borderBottom: '1px solid #eee', 
                    transition: 'all 0.2s ease', 
                    cursor: onEdit ? 'pointer' : 'default',
                    background: activeRowId && activeRowId === row.id ? '#fff9c4' : undefined,
                    ...(rowStyle ? rowStyle(row) : {})
                  }}
                >
                  {onSelectionChange && (
                    <td style={{ padding: '8px 10px', textAlign: 'center', verticalAlign: 'top' }} onClick={(e) => e.stopPropagation()}>
                      <input 
                        type="checkbox" 
                        checked={selectedIds.includes(row.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            onSelectionChange([...selectedIds, row.id]);
                          } else {
                            onSelectionChange(selectedIds.filter(id => id !== row.id));
                          }
                        }}
                      />
                    </td>
                  )}
                  {columns.map((col, colIndex) => {
                    const isDateColumn = col.header.toLowerCase().includes('date') || col.header.toLowerCase().includes('time') || col.header.toLowerCase().includes('deadline') || col.header.toLowerCase() === 'dob' || col.key.toLowerCase().includes('date');
                    return (
                      <td key={colIndex} style={{ padding: '8px 10px', verticalAlign: 'top', whiteSpace: isDateColumn ? 'nowrap' : 'normal', wordBreak: isDateColumn ? 'normal' : 'normal', overflowWrap: isDateColumn ? 'normal' : 'break-word', ...(col.style || {}) }}>
                      {/* Render custom func if passed, otherwise raw key string */}
                      {col.render ? col.render(row) : row[col.key]}
                    </td>
                    );
                  })}
                  {(onEdit || onDelete) && (
                    <td style={{ padding: '8px 10px', textAlign: 'right', verticalAlign: 'top' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        {onEdit && (
                          <button 
                            type="button"
                            onClick={() => onEdit(row)} 
                            title="Edit Record"
                            style={{ padding: '6px', background: '#e3f2fd', color: '#1565c0', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                            <Edit2 size={14} />
                          </button>
                        )}
                        {onDelete && (
                          <button 
                            type="button"
                            onClick={(e) => { 
                              e.stopPropagation();
                              setConfirmDeleteId(row.id);
                            }} 
                            title="Delete Record"
                            style={{ padding: '6px', background: '#ffebee', color: '#c62828', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Card Framework */}
      <div className="card-list">
        {filteredData.length === 0 ? (
          <div style={{ padding: '30px', textAlign: 'center', color: '#999', fontStyle: 'italic', background: 'white', borderRadius: '8px' }}>
             No {itemLabel.toLowerCase()}s found matching your search.
          </div>
        ) : (
          filteredData.map((row, rowIndex) => {
            if (mobileRender) {
              return (
                <div 
                  key={row.id || rowIndex} 
                  onClick={() => onEdit && onEdit(row)} 
                  className={onEdit ? 'clickable' : ''} 
                  style={{ 
                    cursor: onEdit ? 'pointer' : 'default',
                    background: activeRowId && activeRowId === row.id ? '#fff9c4' : 'white',
                    borderBottom: '1px solid var(--color-border-light)',
                    ...(rowStyle ? rowStyle(row) : {})
                  }}
                >
                  {mobileRender(row)}
                </div>
              );
            }
            return (
              <div 
                key={row.id || rowIndex} 
                className={`mobile-data-card ${onEdit ? 'clickable' : ''}`} 
                onClick={() => onEdit && onEdit(row)}
                style={{
                  transition: 'all 0.2s ease',
                  cursor: onEdit ? 'pointer' : 'default',
                  background: activeRowId && activeRowId === row.id ? '#fff9c4' : undefined,
                  ...(rowStyle ? rowStyle(row) : {})
                }}
              >
                {onSelectionChange && (
                  <div style={{ display: 'flex', justifyContent: 'flex-start', paddingBottom: '10px', borderBottom: '1px solid var(--color-border-light)', marginBottom: '10px' }} onClick={(e) => e.stopPropagation()}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', margin: 0 }}>
                      <input 
                        type="checkbox" 
                        checked={selectedIds.includes(row.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            onSelectionChange([...selectedIds, row.id]);
                          } else {
                            onSelectionChange(selectedIds.filter(id => id !== row.id));
                          }
                        }}
                      />
                      Select this item
                    </label>
                  </div>
                )}
                {columns.map((col, colIndex) => (
                  <div key={colIndex} className="mobile-data-card-row">
                    <div className="mobile-data-card-label">{col.header}:</div>
                    <div className="mobile-data-card-value">
                      {col.render ? col.render(row) : row[col.key]}
                    </div>
                  </div>
                ))}
              
              {(onEdit || onDelete) && (
                <div className="mobile-data-actions">
                  {onEdit && (
                    <button 
                      type="button"
                      onClick={() => onEdit(row)} 
                      style={{ flex: 1, padding: '10px', background: '#e3f2fd', color: '#1565c0', border: 'none', borderRadius: '4px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', fontSize: '1rem', fontWeight: 600 }}>
                      <Edit2 size={16} /> Edit
                    </button>
                  )}
                  {onDelete && (
                    <button 
                      type="button"
                      onClick={(e) => { 
                        e.stopPropagation();
                        setConfirmDeleteId(row.id);
                      }} 
                      style={{ flex: 1, padding: '10px', background: '#ffebee', color: '#c62828', border: 'none', borderRadius: '4px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', fontSize: '1rem', fontWeight: 600 }}>
                      <Trash2 size={16} /> Delete
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })
        )}
      </div>

      {confirmDeleteId && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(null); }}>
          <div style={{ background: '#fff', padding: '20px', borderRadius: '8px', maxWidth: '400px', width: '90%', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0, color: '#c62828', display: 'flex', alignItems: 'center', gap: '8px' }}><Trash2 size={20} /> Confirm Deletion</h3>
            <p style={{ color: '#333', fontSize: '1rem', margin: '15px 0' }}>Are you sure you want to permanently delete this {itemLabel.toLowerCase()}? This action cannot be undone.</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
              <button type="button" onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(null); }} className="btn" style={{ background: '#f5f5f5', color: '#333' }}>Cancel</button>
              <button type="button" onClick={(e) => { e.stopPropagation(); onDelete(confirmDeleteId); setConfirmDeleteId(null); }} className="btn btn-primary" style={{ background: '#c62828', borderColor: '#c62828' }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
