import React, { useState, useEffect, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { queueAction } from '../store/syncSlice';
import { updateField, addField, deleteField } from '../store/fieldsSlice';
import { CheckCircle2, Target, X, PlusCircle, Copy, Lightbulb, ClipboardList } from 'lucide-react';
import CrudTable from './CrudTable';
import RecommendationViewer from './RecommendationViewer';
import { MapContainer, TileLayer, Polygon, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import FieldImageryOverlay, { getDeterministicSceneDate, getDeterministicCloudCover } from './FieldImageryOverlay';
import ResizableMapWrapper, { MapResizer } from './ResizableMapWrapper';
import { MapSearchBox, MapFlyTo, FarmLocationButton } from './MapSearchBox';
import area from '@turf/area';
import { polygon } from '@turf/helpers';
import Select from 'react-select';
import 'leaflet/dist/leaflet.css';


const ClickToDrawComponent = ({ polygon, setPolygon, setCenter }) => {
  useMapEvents({
    click(e) {
      setPolygon([...polygon, [e.latlng.lat, e.latlng.lng, Date.now()]]);
    }
  });
  return null;
};

const FitSelectedFieldsBounds = ({ selectedFields }) => {
  const map = useMap();
  useEffect(() => {
    if (!selectedFields || selectedFields.length === 0) return;
    const bounds = [];
    selectedFields.forEach(field => {
      if (field.polygon) {
        try {
          const poly = typeof field.polygon === 'string' ? JSON.parse(field.polygon) : field.polygon;
          let flat = poly;
          if (Array.isArray(poly) && poly.length > 0 && Array.isArray(poly[0]) && Array.isArray(poly[0][0])) {
            flat = poly[0];
          }
          if (Array.isArray(flat)) {
            flat.forEach(pt => {
              if (pt && pt.length >= 2) bounds.push([pt[0], pt[1]]);
            });
          }
        } catch (e) {}
      }
    });
    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [30, 30] });
    }
  }, [map, selectedFields]);
  return null;
};

const INIT_STATE = { name: '', area: '', year: String(new Date().getFullYear()), soil_type: 'Loam', irrigation: 'None', status: 'Fallow', gps: '', drawColor: '', includeInStats: true, layoutRotation: '' };
const INIT_TEST_STATE = { date: new Date().toISOString().split('T')[0], ph: '', nitrogen: '', phosphorus: '', potassium: '', notes: '' };

export default function FieldTab() {
  const dispatch = useDispatch();
  const fields = useSelector(state => state.fields.data) || [];
  const nurseries = useSelector(state => state.nurseries?.beds) || [];
  const pois = useSelector(state => state.poi?.list) || [];
  const soilTests = useSelector(state => state.soilTests?.tests) || [];
  const polygonColor = useSelector(state => state.settings?.polygonColor) || '#ffffff';
  const mapCenter = useSelector(state => state.settings?.mapCenter) || [51.505, -0.09];
  const mapZoom = useSelector(state => state.settings?.mapZoom) || 13;
  const themeFontImagerCapitalize = useSelector(state => state.settings?.themeFontImagerCapitalize) || false;
  const formatLabel = (txt) => themeFontImagerCapitalize ? txt.toUpperCase() : txt;
  const allRecommendations = useSelector(state => state.recommendations?.data) || [];

  const [activeTab, setActiveTab] = useState('roster');
  const [formData, setFormData] = useState(INIT_STATE);
  const [editingId, setEditingId] = useState(null);
  const [polygonPositions, setPolygonPositions] = useState([]);
  const [searchResultCenter, setSearchResultCenter] = useState(null);
  const [showRecommendations, setShowRecommendations] = useState(false);
  const [showRecAlert, setShowRecAlert] = useState(false);
  const [selectedFieldIdsForRec, setSelectedFieldIdsForRec] = useState([]);
  const [showRecResults, setShowRecResults] = useState(false);
  const [activeRecFieldId, setActiveRecFieldId] = useState(null);
  const [initialRecReportId, setInitialRecReportId] = useState('');
  const [fieldImagery, setFieldImagery] = useState({});
  const [fieldImageryOffsets, setFieldImageryOffsets] = useState({});
  const [geeStatus, setGeeStatus] = useState({});

  const activeId = editingId || 'active';
  const showActiveImagery = fieldImagery[activeId] && fieldImagery[activeId] !== 'none';
  const isActiveLoaded = geeStatus[activeId]?.status === 'success' || geeStatus[activeId]?.status === 'failed';
  const makeActiveTransparent = showActiveImagery && isActiveLoaded;


  useEffect(() => {
    const handler = (e) => {
      const { fieldId, status, error } = e.detail;
      setGeeStatus(prev => ({ ...prev, [fieldId]: { status, error } }));
    };
    window.addEventListener('gee-status-change', handler);
    return () => window.removeEventListener('gee-status-change', handler);
  }, []);

  const handleLocationFound = (loc) => {
    const newLoc = loc.length >= 3 ? loc : [loc[0], loc[1], Date.now()];
    setSearchResultCenter(newLoc);
    setPolygonPositions(prev => [...prev, newLoc]);
  };

  useEffect(() => {
    if (polygonPositions.length >= 3) {
      try {
        const ring = polygonPositions.map(p => [p[1], p[0]]); // Turf expects [lng, lat]
        if (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1]) {
          ring.push([...ring[0]]); // Close the ring
        }
        const turfPoly = polygon([ring]);
        const sqMeters = area(turfPoly);
        const acres = sqMeters * 0.000247105;
        // Do not violently overwrite if they typed something manually right before, 
        // but if it's explicitly calculated, update state
        setFormData(prev => ({ ...prev, area: acres.toFixed(2) }));
      } catch (err) {
        console.warn("Geographic computation failed:", err);
      }
    }
  }, [polygonPositions]);

  const resetForm = () => {
    setFormData(INIT_STATE);
    setEditingId(null);
    setPolygonPositions([]);
    setActiveTab('roster');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return alert("Validation Error: Field Name is strictly required.");
    if (parseFloat(formData.area) < 0) return alert("Validation Error: Mathematical acreage cannot be negative.");
    if (!formData.name || !formData.area) return;

    const finalData = { ...formData, polygon: JSON.stringify(polygonPositions) };

    if (editingId) {
      // UPDATE
      const updatedField = { ...finalData, id: editingId };
      dispatch(updateField(updatedField));
      dispatch(queueAction({ type: 'core/updateNode', payload: { id: editingId, properties: updatedField }, meta: { id: Date.now() } }));
    } else {
      // CREATE
      const newField = { ...finalData, id: `f_${Date.now()}` };
      dispatch(addField(newField));
      // fields/addField logic on server uses MERGE and sets all props, so it acts like an update/create.
      dispatch(queueAction({ type: 'fields/addField', payload: newField, meta: { id: Date.now() } }));
    }

    resetForm();
  };

  const handleEdit = (row) => {
    setFormData(row);
    setEditingId(row.id);
    if (row.polygon) {
      try {
        const poly = typeof row.polygon === 'string' ? JSON.parse(row.polygon) : row.polygon;
        setPolygonPositions(Array.isArray(poly) ? poly : []);
        if (poly.length > 0) setSearchResultCenter(poly[0]);
      } catch (e) { setPolygonPositions([]); }
    } else {
      setPolygonPositions([]);
      setSearchResultCenter(mapCenter);
    }
    setActiveTab('entry');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = (id) => {
    if (window.confirm("Permanently delete this field profile?")) {
      dispatch(deleteField(id));
      dispatch(queueAction({ type: 'core/deleteNode', payload: { id }, meta: { id: Date.now() } }));
      if (editingId === id) resetForm();
    }
  };

  const columns = [
    { key: 'name', header: 'Field Name' },
    { key: 'year', header: 'Vintage' },
    { key: 'area', header: 'Acres' },
    { key: 'soil_type', header: 'Soil' },
    { key: 'status', header: 'Status' }
  ];



  const fieldTests = soilTests.filter(t => t.fieldId === editingId);
  const testColumns = [
    { key: 'description', header: 'Description' },
    { key: 'gps', header: 'GPS Points', render: (r) => (r.testResults || []).some(res => res.lat && res.lng) ? 'Yes' : 'No' },
    { key: 'results', header: 'Results', render: (r) => `${(r.testResults || []).length} Recorded` }
  ];

  const sortedPositions = polygonPositions
    .map((p, i) => ({ pos: p, idx: i, time: p.length > 2 ? p[2] : 0 }))
    .sort((a, b) => {
      if (a.time === 0 && b.time === 0) return a.idx - b.idx;
      return a.time - b.time;
    })
    .map(obj => obj.pos);

  const existingReportsForSelectedFields = useMemo(() => {
    if (selectedFieldIdsForRec.length === 0) return [];
    
    const reportsList = [];
    selectedFieldIdsForRec.forEach(fieldId => {
      const fieldObj = fields.find(f => f.id === fieldId);
      if (fieldObj) {
        const linkedIds = fieldObj.recommendationIds || [];
        const fieldReports = allRecommendations.filter(r => linkedIds.includes(r.id) && r.isAI);
        fieldReports.forEach(report => {
          reportsList.push({
            report,
            fieldName: fieldObj.name,
            fieldId: fieldObj.id
          });
        });
      }
    });
    
    return reportsList.sort((a, b) => (b.report.createdAt || 0) - (a.report.createdAt || 0));
  }, [selectedFieldIdsForRec, fields, allRecommendations]);

  const latLngs = sortedPositions.map(p => [p[0], p[1]]);
  return (
    <>
      {showRecommendations && editingId ? (
        <RecommendationViewer fieldId={editingId} onToggleBack={() => setShowRecommendations(false)} />
      ) : (
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
                Field Sites
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('recommendations');
                  setShowRecResults(false);
                }}
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  border: 'none',
                  background: activeTab === 'recommendations' ? 'white' : 'transparent',
                  borderBottom: activeTab === 'recommendations' ? '3px solid var(--color-primary)' : 'none',
                  color: activeTab === 'recommendations' ? 'var(--color-primary)' : 'var(--color-text-light)',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  fontSize: '0.95rem'
                }}
              >
                Recommendations
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
                {editingId ? 'Edit Configuration' : 'Register Field'}
              </button>
            </div>

            <div style={{ padding: '20px' }}>
              {activeTab === 'roster' && (
                <CrudTable activeRowId={editingId}
                  data={fields}
                  columns={columns}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  itemLabel="Field"
                />
              )}

              {activeTab === 'recommendations' && (
                <div>
                  {!showRecResults ? (
                    <div style={{ display: 'flex', gap: '20px', flexDirection: 'row', flexWrap: 'wrap' }}>
                      {/* Left: Input picker */}
                      <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        <h3 style={{ margin: 0, color: '#334155', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Lightbulb size={24} color="#2e7d32" /> Get Crop & Soil Recommendations
                        </h3>
                        <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>
                          Select one or more fields below to query the agricultural advisor for tailored soil management guidelines and crop suitability scores.
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Select Fields</label>
                          <Select
                            isMulti
                            options={fields.map(f => ({ value: f.id, label: f.name }))}
                            value={selectedFieldIdsForRec.map(id => {
                              const f = fields.find(field => field.id === id);
                              return f ? { value: f.id, label: f.name } : null;
                            }).filter(Boolean)}
                            onChange={(vals) => {
                              setSelectedFieldIdsForRec((vals || []).map(v => v.value));
                            }}
                            placeholder="Select fields..."
                            styles={{
                              control: (base) => ({
                                ...base,
                                minHeight: '38px',
                                borderRadius: '6px',
                                borderColor: '#cbd5e1',
                                fontSize: '0.85rem'
                              }),
                              menuPortal: (base) => ({ ...base, zIndex: 9999 })
                            }}
                            menuPortalTarget={document.body}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (selectedFieldIdsForRec.length === 0) {
                              alert("Please select at least one field.");
                              return;
                            }
                            setInitialRecReportId('');
                            setActiveRecFieldId(selectedFieldIdsForRec[0]);
                            setShowRecResults(true);
                          }}
                          className="btn btn-primary"
                          style={{
                            background: 'var(--color-primary)',
                            color: 'white',
                            fontWeight: 600,
                            fontSize: '0.95rem',
                            padding: '10px 20px',
                            borderRadius: '6px',
                            border: 'none',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            marginTop: '10px'
                          }}
                        >
                          <Lightbulb size={18} /> Generate Recommendations
                        </button>

                        {selectedFieldIdsForRec.length > 0 && (
                          <div style={{ marginTop: '20px', borderTop: '1px solid var(--color-border-light)', paddingTop: '15px' }}>
                            <h4 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', color: '#1e293b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <ClipboardList size={16} /> Previously Saved Reports ({existingReportsForSelectedFields.length})
                            </h4>
                            {existingReportsForSelectedFields.length === 0 ? (
                              <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b', fontStyle: 'italic' }}>
                                No saved reports found for selected fields.
                              </p>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                                {existingReportsForSelectedFields.map(({ report, fieldName, fieldId }) => {
                                  const dateStr = new Date(report.createdAt || Date.now()).toLocaleDateString();
                                  return (
                                    <div
                                      key={report.id}
                                      onClick={() => {
                                        setInitialRecReportId(report.id);
                                        setActiveRecFieldId(fieldId);
                                        setShowRecResults(true);
                                      }}
                                      style={{
                                        padding: '10px',
                                        background: '#f8fafc',
                                        border: '1px solid #cbd5e1',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        fontSize: '0.8rem',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        transition: 'background-color 0.15s'
                                      }}
                                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                                    >
                                      <div>
                                        <strong style={{ color: '#334155' }}>{fieldName}</strong>
                                        <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                                          Created: {dateStr}
                                        </div>
                                      </div>
                                      <span style={{ fontSize: '0.75rem', color: '#2e7d32', fontWeight: 600 }}>Open &rarr;</span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Right: Map view */}
                      <div style={{ flex: '1 1 400px', minHeight: '350px', position: 'relative' }}>
                        <div style={{ height: '350px', width: '100%', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
                          <MapContainer center={mapCenter} zoom={mapZoom} maxZoom={24} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
                            <MapResizer />
                            <TileLayer attribution="Google Maps" url="https://mt0.google.com/vt/lyrs=y&hl=en&x={x}&y={y}&z={z}&s=Ga" maxZoom={24} maxNativeZoom={20} />
                            
                            {/* Render selected fields */}
                            {fields.filter(f => selectedFieldIdsForRec.includes(f.id)).map(field => {
                              let positions = [];
                              if (field.polygon) {
                                try { positions = typeof field.polygon === 'string' ? JSON.parse(field.polygon) : field.polygon; } catch (e) { }
                              }
                              if (positions.length === 0) return null;
                              return (
                                <Polygon
                                  key={field.id}
                                  positions={positions}
                                  pathOptions={{
                                    color: field.drawColor || '#ff9800',
                                    weight: 2,
                                    opacity: 0.9,
                                    fill: true,
                                    fillOpacity: 0.35
                                  }}
                                >
                                  <Popup>
                                    <strong>{field.name}</strong><br />
                                    Area: {field.area} ac<br />
                                    Soil: {field.soil_type}
                                  </Popup>
                                </Polygon>
                              );
                            })}
                            
                            {/* Render non-selected fields as faint outlines for context */}
                            {fields.filter(f => !selectedFieldIdsForRec.includes(f.id)).map(field => {
                              let positions = [];
                              if (field.polygon) {
                                try { positions = typeof field.polygon === 'string' ? JSON.parse(field.polygon) : field.polygon; } catch (e) { }
                              }
                              if (positions.length === 0) return null;
                              return (
                                <Polygon
                                  key={field.id}
                                  positions={positions}
                                  pathOptions={{
                                    color: '#ffffff',
                                    weight: 1,
                                    opacity: 0.4,
                                    fill: true,
                                    fillOpacity: 0.05,
                                    dashArray: '5,5'
                                  }}
                                >
                                  <Popup>
                                    <strong>{field.name}</strong> (Not Selected)
                                  </Popup>
                                </Polygon>
                              );
                            })}

                            <FitSelectedFieldsBounds selectedFields={fields.filter(f => selectedFieldIdsForRec.includes(f.id))} />
                          </MapContainer>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div>
                      {selectedFieldIdsForRec.length > 1 && (
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '15px', overflowX: 'auto', paddingBottom: '8px' }} className="hide-scrollbar">
                          {selectedFieldIdsForRec.map(id => {
                            const f = fields.find(field => field.id === id);
                            if (!f) return null;
                            const isActive = activeRecFieldId === id;
                            return (
                              <button
                                key={id}
                                type="button"
                                onClick={() => setActiveRecFieldId(id)}
                                className={`btn ${isActive ? 'btn-primary' : ''}`}
                                style={{
                                  background: isActive ? 'var(--color-primary)' : '#f1f5f9',
                                  color: isActive ? 'white' : '#475569',
                                  fontSize: '0.85rem',
                                  padding: '6px 12px',
                                  borderRadius: '6px',
                                  border: 'none',
                                  cursor: 'pointer',
                                  fontWeight: 600,
                                  transition: 'all 0.15s'
                                }}
                              >
                                {f.name}
                              </button>
                            );
                          })}
                        </div>
                      )}
                      {activeRecFieldId && (
                        <RecommendationViewer
                          fieldId={activeRecFieldId}
                          onToggleBack={() => setShowRecResults(false)}
                          selectedFieldIds={selectedFieldIdsForRec}
                          initialReportId={initialRecReportId}
                        />
                      )}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'entry' && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                    <h2 style={{ margin: 0 }}>{editingId ? 'Edit Field Data' : 'Enter New Field Data'}</h2>
                    {editingId && (
                      <button type="button" onClick={resetForm} className="btn" style={{ background: '#f5f5f5', color: '#333' }}>
                        <X size={14} style={{ marginRight: 4 }} /> Cancel Edit
                      </button>
                    )}
                  </div>

                  <form onSubmit={handleSubmit}>
                    <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', justifyContent: 'flex-end' }}>
                      <button type="submit" className="btn btn-primary">
                        <CheckCircle2 size={16} style={{ marginRight: 6 }} /> {editingId ? 'Update Field' : 'Save Field Data'}
                      </button>
                    </div>
                    <div className="form-grid">
                      <div className="form-group form-grid-full" style={{ display: 'flex', gap: '15px', alignItems: 'flex-end', marginBottom: '15px' }}>
                        <div style={{ flex: 1 }}>
                          <label>Field Name / Identifier</label>
                          <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. North Pasture" />
                        </div>
                        <button type="button" onClick={() => {
                          if (!editingId) {
                            setShowRecAlert(true);
                          } else {
                            setShowRecommendations(true);
                          }
                        }} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px 24px', height: '44px', fontSize: '1rem', fontWeight: 600 }}>
                          <Lightbulb size={20} /> Recommendations
                        </button>
                      </div>
                      <div className="form-group form-grid-full" style={{ marginBottom: '15px' }}>
                        <label>Draw Field Location on Map (Click to add points to polygon)</label>
                        <div style={{ marginBottom: '10px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                          <div style={{ flex: 1 }}>
                            <MapSearchBox
                              onLocationFound={handleLocationFound}
                              onClear={polygonPositions.length > 0 ? () => setPolygonPositions([]) : null}
                              polygon={polygonPositions}
                              setPolygon={setPolygonPositions}
                              activeId={editingId}
                            />
                          </div>
                        </div>
                        <ResizableMapWrapper initialHeight={500} style={{ marginBottom: '15px' }}>
                          <MapContainer key={editingId || 'new'} center={latLngs.length > 0 ? latLngs[0] : mapCenter} zoom={latLngs.length > 0 ? 16 : mapZoom} maxZoom={24} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
                            <MapResizer />
                            <MapFlyTo center={searchResultCenter} />
                            <TileLayer
                              attribution="Google Maps"
                              url="https://mt0.google.com/vt/lyrs=y&hl=en&x={x}&y={y}&z={z}&s=Ga"
                              maxZoom={24}
                              maxNativeZoom={20}
                            />
                            <ClickToDrawComponent polygon={polygonPositions} setPolygon={setPolygonPositions} setCenter={setSearchResultCenter} />
                            {latLngs.map((pos, idx) => (
                              <Marker key={`pin_${idx}`} position={pos} />
                            ))}
                            {latLngs.length > 0 && (
                              <React.Fragment>
                                <Polygon
                                  key="active-field-poly"
                                  positions={latLngs}
                                  pathOptions={{
                                    color: formData.drawColor || polygonColor,
                                    weight: 1.5,
                                    opacity: 0.6,
                                    fill: true,
                                    fillOpacity: makeActiveTransparent ? 0.0 : 0.2
                                  }}
                                >
                                  <Popup>
                                    <div style={{ minWidth: '200px' }}>
                                      <strong>Active Field: {formData.name || 'Unnamed'}</strong>
                                      <div style={{ marginTop: '8px' }}>
                                        <label className="imager-select-label" style={{ display: 'block', marginBottom: '4px' }}>{formatLabel("Field Imagery:")}</label>
                                        <select
                                          className="imager-select"
                                          value={fieldImagery[editingId || 'active'] || 'none'}
                                          onChange={(e) => setFieldImagery(prev => ({ ...prev, [editingId || 'active']: e.target.value }))}
                                          style={{ padding: '4px', borderRadius: '4px', width: '100%', background: 'white' }}
                                        >
                                          <option value="Elevation">{formatLabel("Elevation (Topography)")}</option>
                                          <option value="none">{formatLabel("None (Standard)")}</option>
                                          <optgroup label={formatLabel("Satellite Indices")}>
                                            <option value="CurrentSatellite">{formatLabel("Current Satellite View")}</option>
                                            <option value="TrueColor">{formatLabel("True Color (RGB)")}</option>
                                            <option value="NDVI">{formatLabel("NDVI (Vegetation Index)")}</option>
                                            <option value="NDWI">{formatLabel("NDWI (Water Index)")}</option>
                                            <option value="EVI">{formatLabel("EVI (Enhanced Vegetation)")}</option>
                                            <option value="SoilMoisture">{formatLabel("Soil Moisture")}</option>
                                            <option value="FalseColor">{formatLabel("False Color (Biomass)")}</option>
                                          </optgroup>
                                          <optgroup label={formatLabel("Weather Map Overlays (GEE)")}>
                                            <option value="GEE_Temp">{formatLabel("Weather: Temperature (GEE GFS)")}</option>
                                            <option value="GEE_Precip">{formatLabel("Weather: Precipitation (GEE GFS)")}</option>
                                            <option value="GEE_Wind">{formatLabel("Weather: Wind Speed (GEE GFS)")}</option>
                                            <option value="GEE_Humidity">{formatLabel("Weather: Relative Humidity (GEE GFS)")}</option>
                                            <option value="GEE_Clouds">{formatLabel("Weather: Total Cloud Cover (GEE GFS)")}</option>
                                            <option value="GEE_Pressure">{formatLabel("Weather: Sea Level Pressure (GEE GFS)")}</option>
                                          </optgroup>
                                        </select>
                                      </div>
                                      {fieldImagery[editingId || 'active'] && fieldImagery[editingId || 'active'] !== 'none' && (
                                        <div style={{ marginTop: '8px', padding: '6px', background: '#f1f8e9', borderRadius: '4px', border: '1px solid #c5e1a5', fontSize: '0.72rem', color: '#33691e' }}>
                                          <div style={{ fontWeight: 700, marginBottom: '2px' }}>
                                            {fieldImagery[editingId || 'active'] === 'GEE_Clouds' ? 'Weather: Clouds (GEE)' :
                                              fieldImagery[editingId || 'active'] === 'GEE_Precip' ? 'Weather: Precipitation (GEE)' :
                                                fieldImagery[editingId || 'active'] === 'GEE_Temp' ? 'Weather: Temperature (GEE)' :
                                                  fieldImagery[editingId || 'active'] === 'GEE_Wind' ? 'Weather: Wind Speed (GEE)' :
                                                    fieldImagery[editingId || 'active'] === 'GEE_Humidity' ? 'Weather: Relative Humidity (GEE)' :
                                                      fieldImagery[editingId || 'active'] === 'GEE_Pressure' ? 'Weather: Sea Level Pressure (GEE)' :
                                                        fieldImagery[editingId || 'active'] === 'CurrentSatellite' ? 'Current Satellite (High-Res)' :
                                                          fieldImagery[editingId || 'active'] === 'Elevation' ? 'Elevation (Topography)' : 'Sentinel-2 (10m Index)'}
                                          </div>
                                          {geeStatus[editingId || 'active'] && geeStatus[editingId || 'active'].status === 'failed' && (
                                            <div style={{ marginTop: '4px', color: '#c62828', fontWeight: 600, fontSize: '0.65rem', lineHeight: '1.2' }}>
                                              {`⚠ GEE Failed: ${geeStatus[editingId || 'active'].error}. Showing simulation.`}
                                            </div>
                                          )}
                                          {geeStatus[editingId || 'active'] && geeStatus[editingId || 'active'].status === 'success' && (
                                            <div style={{ marginTop: '4px', color: '#2e7d32', fontWeight: 600, fontSize: '0.65rem', lineHeight: '1.2' }}>
                                              ✓ Live Earth Engine imagery loaded.
                                            </div>
                                          )}
                                          {geeStatus[editingId || 'active'] && geeStatus[editingId || 'active'].status === 'loading' && (
                                            <div style={{ marginTop: '4px', color: '#1565c0', fontSize: '0.65rem', lineHeight: '1.2' }}>
                                              Fetching GEE tiles...
                                            </div>
                                          )}
                                          <div>Scene Date: {getDeterministicSceneDate(editingId || 'active', fieldImageryOffsets[editingId || 'active'] || 0)}</div>
                                          {!['GEE_Temp', 'GEE_Precip', 'GEE_Wind', 'GEE_Humidity', 'GEE_Clouds', 'GEE_Pressure'].includes(fieldImagery[editingId || 'active']) && (
                                            <div>Cloud Cover: {getDeterministicCloudCover(editingId || 'active', fieldImageryOffsets[editingId || 'active'] || 0)}%</div>
                                          )}

                                          <div style={{ display: 'flex', marginTop: '6px', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                                              <span style={{ fontSize: '0.62rem', fontWeight: 600, color: '#558b2f' }}>Older</span>
                                              <button
                                                type="button"
                                                className="btn btn-secondary"
                                                style={{ padding: '2px 8px', fontSize: '0.75rem', cursor: 'pointer', marginTop: '2px', width: '100%', lineHeight: 1 }}
                                                onClick={() => setFieldImageryOffsets(prev => ({ ...prev, [editingId || 'active']: (prev[editingId || 'active'] || 0) - 30 }))}
                                              >
                                                ←
                                              </button>
                                            </div>

                                            <span style={{ fontWeight: 700, fontSize: '0.68rem', margin: '0 8px', minWidth: '55px', textAlign: 'center', alignSelf: 'flex-end', marginBottom: '4px' }}>
                                              {(fieldImageryOffsets[editingId || 'active'] || 0) === 0 ? 'Latest' : `${Math.abs(fieldImageryOffsets[editingId || 'active'] || 0)}d ago`}
                                            </span>

                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                                              <span style={{ fontSize: '0.62rem', fontWeight: 600, color: '#558b2f' }}>Newer</span>
                                              <button
                                                type="button"
                                                className="btn btn-secondary"
                                                style={{ padding: '2px 8px', fontSize: '0.75rem', cursor: 'pointer', marginTop: '2px', width: '100%', lineHeight: 1 }}
                                                disabled={(fieldImageryOffsets[editingId || 'active'] || 0) >= 0}
                                                onClick={() => setFieldImageryOffsets(prev => ({ ...prev, [editingId || 'active']: (prev[editingId || 'active'] || 0) + 30 }))}
                                              >
                                                →
                                              </button>
                                            </div>
                                          </div>

                                        </div>
                                      )}
                                    </div>
                                  </Popup>
                                </Polygon>
                                {fieldImagery[editingId || 'active'] && fieldImagery[editingId || 'active'] !== 'none' && (
                                  <FieldImageryOverlay
                                    polygon={latLngs}
                                    indexType={fieldImagery[editingId || 'active']}
                                    dateOffset={fieldImageryOffsets[editingId || 'active'] || 0}
                                    fieldId={editingId || 'active'}
                                  />
                                )}
                              </React.Fragment>
                            )}
                            {/* Render existing saved fields (clickable for editing/imagery) */}
                            {fields.filter(f => f.id !== editingId).map(field => {
                              let positions = [];
                              if (field.polygon) {
                                try { positions = typeof field.polygon === 'string' ? JSON.parse(field.polygon) : field.polygon; } catch (e) { }
                              }
                              if (positions.length === 0) return null;
                              const isBg = editingId !== null || polygonPositions.length > 0;
                              const showImagery = fieldImagery[field.id] && fieldImagery[field.id] !== 'none';
                              const isLoaded = geeStatus[field.id]?.status === 'success' || geeStatus[field.id]?.status === 'failed';
                              const makeTransparent = showImagery && isLoaded;

                              return (
                                <React.Fragment key={field.id}>
                                  <Polygon
                                    key={field.id}
                                    positions={positions}
                                    pathOptions={{
                                      color: field.drawColor || polygonColor,
                                      weight: isBg ? 0.8 : 1.5,
                                      opacity: 0.6,
                                      fill: true,
                                      fillOpacity: makeTransparent ? 0.0 : (isBg ? 0.05 : 0.3),
                                      dashArray: isBg ? '5,5' : undefined,
                                      bubblingMouseEvents: false
                                    }}
                                    interactive={!isBg}
                                  >
                                    <Popup>
                                      <div style={{ minWidth: '200px' }}>
                                        <strong>{field.name}</strong><br />
                                        Area: {field.area} ac<br />
                                        <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                          <div>
                                            <label className="imager-select-label" style={{ display: 'block', marginBottom: '4px' }}>{formatLabel("Field Imagery:")}</label>
                                            <select
                                              className="imager-select"
                                              value={fieldImagery[field.id] || 'none'}
                                              onChange={(e) => setFieldImagery(prev => ({ ...prev, [field.id]: e.target.value }))}
                                              style={{ padding: '4px', borderRadius: '4px', width: '100%', background: 'white' }}
                                            >
                                              <option value="Elevation">{formatLabel("Elevation (Topography)")}</option>
                                              <option value="none">{formatLabel("None (Standard)")}</option>
                                              <optgroup label={formatLabel("Satellite Indices")}>
                                                <option value="CurrentSatellite">{formatLabel("Current Satellite View")}</option>
                                                <option value="TrueColor">{formatLabel("True Color (RGB)")}</option>
                                                <option value="NDVI">{formatLabel("NDVI (Vegetation Index)")}</option>
                                                <option value="NDWI">{formatLabel("NDWI (Water Index)")}</option>
                                                <option value="EVI">{formatLabel("EVI (Enhanced Vegetation)")}</option>
                                                <option value="SoilMoisture">{formatLabel("Soil Moisture")}</option>
                                                <option value="FalseColor">{formatLabel("False Color (Biomass)")}</option>
                                              </optgroup>
                                              <optgroup label={formatLabel("Weather Map Overlays (GEE)")}>
                                                <option value="GEE_Temp">{formatLabel("Weather: Temperature (GEE GFS)")}</option>
                                                <option value="GEE_Precip">{formatLabel("Weather: Precipitation (GEE GFS)")}</option>
                                                <option value="GEE_Wind">{formatLabel("Weather: Wind Speed (GEE GFS)")}</option>
                                                <option value="GEE_Humidity">{formatLabel("Weather: Relative Humidity (GEE GFS)")}</option>
                                                <option value="GEE_Clouds">{formatLabel("Weather: Total Cloud Cover (GEE GFS)")}</option>
                                                <option value="GEE_Pressure">{formatLabel("Weather: Sea Level Pressure (GEE GFS)")}</option>
                                              </optgroup>
                                            </select>
                                          </div>
                                          {fieldImagery[field.id] && fieldImagery[field.id] !== 'none' && (
                                            <div style={{ padding: '6px', background: '#f1f8e9', borderRadius: '4px', border: '1px solid #c5e1a5', fontSize: '0.72rem', color: '#33691e', marginBottom: '8px' }}>
                                              <div style={{ fontWeight: 700, marginBottom: '2px' }}>
                                                {fieldImagery[field.id] === 'GEE_Clouds' ? 'Weather: Clouds (GEE)' :
                                                  fieldImagery[field.id] === 'GEE_Precip' ? 'Weather: Precipitation (GEE)' :
                                                    fieldImagery[field.id] === 'GEE_Temp' ? 'Weather: Temperature (GEE)' :
                                                      fieldImagery[field.id] === 'GEE_Wind' ? 'Weather: Wind Speed (GEE)' :
                                                        fieldImagery[field.id] === 'GEE_Humidity' ? 'Weather: Relative Humidity (GEE)' :
                                                          fieldImagery[field.id] === 'GEE_Pressure' ? 'Weather: Sea Level Pressure (GEE)' :
                                                            fieldImagery[field.id] === 'CurrentSatellite' ? 'Current Satellite (High-Res)' :
                                                              fieldImagery[field.id] === 'Elevation' ? 'Elevation (Topography)' : 'Sentinel-2 (10m Index)'}
                                              </div>
                                              {geeStatus[field.id] && geeStatus[field.id].status === 'failed' && (
                                                <div style={{ marginTop: '4px', color: '#c62828', fontWeight: 600, fontSize: '0.65rem', lineHeight: '1.2' }}>
                                                  {`⚠ GEE Failed: ${geeStatus[field.id].error}. Showing simulation.`}
                                                </div>
                                              )}
                                              {geeStatus[field.id] && geeStatus[field.id].status === 'success' && (
                                                <div style={{ marginTop: '4px', color: '#2e7d32', fontWeight: 600, fontSize: '0.65rem', lineHeight: '1.2' }}>
                                                  ✓ Live Earth Engine imagery loaded.
                                                </div>
                                              )}
                                              {geeStatus[field.id] && geeStatus[field.id].status === 'loading' && (
                                                <div style={{ marginTop: '4px', color: '#1565c0', fontSize: '0.65rem', lineHeight: '1.2' }}>
                                                  Fetching GEE tiles...
                                                </div>
                                              )}
                                              <div>Scene Date: {getDeterministicSceneDate(field.id, fieldImageryOffsets[field.id] || 0)}</div>
                                              {!['GEE_Temp', 'GEE_Precip', 'GEE_Wind', 'GEE_Humidity', 'GEE_Clouds', 'GEE_Pressure'].includes(fieldImagery[field.id]) && (
                                                <div>Cloud Cover: {getDeterministicCloudCover(field.id, fieldImageryOffsets[field.id] || 0)}%</div>
                                              )}

                                              <div style={{ display: 'flex', marginTop: '6px', alignItems: 'center', justifyContent: 'space-between' }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                                                  <span style={{ fontSize: '0.62rem', fontWeight: 600, color: '#558b2f' }}>Older</span>
                                                  <button
                                                    type="button"
                                                    className="btn btn-secondary"
                                                    style={{ padding: '2px 8px', fontSize: '0.75rem', cursor: 'pointer', marginTop: '2px', width: '100%', lineHeight: 1 }}
                                                    onClick={() => setFieldImageryOffsets(prev => ({ ...prev, [field.id]: (prev[field.id] || 0) - 30 }))}
                                                  >
                                                    ←
                                                  </button>
                                                </div>

                                                <span style={{ fontWeight: 700, fontSize: '0.68rem', margin: '0 8px', minWidth: '55px', textAlign: 'center', alignSelf: 'flex-end', marginBottom: '4px' }}>
                                                  {(fieldImageryOffsets[field.id] || 0) === 0 ? 'Latest' : `${Math.abs(fieldImageryOffsets[field.id] || 0)}d ago`}
                                                </span>

                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                                                  <span style={{ fontSize: '0.62rem', fontWeight: 600, color: '#558b2f' }}>Newer</span>
                                                  <button
                                                    type="button"
                                                    className="btn btn-secondary"
                                                    style={{ padding: '2px 8px', fontSize: '0.75rem', cursor: 'pointer', marginTop: '2px', width: '100%', lineHeight: 1 }}
                                                    disabled={(fieldImageryOffsets[field.id] || 0) >= 0}
                                                    onClick={() => setFieldImageryOffsets(prev => ({ ...prev, [field.id]: (prev[field.id] || 0) + 30 }))}
                                                  >
                                                    →
                                                  </button>
                                                </div>
                                              </div>

                                            </div>
                                          )}
                                          {!isBg && (
                                            <button
                                              type="button"
                                              className="btn"
                                              style={{ padding: '4px 8px', fontSize: '0.85rem', width: '100%' }}
                                              onClick={() => handleEdit(field)}
                                            >
                                              Edit Field Details
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    </Popup>
                                  </Polygon>
                                  {fieldImagery[field.id] && fieldImagery[field.id] !== 'none' && (
                                    <FieldImageryOverlay
                                      polygon={positions}
                                      indexType={fieldImagery[field.id]}
                                      dateOffset={fieldImageryOffsets[field.id] || 0}
                                      fieldId={field.id}
                                    />
                                  )}
                                </React.Fragment>
                              );
                            })}
                            {/* Render nurseries for context (unclickable) */}
                            {nurseries.map(n => {
                              let positions = [];
                              if (n.polygon) { try { positions = typeof n.polygon === 'string' ? JSON.parse(n.polygon) : n.polygon; } catch (e) { } }
                              if (positions.length === 0) return null;
                              return <Polygon key={n.id} positions={positions} pathOptions={{ color: n.drawColor || 'orange', weight: 0.8, opacity: 0.5, dashArray: '5,5', fillOpacity: 0.1 }} interactive={false} />;
                            })}
                            {/* Render POIs for context (unclickable) */}
                            {pois.map(p => {
                              let positions = [];
                              if (p.points) { try { positions = typeof p.points === 'string' ? JSON.parse(p.points) : p.points; } catch (e) { } }
                              if (positions.length === 0) return null;
                              return <Polygon key={p.id} positions={positions} pathOptions={{ color: 'purple', weight: 0.8, opacity: 0.5, dashArray: '5,5', fillOpacity: 0.1 }} interactive={false} />;
                            })}
                          </MapContainer>
                        </ResizableMapWrapper>
                      </div>
                      <div className="form-group">
                        <label>Harvest Year / Vintage</label>
                        <input type="number" value={formData.year} onChange={e => setFormData({ ...formData, year: e.target.value })} placeholder="2026" />
                      </div>
                      <div className="form-group">
                        <label>Area Size (Acres)</label>
                        <input type="number" step="0.01" value={formData.area} onChange={e => setFormData({ ...formData, area: e.target.value })} placeholder="5.5" />
                      </div>
                      <div className="form-group">
                        <label>Soil Type</label>
                        <select value={formData.soil_type} onChange={e => setFormData({ ...formData, soil_type: e.target.value })}>
                          <option>Clay</option><option>Loam</option><option>Sandy</option><option>Silt</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Irrigation Type</label>
                        <select value={formData.irrigation} onChange={e => setFormData({ ...formData, irrigation: e.target.value })}>
                          <option>Creek</option><option>Drip</option><option>Flood</option><option>None</option><option>Rain</option><option>Sprinkler</option><option>Well</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Current Status</label>
                        <select value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })}>
                          <option>Cover Crop</option><option>Fallow</option><option>Planted</option><option>Prepared</option>
                        </select>
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
                      <div className="form-group">
                        <label>Layout Rotation (Degrees)</label>
                        <input
                          type="number"
                          min="0"
                          max="360"
                          value={formData.layoutRotation !== undefined && formData.layoutRotation !== null ? formData.layoutRotation : ''}
                          onChange={e => setFormData({ ...formData, layoutRotation: e.target.value === '' ? '' : parseInt(e.target.value) })}
                          placeholder="Auto-aligned"
                        />
                      </div>
                      <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '20px' }}>
                        <input
                          type="checkbox"
                          id="includeInStats"
                          checked={formData.includeInStats !== false}
                          onChange={e => setFormData({ ...formData, includeInStats: e.target.checked })}
                          style={{ width: '18px', height: '18px', margin: 0, cursor: 'pointer' }}
                        />
                        <label htmlFor="includeInStats" style={{ margin: 0, fontWeight: 500, cursor: 'pointer' }}>Include in Dashboard Statistics</label>
                      </div>
                    </div>
                  </form>

                  {editingId && fieldTests.length > 0 && (
                    <div style={{ marginTop: '30px', background: '#f9f9f9', padding: '15px', borderRadius: '8px', border: '1px solid #e0e0e0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 style={{ margin: 0 }}>Soil Tests for {formData.name}</h3>
                        <span style={{ fontSize: '0.85rem', color: '#666' }}>Add new tests in the Soil Tests tab</span>
                      </div>
                      <div style={{ marginTop: '15px' }}>
                        <CrudTable activeRowId={editingId}
                          data={fieldTests}
                          columns={testColumns}
                          onEdit={() => alert("Please edit soil tests from the dedicated Soil Tests tab.")}
                          onDelete={() => alert("Please delete soil tests from the dedicated Soil Tests tab.")}
                          itemLabel="Test"
                          customTitle="Recorded Tests"
                          defaultSort={{ key: 'date', direction: 'desc' }}
                        />
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {showRecAlert && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowRecAlert(false)}>
          <div style={{ background: '#fff', padding: '20px', borderRadius: '8px', maxWidth: '400px', width: '90%', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0, color: '#f57c00', display: 'flex', alignItems: 'center', gap: '8px' }}><Lightbulb size={20} /> Notice</h3>
            <p style={{ color: '#333', fontSize: '1rem', margin: '15px 0' }}>Please save the field data first before adding or viewing recommendations.</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button type="button" onClick={() => setShowRecAlert(false)} className="btn btn-primary" style={{ background: '#1565c0' }}>OK</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
