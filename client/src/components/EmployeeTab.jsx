import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { saveEmployee, removeEmployee } from '../store/employeeSlice';
import CrudTable from './CrudTable';

export default function EmployeeTab() {
  const dispatch = useDispatch();
  const employees = useSelector(state => state.employees?.list) || [];
  const jobTitles = [...(useSelector(state => state.settings?.jobTitles) || ['Foreman', 'Harvester', 'Tractor Operator', 'Security', 'Manager'])].sort((a, b) => a.localeCompare(b));

  const [editingId, setEditingId] = useState(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [gender, setGender] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [type, setType] = useState('Permanent');
  const [dailyRateLD, setDailyRateLD] = useState('');
  const [twoWeekPayUSD, setTwoWeekPayUSD] = useState('');

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
    setGender('');
    setAddress('');
    setPhone('');
    setJobTitle('');
    setType('Permanent');
    setDailyRateLD('');
    setTwoWeekPayUSD('');
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
    setGender(emp.gender || '');
    setAddress(emp.address || '');
    setPhone(emp.phone || '');
    setJobTitle(emp.jobTitle || '');
    setType(emp.type || 'Permanent');
    setDailyRateLD(emp.dailyRateLD || '');
    setTwoWeekPayUSD(emp.twoWeekPayUSD || '');
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
      gender,
      address,
      phone,
      jobTitle,
      type,
      dailyRateLD: type === 'Daily' ? (parseFloat(dailyRateLD) || 0) : 0,
      twoWeekPayUSD: type !== 'Daily' ? (parseFloat(twoWeekPayUSD) || 0) : 0,
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

  const employeeColumns = [
    { key: 'name', header: 'Name', render: (r) => <span style={{ fontWeight: 600 }}>{r.lastName}, {r.firstName}</span> },
    { key: 'jobTitle', header: 'Job Title' },
    { key: 'status', header: 'Status', render: (r) => r.isTerminated ? (
      <div style={{ color: '#c62828', fontWeight: 500, fontSize: '0.85rem' }}>
        Terminated
        <div style={{ fontSize: '0.75rem', fontWeight: 400, marginTop: '2px' }}>{r.terminationReason}</div>
      </div>
    ) : (
      <span style={{ color: '#2e7d32', fontWeight: 500, fontSize: '0.85rem' }}>Active</span>
    )}
  ];

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
              <label>Gender</label>
              <div style={{ display: 'flex', gap: '15px', marginTop: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                  <input type="radio" name="gender" value="Male" checked={gender === 'Male'} onChange={e => setGender(e.target.value)} />
                  Male
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                  <input type="radio" name="gender" value="Female" checked={gender === 'Female'} onChange={e => setGender(e.target.value)} />
                  Female
                </label>
              </div>
            </div>

            <div className="form-group">
              <label>Job Title *</label>
              <select value={jobTitle} onChange={e => setJobTitle(e.target.value)} required>
                <option value="" disabled>Select Job Title</option>
                {jobTitles.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label>Employee Skills</label>
              <input type="text" value={skills} onChange={e => setSkills(e.target.value)} placeholder="e.g. Tractor Ops, Electrician, Certified Applicator" />
              <span style={{ fontSize: '0.8rem', color: '#666', marginTop: '4px', display: 'block' }}>Comma separate multiple skills.</span>
            </div>

            <div className="form-group">
              <label>Employment Type *</label>
              <select value={type} onChange={e => setType(e.target.value)} required>
                <option value="Contract">Contract</option>
                <option value="Daily">Daily Farm Worker</option>
                <option value="Permanent">Permanent</option>
              </select>
            </div>

            {type === 'Daily' ? (
              <div className="form-group">
                <label>Daily Farm Worker Pay Rate (LD)</label>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span style={{ padding: '8px', background: '#e0e0e0', border: '1px solid #ccc', borderRight: 'none', borderRadius: '4px 0 0 4px' }}>L$</span>
                  <input type="number" step="0.01" value={dailyRateLD} onChange={e => setDailyRateLD(e.target.value)} style={{ borderRadius: '0 4px 4px 0' }} placeholder="0.00" />
                </div>
              </div>
            ) : (
              <div className="form-group">
                <label>2-Week Salary (USD)</label>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span style={{ padding: '8px', background: '#e0e0e0', border: '1px solid #ccc', borderRight: 'none', borderRadius: '4px 0 0 4px' }}>$</span>
                  <input type="number" step="0.01" value={twoWeekPayUSD} onChange={e => setTwoWeekPayUSD(e.target.value)} style={{ borderRadius: '0 4px 4px 0' }} placeholder="0.00" />
                </div>
              </div>
            )}

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
              <span style={{ fontSize: '0.8rem', color: '#666', marginTop: '4px', display: 'block' }}>Usually applicable for Contract or Daily Farm Worker labor.</span>
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
              {editingId ? 'Save' : 'Register Employee'}
            </button>
            {editingId && (
              <button type="button" className="btn" onClick={resetForm}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="card">
        <CrudTable 
          data={[...filteredEmployees].sort((a, b) => (a.lastName || '').localeCompare(b.lastName || ''))}
          columns={employeeColumns}
          onEdit={handleEdit}
          onDelete={handleDelete}
          itemLabel="Employee"
          customTitle={
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
              <span>Employee Roster ({filteredEmployees.length})</span>
              <label style={{
                display: 'flex', alignItems: 'center',
                cursor: 'pointer', background: '#f5f5f5',
                padding: '4px 8px', borderRadius: '4px',
                fontWeight: 600, fontSize: '0.85rem',
                border: '1px solid var(--color-border)',
                color: '#333'
              }}>
                <input
                  type="checkbox"
                  checked={filterActive}
                  onChange={e => setFilterActive(e.target.checked)}
                  style={{ width: 16, height: 16, marginRight: '8px', cursor: 'pointer' }}
                />
                Show Active Only
              </label>
            </div>
          }
          rowStyle={(row) => ({ opacity: row.isTerminated ? 0.6 : 1 })}
        />
      </div>

    </div>
  );
}
