import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { saveEmployee, removeEmployee } from '../store/employeeSlice';

export default function EmployeeTab() {
  const dispatch = useDispatch();
  const employees = useSelector(state => state.employees?.list) || [];

  const [editingId, setEditingId] = useState(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [type, setType] = useState('Permanent');
  
  // Advanced HR Fields
  const [skills, setSkills] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isTerminated, setIsTerminated] = useState(false);
  const [terminationReason, setTerminationReason] = useState('');

  // UI Filtering State
  const [filterActive, setFilterActive] = useState(false);

  const resetForm = () => {
    setEditingId(null);
    setFirstName('');
    setLastName('');
    setAddress('');
    setPhone('');
    setJobTitle('');
    setType('Permanent');
    setSkills('');
    setStartDate('');
    setEndDate('');
    setIsTerminated(false);
    setTerminationReason('');
  };

  const handleEdit = (emp) => {
    setEditingId(emp.id);
    setFirstName(emp.firstName || '');
    setLastName(emp.lastName || '');
    setAddress(emp.address || '');
    setPhone(emp.phone || '');
    setJobTitle(emp.jobTitle || '');
    setType(emp.type || 'Permanent');
    setSkills(emp.skills || '');
    setStartDate(emp.startDate || '');
    setEndDate(emp.endDate || '');
    setIsTerminated(emp.isTerminated || false);
    setTerminationReason(emp.terminationReason || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!firstName || !lastName || !jobTitle) {
      alert("First Name, Last Name, and Job Title are required.");
      return;
    }

    const payload = {
      id: editingId || `emp_${Date.now()}`,
      firstName,
      lastName,
      address,
      phone,
      jobTitle,
      type,
      skills,
      startDate,
      endDate,
      isTerminated,
      terminationReason: isTerminated ? terminationReason : '' // clear reason if not terminated
    };

    dispatch(saveEmployee(payload));
    resetForm();
  };

  const handleDelete = (id) => {
    if (window.confirm("Permanently delete this employee profile?")) {
      dispatch(removeEmployee(id));
      if (editingId === id) resetForm();
    }
  };

  // Derive final filtered list immediately before rendering
  const filteredEmployees = filterActive 
    ? employees.filter(emp => !emp.isTerminated) 
    : employees;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      <div className="card">
        <h2>{editingId ? 'Edit Employee Profile' : 'New Employee Entry'}</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="form-group">
              <label>First Name *</label>
              <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} required />
            </div>
            
            <div className="form-group">
              <label>Last Name *</label>
              <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} required />
            </div>

            <div className="form-group">
              <label>Job Title *</label>
              <input type="text" value={jobTitle} onChange={e => setJobTitle(e.target.value)} placeholder="e.g. Harvester, Foreman" required />
            </div>

            <div className="form-group">
              <label>Employee Skills</label>
              <input type="text" value={skills} onChange={e => setSkills(e.target.value)} placeholder="e.g. Tractor Ops, Electrician, Certified Applicator" />
              <span style={{ fontSize: '0.8rem', color: '#666', marginTop: '4px', display: 'block' }}>Comma separate multiple skills.</span>
            </div>

            <div className="form-group">
              <label>Employment Type *</label>
              <select value={type} onChange={e => setType(e.target.value)} required>
                <option value="Permanent">Permanent</option>
                <option value="Daily">Daily</option>
                <option value="Contract">Contract</option>
              </select>
            </div>

            <div className="form-group">
              <label>Phone Number</label>
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="(xxx) xxx-xxxx" />
            </div>

            <div className="form-group">
              <label>Hire / Start Date</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>

            <div className="form-group">
              <label>Expected End Date</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
              <span style={{ fontSize: '0.8rem', color: '#666', marginTop: '4px', display: 'block' }}>Usually applicable for Contract or Daily labor.</span>
            </div>

            {/* Termination field moved up alongside the date grids */}
            <div className="form-group" style={{ background: isTerminated ? '#ffebee' : '#f5f5f5', padding: '16px', borderRadius: '6px', border: '1px solid', borderColor: isTerminated ? '#ffcdd2' : '#e0e0e0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ color: isTerminated ? '#c62828' : '#333', fontWeight: 'bold' }}>Termination Status</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button type="button" className="btn" style={{ background: isTerminated ? '#c62828' : '#e0e0e0', color: isTerminated ? 'white' : '#333', fontWeight: 500 }} onClick={() => setIsTerminated(!isTerminated)}>
                  {isTerminated ? 'Status: Terminated (Click to Revoke)' : 'Mark as Terminated'}
                </button>
              </div>
              {isTerminated && (
                <div style={{ marginTop: '8px' }}>
                  <label style={{ fontSize: '0.85rem', color: '#c62828', marginBottom: '4px', display: 'block' }}>Reason for Termination</label>
                  <input type="text" value={terminationReason} onChange={e => setTerminationReason(e.target.value)} placeholder="e.g. End of seasonal contract, Resigned, Terminated for cause..." required={isTerminated} style={{ borderColor: '#ffcdd2' }} />
                </div>
              )}
            </div>

            <div className="form-group" style={{ gridColumn: 'span 1' }}>
              {/* Flex spacer block if needed or can just sit empty to align the bottom row */}
            </div>

            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label>Home Address</label>
              <input type="text" value={address} onChange={e => setAddress(e.target.value)} placeholder="123 Farm Rd..." />
            </div>

          </div>
          
          <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
            <button type="submit" className="btn btn-primary">
              {editingId ? 'Save Configuration' : 'Register Employee'}
            </button>
            {editingId && (
              <button type="button" className="btn" onClick={resetForm}>
                Cancel Route
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '15px' }}>
          <h2 style={{ margin: 0 }}>Employee Roster ({filteredEmployees.length})</h2>
          <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.95rem', cursor: 'pointer', background: '#f5f5f5', padding: '6px 12px', borderRadius: '4px', border: '1px solid var(--color-border)' }}>
            <input 
              type="checkbox" 
              checked={filterActive} 
              onChange={e => setFilterActive(e.target.checked)} 
              style={{ marginRight: '8px', cursor: 'pointer' }}
            />
            Show Active Only
          </label>
        </div>
        
        <div style={{ overflowX: 'auto' }}>
          <table className="crud-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Job Title</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', padding: '20px', color: '#888' }}>No employees found matching criteria.</td>
                </tr>
              ) : (
                [...filteredEmployees].sort((a,b) => (a.lastName || '').localeCompare(b.lastName || '')).map(emp => (
                  <tr key={emp.id} style={{ opacity: emp.isTerminated ? 0.6 : 1 }}>
                    <td style={{ fontWeight: 600 }}>{emp.lastName}, {emp.firstName}</td>
                    <td>{emp.jobTitle}</td>
                    <td>
                      {emp.isTerminated ? (
                        <div style={{ color: '#c62828', fontWeight: 500, fontSize: '0.85rem' }}>
                          Terminated
                          <div style={{ fontSize: '0.75rem', fontWeight: 400, marginTop: '2px' }}>{emp.terminationReason}</div>
                        </div>
                      ) : (
                        <span style={{ color: '#2e7d32', fontWeight: 500, fontSize: '0.85rem' }}>Active</span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn" style={{ padding: '4px 8px', fontSize: '0.8rem' }} onClick={() => handleEdit(emp)}>Edit</button>
                        <button className="btn" style={{ padding: '4px 8px', fontSize: '0.8rem', background: '#ffebee', color: '#c62828' }} onClick={() => handleDelete(emp.id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
