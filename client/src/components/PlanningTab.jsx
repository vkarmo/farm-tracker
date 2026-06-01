import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { saveGoal, removeGoal, saveObjective, removeObjective } from '../store/planningSlice';
import { queueAction } from '../store/syncSlice';
import CrudTable from './CrudTable';
import Select from 'react-select';
import { Target, X, PlusCircle, ChevronRight, ChevronDown, List, ClipboardList, Edit } from 'lucide-react';


const INIT_GOAL = { title: '', fromDate: '', toDate: '', workerIds: [], parentGoalId: '', estimatedHours: '', actualHours: '', startDate: '', completionDate: '' };
const INIT_OBJECTIVE = { title: '', fromDate: '', toDate: '', workerIds: [], goalId: '', estimatedHours: '', actualHours: '', startDate: '', completionDate: '' };

const TreeNode = ({ label, children, icon: Icon, defaultExpanded = true, onEdit, isSelected, onSelect }) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const hasChildren = React.Children.count(children) > 0;

  return (
    <div style={{ marginLeft: '20px', marginTop: '6px' }}>
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '6px 8px', borderRadius: '4px',
          background: isSelected ? '#fff9c4' : (expanded ? '#f5f5f5' : 'transparent'),
          border: '1px solid',
          borderColor: isSelected ? '#fbc02d' : (expanded ? '#e0e0e0' : 'transparent'),
          color: '#333'
        }}
      >
        <div
          style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', flex: 1 }}
          onClick={() => {
            if (hasChildren) setExpanded(!expanded);
            if (onSelect) onSelect();
          }}
        >
          <span style={{ width: '20px', display: 'inline-block' }}>
            {hasChildren ? (expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : null}
          </span>
          {Icon && <Icon size={14} style={{ marginRight: '6px', color: '#558b2f' }} />}
          <span style={{ fontWeight: hasChildren ? '500' : 'normal' }}>{label}</span>
        </div>
        {onEdit && (
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}
            title="Edit"
          >
            <Edit size={14} color="#666" />
          </button>
        )}
      </div>
      {expanded && hasChildren && (
        <div style={{ borderLeft: '1px solid #ddd', marginLeft: '10px', paddingLeft: '4px' }}>
          {children}
        </div>
      )}
    </div>
  );
};

export default function PlanningTab() {
  const dispatch = useDispatch();
  const goals = useSelector(state => state.planning?.goals) || [];
  const objectives = useSelector(state => state.planning?.objectives) || [];
  const employeesList = useSelector(state => state.employees?.list) || [];
  const assignments = useSelector(state => state.assignments?.list) || [];

  const [activeView, setActiveView] = useState('goals'); // goals or objectives

  const [goalData, setGoalData] = useState(INIT_GOAL);
  const [editingGoalId, setEditingGoalId] = useState(null);

  const [objectiveData, setObjectiveData] = useState(INIT_OBJECTIVE);
  const [editingObjId, setEditingObjId] = useState(null);

  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [activeTab, setActiveTab] = useState('roster');

  const resetForm = () => {
    setGoalData(INIT_GOAL);
    setEditingGoalId(null);
    setObjectiveData(INIT_OBJECTIVE);
    setEditingObjId(null);
    setActiveTab('roster');
  };

  const employeeOptions = [...employeesList]
    .sort((a, b) => (a.lastName || '').localeCompare(b.lastName || ''))
    .map(emp => ({
      value: emp.id,
      label: `${emp.lastName}, ${emp.firstName} (${emp.jobTitle})`
    }));

  const handleGoalSubmit = (e) => {
    e.preventDefault();
    if (!goalData.title.trim()) return alert("Title is required.");
    if (goalData.parentGoalId === editingGoalId) return alert("A goal cannot be its own parent.");

    const payload = {
      ...goalData,
      id: editingGoalId || `goal_${Date.now()}`
    };

    dispatch(saveGoal(payload));
    dispatch(queueAction({ type: 'planning/saveGoal', payload, meta: { id: Date.now() } }));

    resetForm();
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

    resetForm();
  };

  const handleDeleteGoal = (id) => {
    if (window.confirm("Delete this Goal and all its associated Objectives?")) {
      dispatch(removeGoal(id));
      dispatch(queueAction({ type: 'core/deleteNode', payload: { id }, meta: { id: Date.now() } }));
      if (editingGoalId === id) {
        resetForm();
      }
    }
  };

  const handleDeleteObjective = (id) => {
    if (window.confirm("Delete this Objective?")) {
      dispatch(removeObjective(id));
      dispatch(queueAction({ type: 'core/deleteNode', payload: { id }, meta: { id: Date.now() } }));
      if (editingObjId === id) {
        resetForm();
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

  const renderGoalsTree = (parentId) => {
    const childrenGoals = goals.filter(g => (g.parentGoalId || '') === parentId);
    return childrenGoals.map(goal => (
      <TreeNode
        key={goal.id}
        label={goal.title}
        icon={Target}
        isSelected={selectedNodeId === goal.id}
        onSelect={() => setSelectedNodeId(goal.id)}
        onEdit={() => {
          setActiveView('goals');
          setGoalData(goal);
          setEditingGoalId(goal.id);
          setSelectedNodeId(goal.id);
          setActiveTab('entry');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      >
        {renderGoalsTree(goal.id)}

        {objectives.filter(o => o.goalId === goal.id).map(obj => (
          <TreeNode
            key={obj.id}
            label={obj.title}
            icon={ClipboardList}
            isSelected={selectedNodeId === obj.id}
            onSelect={() => setSelectedNodeId(obj.id)}
            onEdit={() => {
              setActiveView('objectives');
              setObjectiveData(obj);
              setEditingObjId(obj.id);
              setSelectedNodeId(obj.id);
              setActiveTab('entry');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          >
            {assignments.filter(a => a.planningId === obj.id).sort((a, b) => (b.assignmentDate || '').localeCompare(a.assignmentDate || '')).map(ass => (
              <TreeNode
                key={ass.id}
                label={`${ass.task} (Assigned: ${ass.workers || renderWorkerNames(ass.workerIds)})`}
                icon={List}
                isSelected={selectedNodeId === ass.id}
                onSelect={() => setSelectedNodeId(ass.id)}
              />
            ))}
          </TreeNode>
        ))}
      </TreeNode>
    ));
  };

  const renderObjectivesTree = () => {
    return objectives.map(obj => (
      <TreeNode
        key={obj.id}
        label={obj.title}
        icon={ClipboardList}
        isSelected={selectedNodeId === obj.id}
        onSelect={() => setSelectedNodeId(obj.id)}
        onEdit={() => {
          setActiveView('objectives');
          setObjectiveData(obj);
          setEditingObjId(obj.id);
          setSelectedNodeId(obj.id);
          setActiveTab('entry');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      >
        {assignments.filter(a => a.planningId === obj.id).sort((a, b) => (b.assignmentDate || '').localeCompare(a.assignmentDate || '')).map(ass => (
          <TreeNode
            key={ass.id}
            label={`${ass.task} (Assigned: ${ass.workers || renderWorkerNames(ass.workerIds)})`}
            icon={List}
            isSelected={selectedNodeId === ass.id}
            onSelect={() => setSelectedNodeId(ass.id)}
          />
        ))}
      </TreeNode>
    ));
  };



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
            Planning (Goals & Objectives)
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
            {editingGoalId || editingObjId ? 'Edit Plan Entry' : 'New Plan Entry'}
          </button>
        </div>

        <div style={{ padding: '20px' }}>
          {activeTab === 'roster' ? (
            <>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', justifyContent: 'center' }}>
                <button
                  type="button"
                  onClick={() => setActiveView('goals')}
                  className={`btn ${activeView === 'goals' ? 'btn-primary' : ''}`}
                  style={{
                    borderRadius: '20px',
                    padding: '8px 20px',
                    background: activeView === 'goals' ? '#2e7d32' : '#f0f0f0',
                    color: activeView === 'goals' ? 'white' : '#333',
                    border: 'none',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Active Goals
                </button>
                <button
                  type="button"
                  onClick={() => setActiveView('objectives')}
                  className={`btn ${activeView === 'objectives' ? 'btn-primary' : ''}`}
                  style={{
                    borderRadius: '20px',
                    padding: '8px 20px',
                    background: activeView === 'objectives' ? '#2e7d32' : '#f0f0f0',
                    color: activeView === 'objectives' ? 'white' : '#333',
                    border: 'none',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Active Objectives
                </button>
              </div>

              {activeView === 'goals' ? (
                <div style={{ padding: '15px', background: '#fafafa', borderRadius: '8px', border: '1px solid #eee' }}>
                  {goals.filter(g => !g.parentGoalId).length === 0 ? (
                    <p style={{ color: '#888', fontStyle: 'italic' }}>No goals have been created yet.</p>
                  ) : (
                    renderGoalsTree('')
                  )}
                </div>
              ) : (
                <div style={{ padding: '15px', background: '#fafafa', borderRadius: '8px', border: '1px solid #eee' }}>
                  {objectives.length === 0 ? (
                    <p style={{ color: '#888', fontStyle: 'italic' }}>No objectives have been created yet.</p>
                  ) : (
                    renderObjectivesTree()
                  )}
                </div>
              )}
            </>
          ) : (
            <>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', justifyContent: 'center' }}>
                <button
                  type="button"
                  onClick={() => { setActiveView('goals'); setGoalData(INIT_GOAL); setEditingGoalId(null); setObjectiveData(INIT_OBJECTIVE); setEditingObjId(null); }}
                  className={`btn ${activeView === 'goals' ? 'btn-primary' : ''}`}
                  style={{
                    borderRadius: '20px',
                    padding: '8px 20px',
                    background: activeView === 'goals' ? '#2e7d32' : '#f0f0f0',
                    color: activeView === 'goals' ? 'white' : '#333',
                    border: 'none',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Goal Entry Form
                </button>
                <button
                  type="button"
                  onClick={() => { setActiveView('objectives'); setGoalData(INIT_GOAL); setEditingGoalId(null); setObjectiveData(INIT_OBJECTIVE); setEditingObjId(null); }}
                  className={`btn ${activeView === 'objectives' ? 'btn-primary' : ''}`}
                  style={{
                    borderRadius: '20px',
                    padding: '8px 20px',
                    background: activeView === 'objectives' ? '#2e7d32' : '#f0f0f0',
                    color: activeView === 'objectives' ? 'white' : '#333',
                    border: 'none',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Objective Entry Form
                </button>
              </div>

              {activeView === 'goals' ? (
                <form onSubmit={handleGoalSubmit}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                    <h2 style={{ margin: 0 }}>{editingGoalId ? 'Edit Goal' : 'New Goal'}</h2>
                  </div>
                  <div className="form-grid">
                    <div className="form-group form-grid-full">
                      <label>Parent Goal (Optional)</label>
                      <select value={goalData.parentGoalId || ''} onChange={e => setGoalData({ ...goalData, parentGoalId: e.target.value })}>
                        <option value="">None (Top-Level Goal)</option>
                        {goals.filter(g => g.id !== editingGoalId).map(g => <option key={g.id} value={g.id}>{g.title}</option>)}
                      </select>
                    </div>
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
                    <div className="form-group">
                      <label>Start Date</label>
                      <input type="date" value={goalData.startDate || ''} onChange={e => setGoalData({ ...goalData, startDate: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label>Date of Completion</label>
                      <input type="date" value={goalData.completionDate || ''} onChange={e => setGoalData({ ...goalData, completionDate: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label>Estimated Hours</label>
                      <input type="number" min="0" step="0.1" value={goalData.estimatedHours || ''} onChange={e => setGoalData({ ...goalData, estimatedHours: e.target.value })} placeholder="e.g. 40" />
                    </div>
                    <div className="form-group">
                      <label>Actual Hours</label>
                      <input type="number" min="0" step="0.1" value={goalData.actualHours || ''} onChange={e => setGoalData({ ...goalData, actualHours: e.target.value })} placeholder="e.g. 35" />
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
                  <div style={{ display: 'flex', gap: '10px', marginTop: 15 }}>
                    <button type="submit" className="btn btn-primary">
                      <Target size={16} style={{ marginRight: 6 }} /> {editingGoalId ? 'Update Goal' : 'Save Goal'}
                    </button>
                    <button type="button" className="btn" onClick={resetForm}>
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleObjectiveSubmit}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                    <h2 style={{ margin: 0 }}>{editingObjId ? 'Edit Objective' : 'New Objective'}</h2>
                  </div>
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
                    <div className="form-group">
                      <label>Start Date</label>
                      <input type="date" value={objectiveData.startDate || ''} onChange={e => setObjectiveData({ ...objectiveData, startDate: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label>Date of Completion</label>
                      <input type="date" value={objectiveData.completionDate || ''} onChange={e => setObjectiveData({ ...objectiveData, completionDate: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label>Estimated Hours</label>
                      <input type="number" min="0" step="0.1" value={objectiveData.estimatedHours || ''} onChange={e => setObjectiveData({ ...objectiveData, estimatedHours: e.target.value })} placeholder="e.g. 40" />
                    </div>
                    <div className="form-group">
                      <label>Actual Hours</label>
                      <input type="number" min="0" step="0.1" value={objectiveData.actualHours || ''} onChange={e => setObjectiveData({ ...objectiveData, actualHours: e.target.value })} placeholder="e.g. 35" />
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
                  <div style={{ display: 'flex', gap: '10px', marginTop: 15 }}>
                    <button type="submit" className="btn btn-primary">
                      <PlusCircle size={16} style={{ marginRight: 6 }} /> {editingObjId ? 'Update Objective' : 'Save Objective'}
                    </button>
                    <button type="button" className="btn" onClick={resetForm}>
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </>
          )}
        </div>
      </div>

    </div>
  );
}
