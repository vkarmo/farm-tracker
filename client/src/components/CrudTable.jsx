import React, { useState, useMemo } from 'react';
import { Search, Edit2, Trash2, ArrowUp, ArrowDown } from 'lucide-react';

export default function CrudTable({ data, columns, onEdit, onDelete, itemLabel = 'Item', customTitle, rowStyle, defaultSort, maxHeight, activeRowId }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState(defaultSort || { key: 'updatedAt', direction: 'desc' });

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <h3 style={{ margin: 0 }}>{customTitle || `Active ${itemLabel}s`}</h3>
        
        <div style={{ position: 'relative', width: '250px' }}>
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
              {columns.map((col, i) => (
                <th key={i} onClick={() => handleSort(col.key)} style={{ position: 'sticky', top: 0, zIndex: 1, background: '#f5f7fa', padding: '8px 10px', color: '#555', fontSize: '0.85rem', textTransform: 'uppercase', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
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
                <td colSpan={(onEdit || onDelete) ? columns.length + 1 : columns.length} style={{ padding: '30px', textAlign: 'center', color: '#999', fontStyle: 'italic' }}>
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
                  {columns.map((col, colIndex) => {
                    const isDateColumn = col.header.toLowerCase().includes('date') || col.header.toLowerCase().includes('time') || col.header.toLowerCase().includes('deadline') || col.header.toLowerCase() === 'dob' || col.key.toLowerCase().includes('date');
                    return (
                      <td key={colIndex} style={{ padding: '8px 10px', whiteSpace: isDateColumn ? 'nowrap' : 'normal', wordBreak: isDateColumn ? 'normal' : 'break-all', overflowWrap: isDateColumn ? 'normal' : 'anywhere' }}>
                      {/* Render custom func if passed, otherwise raw key string */}
                      {col.render ? col.render(row) : row[col.key]}
                    </td>
                    );
                  })}
                  {(onEdit || onDelete) && (
                    <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        {onEdit && (
                          <button 
                            onClick={() => onEdit(row)} 
                            title="Edit Record"
                            style={{ padding: '6px', background: '#e3f2fd', color: '#1565c0', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                            <Edit2 size={14} />
                          </button>
                        )}
                        {onDelete && (
                          <button 
                            onClick={(e) => { 
                              e.stopPropagation();
                              if(window.confirm(`Permanently delete this ${itemLabel.toLowerCase()}?`)) onDelete(row.id);
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
          filteredData.map((row, rowIndex) => (
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
                      onClick={() => onEdit(row)} 
                      style={{ flex: 1, padding: '10px', background: '#e3f2fd', color: '#1565c0', border: 'none', borderRadius: '4px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', fontSize: '1rem', fontWeight: 600 }}>
                      <Edit2 size={16} /> Edit
                    </button>
                  )}
                  {onDelete && (
                    <button 
                      onClick={(e) => { 
                        e.stopPropagation();
                        if(window.confirm(`Permanently delete this ${itemLabel.toLowerCase()}?`)) onDelete(row.id);
                      }} 
                      style={{ flex: 1, padding: '10px', background: '#ffebee', color: '#c62828', border: 'none', borderRadius: '4px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', fontSize: '1rem', fontWeight: 600 }}>
                      <Trash2 size={16} /> Delete
                    </button>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
