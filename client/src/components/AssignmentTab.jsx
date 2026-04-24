import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Select from 'react-select';
import { saveAssignment, removeAssignment } from '../store/assignmentSlice';
import { Edit2, Trash2 } from 'lucide-react';

export default function AssignmentTab() {
  const dispatch = useDispatch();
  const assignments = useSelector(state => state.assignments?.list) || [];
  const fields = useSelector(state => state.fields?.data) || [];
  const employeesList = useSelector(state => state.employees?.list) || [];
  const nurseries = useSelector(state => state.nurseries?.beds) || [];
  const crops = useSelector(state => state.assets?.crops) || [];

  const [editingId, setEditingId] = useState(null);
  const [fieldId, setFieldId] = useState('');
  
  // New Relational Data Pointers
  const [workerIds, setWorkerIds] = useState([]);
  const [workerCount, setWorkerCount] = useState('');
  const [legacyWorkers, setLegacyWorkers] = useState(''); 

  const [hours, setHours] = useState('');
  const [task, setTask] = useState('');
  const [assignmentDate, setAssignmentDate] = useState(new Date().toISOString().split('T')[0]);
  const [completedDate, setCompletedDate] = useState('');

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
  };

  const handleEdit = (assignment) => {
    setEditingId(assignment.id);
    setFieldId(assignment.fieldId || '');
    setWorkerIds(assignment.workerIds || []);
    setWorkerCount(assignment.workerCount !== undefined ? assignment.workerCount : '');
    setLegacyWorkers(assignment.workers || ''); // Fallback for assignments formulated prior to EmployeeTab
    setHours(assignment.hours || '');
    setTask(assignment.task || '');
    setAssignmentDate(assignment.assignmentDate || '');
    setCompletedDate(assignment.completedDate || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectChange = (selectedOptions) => {
    const newIds = selectedOptions ? selectedOptions.map(opt => opt.value) : [];
    setWorkerIds(newIds);
    setWorkerCount(newIds.length); // Dynamic mathematics override
  };

  const employeeOptions = [...employeesList]
    .sort((a,b) => (a.lastName || '').localeCompare(b.lastName || ''))
    .map(emp => ({
      value: emp.id,
      label: `${emp.lastName}, ${emp.firstName} (${emp.jobTitle})`
    }));

  const activeSelectedOptions = employeeOptions.filter(opt => workerIds.includes(opt.value));

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
      completedDate
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

  const activeAssignments = assignments.filter(a => !a.completedDate);
  const completedAssignments = assignments.filter(a => a.completedDate);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="card">
        <h2>{editingId ? 'Edit Work Assignment' : 'New Work Assignment'}</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label>Target Asset (Where is this passing?) *</label>
              <select value={fieldId} onChange={e => setFieldId(e.target.value)} required>
                <option value="">Select Target...</option>
                <optgroup label="Crops & Seedlings">
                  {crops.map(c => <option key={c.id} value={c.id}>{c.name} ({c.variety})</option>)}
                </optgroup>
                <optgroup label="Physical Fields">
                  {fields.map(f => <option key={f.id} value={f.id}>{f.name} ({f.size} acres)</option>)}
                </optgroup>
                <optgroup label="Nursery Beds">
                  {nurseries.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
                </optgroup>
              </select>
            </div>
            
            <div className="form-group" style={{ gridColumn: 'span 1' }}>
              <label>Select Assigned Employees</label>
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
          </div>
          
          <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
            <button type="submit" className="btn btn-primary">
              {editingId ? 'Update Assignment' : 'Assign Task'}
            </button>
            {editingId && (
              <button type="button" className="btn" onClick={resetForm}>
                Cancel Route
              </button>
            )}
          </div>
        </form>
      </div>

      {activeAssignments.length > 0 && (
        <div className="card">
          <h2>Saved Assignments</h2>
          <div style={{ overflowX: 'auto' }}>
            <table className="crud-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Headcount</th>
                  <th>Target Asset</th>
                  <th>Task</th>
                  <th>Hours</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {[...activeAssignments].sort((a,b) => (b.assignmentDate || '').localeCompare(a.assignmentDate || '')).map(a => (
                  <tr key={a.id}>
                    <td>{a.assignmentDate}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span className="status-indicator" style={{ background: '#e3f2fd', color: '#1565c0' }}>
                        {a.workerCount !== undefined ? a.workerCount : (a.workerIds?.length || 1)}
                      </span>
                    </td>
                    <td>{getTargetName(a.fieldId)}</td>
                    <td>{a.task}</td>
                    <td>{a.hours > 0 ? `${a.hours} hrs` : '-'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button 
                          title="Edit Assignment"
                          style={{ padding: '6px', background: '#e3f2fd', color: '#1565c0', border: 'none', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} 
                          onClick={() => handleEdit(a)}>
                          <Edit2 size={16} />
                        </button>
                        <button 
                          title="Delete Assignment"
                          style={{ padding: '6px', background: '#ffebee', color: '#c62828', border: 'none', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} 
                          onClick={() => handleDelete(a.id)}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {completedAssignments.length > 0 && (
        <div className="card" style={{ opacity: 0.85 }}>
          <h2>Completed Assignments</h2>
          <div style={{ overflowX: 'auto' }}>
            <table className="crud-table">
              <thead>
                <tr>
                  <th>Completed On</th>
                  <th>Headcount</th>
                  <th>Target Asset</th>
                  <th>Task</th>
                  <th>Hours</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {[...completedAssignments].sort((a,b) => (b.completedDate || '').localeCompare(a.completedDate || '')).map(a => (
                  <tr key={a.id}>
                    <td>{a.completedDate}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span className="status-indicator" style={{ background: '#e3f2fd', color: '#1565c0' }}>
                        {a.workerCount !== undefined ? a.workerCount : (a.workerIds?.length || 1)}
                      </span>
                    </td>
                    <td>{getTargetName(a.fieldId)}</td>
                    <td><del>{a.task}</del></td>
                    <td>{a.hours > 0 ? `${a.hours} hrs` : '-'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button 
                          title="Edit Assignment"
                          style={{ padding: '6px', background: '#e3f2fd', color: '#1565c0', border: 'none', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} 
                          onClick={() => handleEdit(a)}>
                          <Edit2 size={16} />
                        </button>
                        <button 
                          title="Delete Assignment"
                          style={{ padding: '6px', background: '#ffebee', color: '#c62828', border: 'none', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} 
                          onClick={() => handleDelete(a.id)}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}
