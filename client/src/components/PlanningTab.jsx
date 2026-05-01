import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { saveGoal, removeGoal, saveObjective, removeObjective } from '../store/planningSlice';
import { queueAction } from '../store/syncSlice';
import CrudTable from './CrudTable';
import Select from 'react-select';
import { Target, X, PlusCircle } from 'lucide-react';

const INIT_GOAL = { title: '', fromDate: '', toDate: '', workerIds: [] };
const INIT_OBJECTIVE = { title: '', fromDate: '', toDate: '', workerIds: [], goalId: '' };

export default function PlanningTab() {
  const dispatch = useDispatch();
  const goals = useSelector(state => state.planning?.goals) || [];
  const objectives = useSelector(state => state.planning?.objectives) || [];
  const employeesList = useSelector(state => state.employees?.list) || [];

  const [activeView, setActiveView] = useState('goals'); // goals or objectives

  const [goalData, setGoalData] = useState(INIT_GOAL);
  const [editingGoalId, setEditingGoalId] = useState(null);

  const [objectiveData, setObjectiveData] = useState(INIT_OBJECTIVE);
  const [editingObjId, setEditingObjId] = useState(null);

  const employeeOptions = [...employeesList]
    .sort((a,b) => (a.lastName || '').localeCompare(b.lastName || ''))
    .map(emp => ({
      value: emp.id,
      label: `${emp.lastName}, ${emp.firstName} (${emp.jobTitle})`
    }));

  const handleGoalSubmit = (e) => {
    e.preventDefault();
    if (!goalData.title.trim()) return alert("Title is required.");

    const payload = {
      ...goalData,
      id: editingGoalId || `goal_${Date.now()}`
    };

    dispatch(saveGoal(payload));
    dispatch(queueAction({ type: 'planning/saveGoal', payload, meta: { id: Date.now() } }));

    setGoalData(INIT_GOAL);
    setEditingGoalId(null);
  };

  const handleObjectiveSubmit = (e) => {
    e.preventDefault();
    if (!objectiveData.title.trim() || !objectiveData.goalId) return alert("Title and Goal selection are required.");

    const payload = {
      ...objectiveData,
      id: editingObjId || `obj_${Date.now()}`
    };

    dispatch(saveObjective(payload));
    dispatch(queueAction({ type: 'planning/saveObjective', payload, meta: { id: Date.now() } }));

    setObjectiveData(INIT_OBJECTIVE);
    setEditingObjId(null);
  };

  const handleDeleteGoal = (id) => {
    if (window.confirm("Delete this Goal and all its associated Objectives?")) {
      dispatch(removeGoal(id));
      dispatch(queueAction({ type: 'core/deleteNode', payload: { id }, meta: { id: Date.now() } }));
      if (editingGoalId === id) {
        setGoalData(INIT_GOAL);
        setEditingGoalId(null);
      }
    }
  };

  const handleDeleteObjective = (id) => {
    if (window.confirm("Delete this Objective?")) {
      dispatch(removeObjective(id));
      dispatch(queueAction({ type: 'core/deleteNode', payload: { id }, meta: { id: Date.now() } }));
      if (editingObjId === id) {
        setObjectiveData(INIT_OBJECTIVE);
        setEditingObjId(null);
      }
    }
  };

  const renderWorkerNames = (workerIds) => {
    if (!workerIds || workerIds.length === 0) return 'None';
    const names = workerIds.map(id => {
      const emp = employeesList.find(e => e.id === id);
      return emp ? `${emp.firstName} ${emp.lastName}` : 'Unknown';
    });
    return names.join(', ');
  };

  const goalColumns = [
    { key: 'title', header: 'Goal Title' },
    { key: 'fromDate', header: 'From Date' },
    { key: 'toDate', header: 'To Date' },
    { key: 'workerIds', header: 'Responsible', render: (r) => renderWorkerNames(r.workerIds) }
  ];

  const objColumns = [
    { key: 'title', header: 'Objective Title' },
    { key: 'goalId', header: 'Parent Goal', render: (r) => goals.find(g => g.id === r.goalId)?.title || 'Unknown Goal' },
    { key: 'fromDate', header: 'From Date' },
    { key: 'toDate', header: 'To Date' },
    { key: 'workerIds', header: 'Responsible', render: (r) => renderWorkerNames(r.workerIds) }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      <div style={{ display: 'flex', gap: '10px' }}>
        <button onClick={() => setActiveView('goals')} className={`btn ${activeView === 'goals' ? 'btn-primary' : ''}`} style={{ background: activeView !== 'goals' ? '#f0f0f0' : '#1565c0', color: activeView !== 'goals' ? '#333' : 'white', flex: 1 }}>Goals</button>
        <button onClick={() => setActiveView('objectives')} className={`btn ${activeView === 'objectives' ? 'btn-primary' : ''}`} style={{ background: activeView !== 'objectives' ? '#f0f0f0' : '#1565c0', color: activeView !== 'objectives' ? '#333' : 'white', flex: 1 }}>Objectives</button>
      </div>

      {activeView === 'goals' && (
        <>
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2>{editingGoalId ? 'Edit Goal' : 'New Goal'}</h2>
              {editingGoalId && (
                <button onClick={() => { setEditingGoalId(null); setGoalData(INIT_GOAL); }} className="btn" style={{ background: '#f5f5f5', color: '#333' }}>
                  <X size={14} style={{ marginRight: 4 }} /> Cancel Edit
                </button>
              )}
            </div>
            <form onSubmit={handleGoalSubmit}>
              <div className="form-grid">
                <div className="form-group form-grid-full">
                  <label>Goal Title</label>
                  <input type="text" value={goalData.title} onChange={e => setGoalData({ ...goalData, title: e.target.value })} placeholder="e.g. Increase tomato yield by 20%" required />
                </div>
                <div className="form-group">
                  <label>From Date</label>
                  <input type="date" value={goalData.fromDate} onChange={e => setGoalData({ ...goalData, fromDate: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>To Date</label>
                  <input type="date" value={goalData.toDate} onChange={e => setGoalData({ ...goalData, toDate: e.target.value })} />
                </div>
                <div className="form-group form-grid-full">
                  <label>Responsible Employees</label>
                  <Select
                    isMulti
                    options={employeeOptions}
                    value={employeeOptions.filter(opt => goalData.workerIds.includes(opt.value))}
                    onChange={(opts) => setGoalData({ ...goalData, workerIds: opts ? opts.map(o => o.value) : [] })}
                    placeholder="Search employees..."
                  />
                </div>
              </div>
              <button type="submit" className="btn btn-primary" style={{ marginTop: 10 }}>
                <Target size={16} style={{ marginRight: 6 }} /> {editingGoalId ? 'Update Goal' : 'Save Goal'}
              </button>
            </form>
          </div>
          <div className="card">
            <CrudTable 
              data={goals}
              columns={goalColumns}
              onEdit={(r) => { setGoalData(r); setEditingGoalId(r.id); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              onDelete={handleDeleteGoal}
              itemLabel="Goal"
              defaultSort={{ key: 'title', direction: 'asc' }}
            />
          </div>
        </>
      )}

      {activeView === 'objectives' && (
        <>
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2>{editingObjId ? 'Edit Objective' : 'New Objective'}</h2>
              {editingObjId && (
                <button onClick={() => { setEditingObjId(null); setObjectiveData(INIT_OBJECTIVE); }} className="btn" style={{ background: '#f5f5f5', color: '#333' }}>
                  <X size={14} style={{ marginRight: 4 }} /> Cancel Edit
                </button>
              )}
            </div>
            <form onSubmit={handleObjectiveSubmit}>
              <div className="form-grid">
                <div className="form-group form-grid-full">
                  <label>Parent Goal</label>
                  <select value={objectiveData.goalId} onChange={e => setObjectiveData({ ...objectiveData, goalId: e.target.value })} required>
                    <option value="">Select a Goal...</option>
                    {goals.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}
                  </select>
                </div>
                <div className="form-group form-grid-full">
                  <label>Objective Title</label>
                  <input type="text" value={objectiveData.title} onChange={e => setObjectiveData({ ...objectiveData, title: e.target.value })} placeholder="e.g. Test new fertilizer composition" required />
                </div>
                <div className="form-group">
                  <label>From Date</label>
                  <input type="date" value={objectiveData.fromDate} onChange={e => setObjectiveData({ ...objectiveData, fromDate: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>To Date</label>
                  <input type="date" value={objectiveData.toDate} onChange={e => setObjectiveData({ ...objectiveData, toDate: e.target.value })} />
                </div>
                <div className="form-group form-grid-full">
                  <label>Responsible Employees</label>
                  <Select
                    isMulti
                    options={employeeOptions}
                    value={employeeOptions.filter(opt => objectiveData.workerIds.includes(opt.value))}
                    onChange={(opts) => setObjectiveData({ ...objectiveData, workerIds: opts ? opts.map(o => o.value) : [] })}
                    placeholder="Search employees..."
                  />
                </div>
              </div>
              <button type="submit" className="btn btn-primary" style={{ marginTop: 10 }}>
                <PlusCircle size={16} style={{ marginRight: 6 }} /> {editingObjId ? 'Update Objective' : 'Save Objective'}
              </button>
            </form>
          </div>
          <div className="card">
            <CrudTable 
              data={objectives}
              columns={objColumns}
              onEdit={(r) => { setObjectiveData(r); setEditingObjId(r.id); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              onDelete={handleDeleteObjective}
              itemLabel="Objective"
              defaultSort={{ key: 'title', direction: 'asc' }}
            />
          </div>
        </>
      )}

    </div>
  );
}
