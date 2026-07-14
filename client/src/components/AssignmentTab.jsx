import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Select from 'react-select';
import { saveAssignment, removeAssignment, setEditingAssignmentId } from '../store/assignmentSlice';
import CrudTable from './CrudTable';

import ErrorBoundary from './ErrorBoundary';


function AssignmentTabComponent() {
  const dispatch = useDispatch();
  const assignments = useSelector(state => state.assignments?.list) || [];
  const fields = useSelector(state => state.fields?.data) || [];
  const employeesList = useSelector(state => state.employees?.list) || [];
  const nurseries = useSelector(state => state.nurseries?.beds) || [];
  const crops = useSelector(state => state.assets?.crops) || [];
  const planningGoals = useSelector(state => state.planning?.goals) || [];
  const planningObjectives = useSelector(state => state.planning?.objectives) || [];

  const [editingId, setEditingId] = useState(null);
  const [fieldId, setFieldId] = useState('');
  
  // New Relational Data Pointers
  const [workerIds, setWorkerIds] = useState([]);
  const [workerCount, setWorkerCount] = useState('');
  const [filterJobTitle, setFilterJobTitle] = useState('');
  const [filterGender, setFilterGender] = useState('');
  const [legacyWorkers, setLegacyWorkers] = useState(''); 

  const [hours, setHours] = useState('');
  const [task, setTask] = useState('');
  const [assignmentDate, setAssignmentDate] = useState(new Date().toISOString().split('T')[0]);
  const [completedDate, setCompletedDate] = useState('');
  const [planningId, setPlanningId] = useState('');
  const [reviewStatus, setReviewStatus] = useState('Pending Review');

  const [activeTab, setActiveTab] = useState('roster');

  const resetForm = () => {
    setEditingId(null);
    setFieldId('');
    setWorkerIds([]);
    setWorkerCount('');
    setLegacyWorkers('');
    setHours('');
    setTask('');
    setAssignmentDate(new Date().toISOString().split('T')[0]);
    setCompletedDate('');
    setPlanningId('');
    setReviewStatus('Pending Review');
    setActiveTab('roster');
  };

  const handleEdit = (assignment) => {
    setEditingId(assignment.id);
    setFieldId(assignment.fieldId || '');
    setWorkerIds(assignment.workerIds || []);
    setWorkerCount(assignment.workerCount !== undefined ? (typeof assignment.workerCount === 'object' ? (assignment.workerCount.low || 0) : assignment.workerCount) : '');
    setLegacyWorkers(assignment.workers || ''); // Fallback for assignments formulated prior to EmployeeTab
    setHours(assignment.hours || '');
    setTask(assignment.task || '');
    setAssignmentDate(assignment.assignmentDate || '');
    setCompletedDate(assignment.completedDate || '');
    setPlanningId(assignment.planningId || '');
    setReviewStatus(assignment.reviewStatus || 'Pending Review');
    setActiveTab('entry');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const reduxEditingId = useSelector(state => state.assignments.editingId);

  useEffect(() => {
    if (reduxEditingId) {
      const assignment = assignments.find(a => a.id === reduxEditingId);
      if (assignment) {
        handleEdit(assignment);
        dispatch(setEditingAssignmentId(null));
      }
    }
  }, [reduxEditingId, assignments, dispatch]);

  const handleSelectChange = (selectedOptions) => {
    const newIds = selectedOptions ? selectedOptions.map(opt => opt.value) : [];
    setWorkerIds(newIds);
    setWorkerCount(newIds.length); // Dynamic mathematics override
  };

  const employeeOptions = [...employeesList]
    .sort((a,b) => (a.lastName || '').localeCompare(b.lastName || ''))
    .map(emp => ({
      value: emp.id,
      label: `${emp.lastName || 'Unknown'}, ${emp.firstName || 'Unknown'} (${emp.jobTitle || 'No Title'})`
    }));

  const activeSelectedOptions = employeeOptions.filter(opt => workerIds.includes(opt.value));

  const uniqueJobTitles = Array.from(new Set(employeesList.map(e => e.jobTitle).filter(Boolean))).sort((a, b) => String(a).localeCompare(String(b)));

  const handleAddGroup = () => {
    let toAdd = employeesList;
    if (filterJobTitle) toAdd = toAdd.filter(e => e.jobTitle === filterJobTitle);
    if (filterGender) toAdd = toAdd.filter(e => e.gender === filterGender);
    
    if (toAdd.length === 0) {
      alert("No employees match this group criteria.");
      return;
    }
    
    const newIds = toAdd.map(e => e.id);
    const merged = Array.from(new Set([...workerIds, ...newIds]));
    setWorkerIds(merged);
    setWorkerCount(merged.length);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
        if (!fieldId || !task || !assignmentDate) {
      alert("Field, Task, and Assignment Date are required.");
      return;
    }

    const payload = {
      id: editingId || `wa_${Date.now()}`,
      fieldId,
      workerIds,
      workerCount: parseInt(workerCount) || workerIds.length || 0,
      workers: legacyWorkers, // Preserving any legacy strings if being edited
      hours: parseFloat(hours) || 0,
      task,
      assignmentDate,
      completedDate,
      planningId,
      reviewStatus
    };

    dispatch(saveAssignment(payload));
    resetForm();
  };

  const handleDelete = (id) => {
    if (window.confirm("Delete this worker assignment?")) {
      dispatch(removeAssignment(id));
      if (editingId === id) resetForm();
    }
  };

  const getTargetName = (id) => {
    const crop = crops.find(c => c.id === id);
    if (crop) return `Crop: ${crop.name}`;
    const field = fields.find(f => f.id === id);
    if (field) return `Field: ${field.name}`;
    const bed = nurseries.find(n => n.id === id);
    if (bed) return `Nursery: ${bed.name}`;
    return id;
  };

  const renderWorkerNames = (assignment) => {
    if (assignment.workerIds && assignment.workerIds.length > 0) {
      const names = assignment.workerIds.map(id => {
        const emp = employeesList.find(e => e.id === id);
        return emp ? `${emp.firstName} ${emp.lastName}` : 'Unknown';
      });
      return names.join(', ');
    }
    // Fallback back down to legacy freehand if mapping doesn't exist
    return assignment.workers || 'No Workers Attached';
  };

  const sortedAssignments = [...assignments].sort((a, b) => (b.assignmentDate || '').localeCompare(a.assignmentDate || ''));
  const activeAssignments = sortedAssignments.filter(a => !a.completedDate);
  const completedAssignments = sortedAssignments.filter(a => a.completedDate);

  const activeColumns = [
    { key: 'assignmentDate', header: 'Date' },
    { key: 'headcount', header: 'Headcount', render: (r) => (
      <span className="status-indicator" style={{ background: '#e3f2fd', color: '#1565c0' }}>
        {r.workerCount !== undefined ? (typeof r.workerCount === 'object' ? (r.workerCount.low || 0) : r.workerCount) : (r.workerIds?.length || 1)}
      </span>
    )},
    { key: 'target', header: 'Target Asset', render: (r) => getTargetName(r.fieldId) },
    { key: 'task', header: 'Task' },
    { key: 'hours', header: 'Hours', render: (r) => r.hours > 0 ? `${r.hours} hrs` : '-' },
    { key: 'reviewStatus', header: 'Review Status', render: (r) => {
      const status = r.reviewStatus || 'Pending Review';
      let bg = '#fff3e0';
      let fg = '#e65100';
      if (status === 'Complete' || status === 'Satisfactory') {
        bg = '#e8f5e9';
        fg = '#2e7d32';
      } else if (status === 'Not Complete') {
        bg = '#ffebee';
        fg = '#c62828';
      }
      return (
        <span className="status-indicator" style={{ background: bg, color: fg, fontWeight: 'bold' }}>
          {status}
        </span>
      );
    }}
  ];

  const completedColumns = [
    { key: 'completedDate', header: 'Completed On' },
    { key: 'headcount', header: 'Headcount', render: (r) => (
      <span className="status-indicator" style={{ background: '#e3f2fd', color: '#1565c0' }}>
        {r.workerCount !== undefined ? (typeof r.workerCount === 'object' ? (r.workerCount.low || 0) : r.workerCount) : (r.workerIds?.length || 1)}
      </span>
    )},
    { key: 'target', header: 'Target Asset', render: (r) => getTargetName(r.fieldId) },
    { key: 'task', header: 'Task', render: (r) => <del>{r.task}</del> },
    { key: 'hours', header: 'Hours', render: (r) => r.hours > 0 ? `${r.hours} hrs` : '-' },
    { key: 'reviewStatus', header: 'Review Status', render: (r) => {
      const status = r.reviewStatus || 'Pending Review';
      let bg = '#fff3e0';
      let fg = '#e65100';
      if (status === 'Complete' || status === 'Satisfactory') {
        bg = '#e8f5e9';
        fg = '#2e7d32';
      } else if (status === 'Not Complete') {
        bg = '#ffebee';
        fg = '#c62828';
      }
      return (
        <span className="status-indicator" style={{ background: bg, color: fg, fontWeight: 'bold' }}>
          {status}
        </span>
      );
    }}
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
            Assignment Roster
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
            {editingId ? 'Edit Work Assignment' : 'New Work Assignment'}
          </button>
        </div>

        <div style={{ padding: '20px' }}>
          {activeTab === 'roster' ? (
            activeAssignments.length === 0 && completedAssignments.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--color-text-light)' }}>
                No work assignments found. Click on the <strong>New Work Assignment</strong> tab to create one.
              </div>
            ) : (
              <>
                {activeAssignments.length > 0 && (
                  <CrudTable activeRowId={editingId} 
                    data={activeAssignments}
                    columns={activeColumns}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    itemLabel="Assignment"
                    customTitle="Saved Assignments"
                    defaultSort={{ key: 'assignmentDate', direction: 'desc' }}
                  />
                )}
                {completedAssignments.length > 0 && (
                  <div style={{ marginTop: '30px', opacity: 0.85 }}>
                    <CrudTable activeRowId={editingId} 
                      data={completedAssignments}
                      columns={completedColumns}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      itemLabel="Assignment"
                      customTitle="Completed Assignments"
                      defaultSort={{ key: 'assignmentDate', direction: 'desc' }}
                    />
                  </div>
                )}
              </>
            )
          ) : (
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn" onClick={resetForm}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingId ? 'Update Assignment' : 'Assign Task'}
                </button>
              </div>
              <div className="form-grid">
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label>Target Asset (Where is this passing?) *</label>
                  <select value={fieldId} onChange={e => setFieldId(e.target.value)} required>
                    <option value="">Select Target...</option>
                    <optgroup label="Crops & Seedlings">
                      {[...crops].sort((a,b) => (a.name || '').localeCompare(b.name || '')).map(c => <option key={c.id} value={c.id}>{c.name || 'Unnamed'} ({c.variety || 'Unknown'})</option>)}
                    </optgroup>
                    <optgroup label="Physical Fields">
                      {[...fields].sort((a,b) => (a.name || '').localeCompare(b.name || '')).map(f => <option key={f.id} value={f.id}>{f.name || 'Unnamed'} ({f.area || 0} acres)</option>)}
                    </optgroup>
                    <optgroup label="Nursery Beds">
                      {[...nurseries].sort((a,b) => (a.name || '').localeCompare(b.name || '')).map(n => <option key={n.id} value={n.id}>{n.name || 'Unnamed'}</option>)}
                    </optgroup>
                  </select>
                </div>

                <div className="form-group" style={{ gridColumn: 'span 1' }}>
                  <label>Link to Planning Goal / Objective</label>
                  <select value={planningId} onChange={e => setPlanningId(e.target.value)}>
                    <option value="">No Planning Linked</option>
                    <optgroup label="Goals">
                      {planningGoals.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}
                    </optgroup>
                    <optgroup label="Objectives">
                      {planningObjectives.map(o => {
                        const parent = planningGoals.find(g => g.id === o.goalId);
                        return <option key={o.id} value={o.id}>{parent ? `${parent.title} - ` : ''}{o.title}</option>;
                      })}
                    </optgroup>
                  </select>
                </div>
                
                <div className="form-group" style={{ gridColumn: 'span 1' }}>
                  <label>Select Assigned Employees</label>
                  <div style={{ display: 'flex', gap: '10px', marginTop: '4px', marginBottom: '10px', flexWrap: 'wrap' }}>
                    <select value={filterJobTitle} onChange={e => setFilterJobTitle(e.target.value)} style={{ padding: '6px', borderRadius: '4px', border: '1px solid #ccc' }}>
                      <option value="">Any Job Title</option>
                      {uniqueJobTitles.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <select value={filterGender} onChange={e => setFilterGender(e.target.value)} style={{ padding: '6px', borderRadius: '4px', border: '1px solid #ccc' }}>
                      <option value="">Any Gender</option>
                      <option value="Female">Female</option>
                      <option value="Male">Male</option>
                    </select>
                    <button type="button" onClick={handleAddGroup} className="btn" style={{ padding: '6px 12px', background: '#e0e0e0', color: '#333' }}>+ Add Group</button>
                  </div>
                  <div style={{ marginTop: '4px' }}>
                    <Select
                      isMulti
                      options={employeeOptions}
                      value={activeSelectedOptions}
                      onChange={handleSelectChange}
                      placeholder="Search and tag employees..."
                      noOptionsMessage={() => "No matching HR records found"}
                      styles={{
                        control: (base) => ({ ...base, minHeight: '44px', borderRadius: '6px', borderColor: '#e0e0e0', fontSize: '0.95rem' }),
                        option: (base) => ({ ...base, fontSize: '0.9rem' }),
                        multiValue: (base) => ({ ...base, backgroundColor: '#e8f5e9', border: '1px solid #c8e6c9' }),
                        multiValueLabel: (base) => ({ ...base, color: '#2e7d32', fontWeight: 500 })
                      }}
                    />
                  </div>
                  {legacyWorkers && (
                    <div style={{ marginTop: '10px', fontSize: '0.85rem', color: '#666' }}>
                      <strong>Legacy Text mapping:</strong> {legacyWorkers}
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label>Calculated Number of Workers</label>
                  <input 
                    type="number" 
                    min="0"
                    value={workerCount} 
                    onChange={e => setWorkerCount(e.target.value)} 
                    placeholder={workerIds.length > 0 ? workerIds.length : 'Manually enter headcount'} 
                  />
                  <span style={{ fontSize: '0.8rem', color: '#666', marginTop: '4px', display: 'block' }}>Automatically updates based on checkbox mappings, but you can manually override here.</span>
                </div>

                <div className="form-group">
                  <label>Task Description *</label>
                  <input 
                    type="text" 
                    value={task} 
                    onChange={e => setTask(e.target.value)} 
                    placeholder="e.g. Manual weeding, Irrigation repair" 
                    required 
                  />
                </div>

                <div className="form-group">
                  <label>Est. Total Hours</label>
                  <input 
                    type="number" 
                    step="0.5"
                    min="0"
                    value={hours} 
                    onChange={e => setHours(e.target.value)} 
                    placeholder="Total man-hours" 
                  />
                </div>

                <div className="form-group">
                  <label>Assignment Date *</label>
                  <input 
                    type="date" 
                    value={assignmentDate} 
                    onChange={e => setAssignmentDate(e.target.value)} 
                    required 
                  />
                </div>

                <div className="form-group">
                  <label>Completion Date (Optional)</label>
                  <input 
                    type="date" 
                    value={completedDate} 
                    onChange={e => setCompletedDate(e.target.value)} 
                  />
                </div>

                <div className="form-group">
                  <label>Management Review Status</label>
                  <select value={reviewStatus} onChange={e => setReviewStatus(e.target.value)}>
                    <option value="Pending Review">Pending Review</option>
                    <option value="Complete">Complete</option>
                    <option value="Satisfactory">Satisfactory</option>
                    <option value="Not Complete">Not Complete</option>
                  </select>
                </div>
              </div>
              
            </form>
          )}
        </div>
      </div>

    </div>
  );
}

export default function AssignmentTab() {
  return (
    <ErrorBoundary>
      <AssignmentTabComponent />
    </ErrorBoundary>
  );
}
