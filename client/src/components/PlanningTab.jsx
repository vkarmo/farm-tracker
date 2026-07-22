import React, { useState, useEffect, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { saveGoal, removeGoal, saveObjective, removeObjective, setEditingGoalIdRedux, setEditingObjectiveIdRedux, setGoals, setObjectives } from '../store/planningSlice';
import { saveAssignment, removeAssignment, setEditingAssignmentId } from '../store/assignmentSlice';
import { queueAction } from '../store/syncSlice';
import CrudTable from './CrudTable';
import Select from 'react-select';
import { Target, X, PlusCircle, ChevronRight, ChevronDown, List, ClipboardList, Edit, Trash2, Calendar, Clock, User, Users } from 'lucide-react';


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
  const rawGoals = useSelector(state => state.planning?.goals) || [];
  const rawObjectives = useSelector(state => state.planning?.objectives) || [];

  const goals = useMemo(() => {
    return rawGoals.filter(g => g && g.id);
  }, [rawGoals]);

  const objectives = useMemo(() => {
    return rawObjectives.filter(o => o && o.id);
  }, [rawObjectives]);

  const employeesList = useSelector(state => state.employees?.list) || [];
  const assignments = useSelector(state => state.assignments?.list) || [];
  const fields = useSelector(state => state.fields?.data) || [];

  const currentUser = useSelector(state => state.auth?.currentUser);
  const [isSyncingFromDb, setIsSyncingFromDb] = useState(false);

  const handleSyncFromDb = async () => {
    setIsSyncingFromDb(true);
    try {
      const activeFarmId = localStorage.getItem('activeFarmId') || (import.meta.env.DEV ? 'dev_farm' : 'default_farm');
      const emailParam = currentUser ? `&email=${encodeURIComponent(currentUser.email)}` : '';
      const res = await fetch(`/api/all-data?farmId=${activeFarmId}${emailParam}&t=${Date.now()}`, {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      if (!res.ok) throw new Error(`HTTP Error status ${res.status}`);
      const data = await res.json();
      const goalsCount = data.goals?.length || 0;
      const objectivesCount = data.objectives?.length || 0;
      console.log('[PlanningTab Debug] Raw API response goals/objectives count:', goalsCount, objectivesCount);
      
      dispatch(setGoals(data.goals || []));
      dispatch(setObjectives(data.objectives || []));
      
      alert(`Successfully recovered and loaded ${goalsCount} Goal(s) and ${objectivesCount} Objective(s) directly from the database!`);
    } catch (e) {
      alert('Error fetching planning data: ' + e.message);
    } finally {
      setIsSyncingFromDb(false);
    }
  };

  const [activeView, setActiveView] = useState('goals'); // goals or objectives

  const [goalData, setGoalData] = useState(INIT_GOAL);
  const [editingGoalId, setEditingGoalId] = useState(null);

  const [objectiveData, setObjectiveData] = useState(INIT_OBJECTIVE);
  const [editingObjId, setEditingObjId] = useState(null);

  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [activeTab, setActiveTab] = useState('roster');
  const [collapsedColumns, setCollapsedColumns] = useState({});

  const resetForm = () => {
    setGoalData(INIT_GOAL);
    setEditingGoalId(null);
    setObjectiveData(INIT_OBJECTIVE);
    setEditingObjId(null);
    setActiveTab('roster');
  };

  const reduxEditingGoalId = useSelector(state => state.planning.editingGoalId);
  const reduxEditingObjId = useSelector(state => state.planning.editingObjId);

  useEffect(() => {
    if (reduxEditingGoalId) {
      const goal = goals.find(g => g.id === reduxEditingGoalId);
      if (goal) {
        setActiveView('goals');
        setGoalData(goal);
        setEditingGoalId(goal.id);
        setSelectedNodeId(goal.id);
        setActiveTab('entry');
        dispatch(setEditingGoalIdRedux(null));
      }
    }
  }, [reduxEditingGoalId, goals, dispatch]);

  useEffect(() => {
    if (reduxEditingObjId) {
      const obj = objectives.find(o => o.id === reduxEditingObjId);
      if (obj) {
        setActiveView('objectives');
        setObjectiveData(obj);
        setEditingObjId(obj.id);
        setSelectedNodeId(obj.id);
        setActiveTab('entry');
        dispatch(setEditingObjectiveIdRedux(null));
      }
    }
  }, [reduxEditingObjId, objectives, dispatch]);

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
    return (
      <>
        {childrenGoals.map(goal => (
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
        ))}

        {parentId === '' && objectives.filter(o => !o.goalId || !goals.some(g => g.id === o.goalId)).map(obj => (
          <TreeNode
            key={obj.id}
            label={`${obj.title} (Unlinked Objective)`}
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
      </>
    );
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



  const renderProjectBoard = () => {
    const COLUMNS = [
      { status: 'Pending Review', label: 'PENDING REVIEW', color: '#ef6c00', bg: '#ffe0b2', border: '#ffe0b2' },
      { status: 'Not Complete', label: 'NOT COMPLETE', color: '#c62828', bg: '#ffebee', border: '#ffcdd2' },
      { status: 'Complete', label: 'COMPLETE', color: '#2e7d32', bg: '#e8f5e9', border: '#c8e6c9' },
      { status: 'Satisfactory', label: 'SATISFACTORY', color: '#1a237e', bg: '#e8eaf6', border: '#c5cae9' }
    ];

    const handleDeleteAssignment = (id) => {
      if (window.confirm("Delete this Work Assignment?")) {
        dispatch(removeAssignment(id));
        dispatch(queueAction({ type: 'core/deleteNode', payload: { id }, meta: { id: Date.now() } }));
      }
    };

    return (
      <div style={{ 
        display: 'flex', 
        flexDirection: 'row', 
        overflowX: 'auto', 
        gap: '20px', 
        paddingBottom: '20px',
        alignItems: 'stretch',
        minHeight: '500px'
      }}>
        {COLUMNS.map(col => {
          const colAssignments = assignments.filter(a => (a.reviewStatus || 'Pending Review') === col.status);
          const isCollapsed = collapsedColumns[col.status];

          if (isCollapsed) {
            return (
              <div 
                key={col.status} 
                style={{
                  width: '45px',
                  flexShrink: 0,
                  background: '#f8fafc',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: '12px 4px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
                  cursor: 'pointer'
                }}
                onClick={() => setCollapsedColumns(prev => ({ ...prev, [col.status]: false }))}
                title={`Expand ${col.label}`}
              >
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', width: '100%' }}>
                  <button
                    type="button"
                    style={{
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      color: col.color,
                      fontWeight: 'bold',
                      fontSize: '0.85rem',
                      padding: '2px'
                    }}
                  >
                    ▶
                  </button>
                  <span style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    background: 'white',
                    color: col.color,
                    padding: '2px 6px',
                    borderRadius: '10px',
                    border: `1px solid ${col.color}`
                  }}>
                    {colAssignments.length}
                  </span>
                </div>
                <div style={{
                  marginTop: '20px',
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  color: col.color,
                  writingMode: 'vertical-lr',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  whiteSpace: 'nowrap'
                }}>
                  {col.label}
                </div>
              </div>
            );
          }

          return (
            <div 
              key={col.status} 
              style={{
                width: '300px',
                flexShrink: 0,
                background: '#f8fafc',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)'
              }}
            >
              {/* Column Header */}
              <div style={{
                padding: '12px 16px',
                background: col.bg,
                borderTopLeftRadius: '7px',
                borderTopRightRadius: '7px',
                borderBottom: `2px solid ${col.color}`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setCollapsedColumns(prev => ({ ...prev, [col.status]: true }));
                    }}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      color: col.color,
                      fontWeight: 'bold',
                      fontSize: '0.85rem',
                      padding: '2px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    title="Collapse column"
                  >
                    ◀
                  </button>
                  <span style={{ fontSize: '0.8rem', fontWeight: 800, color: col.color }}>
                    {col.label}
                  </span>
                </div>
                <span style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  background: 'white',
                  color: col.color,
                  padding: '2px 8px',
                  borderRadius: '12px',
                  border: `1px solid ${col.color}`
                }}>
                  {colAssignments.length}
                </span>
              </div>

              {/* Assignment Cards Stack */}
              <div style={{
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                overflowY: 'auto',
                flex: 1
              }}>
                {colAssignments.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.75rem', padding: '30px 0', fontStyle: 'italic' }}>
                    No assignments in this stage.
                  </div>
                ) : (
                  colAssignments.map(ass => {
                    // Find field
                    const linkedField = fields.find(f => f.id === ass.fieldId);
                    // Find objective and goal
                    const linkedObjective = objectives.find(o => o.id === ass.planningId);
                    const linkedGoal = linkedObjective ? goals.find(g => g.id === linkedObjective.goalId) : null;

                    return (
                      <div 
                        key={ass.id}
                        style={{
                          background: '#fff',
                          borderRadius: '6px',
                          border: '1px solid #e2e8f0',
                          borderLeft: `4px solid ${col.color}`,
                          padding: '12px',
                          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px'
                        }}
                      >
                        {/* Task Title & Delete action */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '6px' }}>
                          <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.85rem', lineHeight: '1.2' }}>
                            {ass.task}
                          </span>
                          <button 
                            onClick={() => handleDeleteAssignment(ass.id)}
                            style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '2px', flexShrink: 0 }}
                            title="Delete Assignment"
                          >
                            <Trash2 size={13} color="#e11d48" />
                          </button>
                        </div>

                        {/* Assignment Details */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.72rem', color: '#475569' }}>
                          {linkedField && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span style={{ fontWeight: 600, color: '#64748b' }}>Field:</span>
                              <span style={{ color: '#0f172a' }}>{linkedField.name}</span>
                            </div>
                          )}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Calendar size={11} color="#64748b" />
                            <span>Assigned: {ass.assignmentDate || '?'}</span>
                          </div>
                          {ass.completedDate && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#16a34a', fontWeight: 500 }}>
                              <Calendar size={11} />
                              <span>Completed: {ass.completedDate}</span>
                            </div>
                          )}
                          {ass.hours && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Clock size={11} color="#64748b" />
                              <span>{ass.hours} hours</span>
                            </div>
                          )}
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '4px', marginTop: '2px' }}>
                            <User size={11} color="#64748b" style={{ marginTop: '2px' }} />
                            <span>{ass.workers || renderWorkerNames(ass.workerIds)}</span>
                          </div>
                        </div>

                        {/* Objectives & Goals badges */}
                        {(linkedObjective || linkedGoal) && (
                          <div style={{ 
                            display: 'flex', 
                            flexDirection: 'column', 
                            gap: '4px', 
                            borderTop: '1px dashed #e2e8f0', 
                            paddingTop: '6px',
                            marginTop: '2px'
                          }}>
                            {linkedObjective && (
                              <div style={{ 
                                fontSize: '0.65rem', 
                                background: '#f1f5f9', 
                                color: '#475569', 
                                padding: '2px 6px', 
                                borderRadius: '4px',
                                textOverflow: 'ellipsis',
                                overflow: 'hidden',
                                whiteSpace: 'nowrap'
                              }}>
                                <strong>Obj:</strong> {linkedObjective.title}
                              </div>
                            )}
                            {linkedGoal && (
                              <div style={{ 
                                fontSize: '0.65rem', 
                                background: '#e8f5e9', 
                                color: '#2e7d32', 
                                padding: '2px 6px', 
                                borderRadius: '4px',
                                textOverflow: 'ellipsis',
                                overflow: 'hidden',
                                whiteSpace: 'nowrap'
                              }}>
                                <strong>Goal:</strong> {linkedGoal.title}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Status dropdown selector */}
                        <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '6px', marginTop: '2px' }}>
                          <select
                            value={ass.reviewStatus || 'Pending Review'}
                            onChange={(e) => {
                              const newStatus = e.target.value;
                              const updated = { ...ass, reviewStatus: newStatus };
                              dispatch(saveAssignment(updated));
                              dispatch(queueAction({ type: 'assignments/saveAssignment', payload: updated, meta: { id: Date.now() } }));
                            }}
                            style={{
                              width: '100%',
                              padding: '4px 8px',
                              fontSize: '0.75rem',
                              borderRadius: '4px',
                              border: '1px solid #cbd5e1',
                              background: '#fff',
                              fontWeight: 600,
                              color: '#334155',
                              cursor: 'pointer',
                              outline: 'none'
                            }}
                          >
                            <option value="Pending Review">Pending Review</option>
                            <option value="Not Complete">Not Complete</option>
                            <option value="Complete">Complete</option>
                            <option value="Satisfactory">Satisfactory</option>
                          </select>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const getHierarchicalList = () => {
    const list = [];

    const addGoalAndChildren = (parentId, depth) => {
      const matchingGoals = goals.filter(g => (g.parentGoalId || '') === parentId);
      matchingGoals.forEach(goal => {
        list.push({ type: 'Goal', data: goal, depth });

        // Objectives for this goal
        const goalObjectives = objectives.filter(o => o.goalId === goal.id);
        goalObjectives.forEach(obj => {
          list.push({ type: 'Objective', data: obj, depth: depth + 1 });

          // Assignments for this objective
          const objAssignments = assignments.filter(a => a.planningId === obj.id);
          objAssignments.forEach(ass => {
            list.push({ type: 'Assignment', data: ass, depth: depth + 2 });
          });
        });

        // Recurse child goals
        addGoalAndChildren(goal.id, depth + 1);
      });
    };

    addGoalAndChildren('', 0);
    return list;
  };

  const renderProjectTaskList = () => {
    const flattenedItems = getHierarchicalList();

    if (flattenedItems.length === 0) {
      return (
        <div style={{ textAlign: 'center', color: '#64748b', padding: '40px 0', fontSize: '0.9rem', fontStyle: 'italic' }}>
          No goals, objectives, or assignments found.
        </div>
      );
    }

    const handleDeleteAssignment = (id) => {
      if (window.confirm("Delete this Work Assignment?")) {
        dispatch(removeAssignment(id));
        dispatch(queueAction({ type: 'core/deleteNode', payload: { id }, meta: { id: Date.now() } }));
      }
    };

    return (
      <div style={{ 
        width: '100%',
        overflowX: 'auto',
        border: '1px solid #cbd5e1',
        borderRadius: '8px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
        background: '#fff'
      }}>
        <table style={{ 
          width: '100%', 
          minWidth: '1000px', 
          borderCollapse: 'collapse', 
          textAlign: 'left',
          fontSize: '0.8rem'
        }}>
          <thead>
            <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
              <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 700 }}>NAME / TITLE</th>
              <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 700, width: '120px' }}>TYPE</th>
              <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 700, width: '160px' }}>TIMELINE</th>
              <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 700, width: '100px', textAlign: 'center' }}>EST. HOURS</th>
              <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 700, width: '100px', textAlign: 'center' }}>ACT. HOURS</th>
              <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 700, width: '180px' }}>ASSIGNEES / WORKERS</th>
              <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 700, width: '130px' }}>LINKED RESOURCE</th>
              <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 700, width: '160px' }}>STATUS / PROGRESS</th>
              <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 700, width: '100px', textAlign: 'center' }}>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {flattenedItems.map((item, idx) => {
              const { type, data, depth } = item;
              const isGoal = type === 'Goal';
              const isObjective = type === 'Objective';
              const isAssignment = type === 'Assignment';

              // Determine row background color based on type
              let rowBg = '#fff';
              if (isGoal) rowBg = '#f0fdf4'; // Light green
              else if (isObjective) rowBg = '#f0f9ff'; // Light blue
              else if (idx % 2 === 1) rowBg = '#f8fafc'; // Alternate plain rows

              // Setup badge styles
              let badgeColor = '#475569';
              let badgeBg = '#f1f5f9';
              if (isGoal) {
                badgeColor = '#166534';
                badgeBg = '#dcfce7';
              } else if (isObjective) {
                badgeColor = '#075985';
                badgeBg = '#e0f2fe';
              }

              // Determine workers / assignees names
              const workersStr = data.workerIds ? renderWorkerNames(data.workerIds) : (data.workers || '-');

              // Determine timeline
              const timelineStr = isAssignment 
                ? (data.assignmentDate || '-') 
                : `${data.fromDate || '?'} to ${data.toDate || '?'}`;

              // Determine estimated / actual hours
              const estHours = data.estimatedHours || '-';
              const actHours = data.actualHours || data.hours || '-';

              // Resolve linked field name (for assignments)
              const linkedField = isAssignment && data.fieldId 
                ? (fields.find(f => f.id === data.fieldId)?.name || 'Unknown Field')
                : '-';

              return (
                <tr 
                  key={`${type}-${data.id}-${idx}`} 
                  style={{ 
                    background: rowBg, 
                    borderBottom: '1px solid #e2e8f0',
                    transition: 'background 0.15s'
                  }}
                >
                  {/* Indented Name / Title */}
                  <td style={{ 
                    padding: '10px 16px', 
                    paddingLeft: `${16 + depth * 24}px`,
                    fontWeight: isGoal ? 700 : (isObjective ? 600 : 400),
                    color: isGoal ? '#166534' : (isObjective ? '#0f172a' : '#334155'),
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    {isGoal && <Target size={15} style={{ color: '#166534' }} />}
                    {isObjective && <ClipboardList size={14} style={{ color: '#0284c7' }} />}
                    {isAssignment && <List size={13} style={{ color: '#64748b' }} />}
                    <span>{data.title || data.task}</span>
                  </td>

                  {/* Type Badge */}
                  <td style={{ padding: '10px 16px' }}>
                    <span style={{
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      color: badgeColor,
                      background: badgeBg,
                      padding: '2px 8px',
                      borderRadius: '12px',
                      textTransform: 'uppercase'
                    }}>
                      {type}
                    </span>
                  </td>

                  {/* Timeline */}
                  <td style={{ padding: '10px 16px', color: '#64748b' }}>
                    {timelineStr}
                  </td>

                  {/* Est. Hours */}
                  <td style={{ padding: '10px 16px', textAlign: 'center', color: '#334155' }}>
                    {estHours}
                  </td>

                  {/* Act. Hours */}
                  <td style={{ padding: '10px 16px', textAlign: 'center', color: '#334155' }}>
                    {actHours}
                  </td>

                  {/* Assignees */}
                  <td style={{ 
                    padding: '10px 16px', 
                    color: '#475569',
                    whiteSpace: 'nowrap',
                    textOverflow: 'ellipsis',
                    overflow: 'hidden',
                    maxWidth: '180px'
                  }} title={workersStr}>
                    {workersStr}
                  </td>

                  {/* Linked Field */}
                  <td style={{ padding: '10px 16px', color: '#475569' }}>
                    {linkedField}
                  </td>

                  {/* Status / Progress */}
                  <td style={{ padding: '10px 16px' }}>
                    {isAssignment ? (
                      <select
                        value={data.reviewStatus || 'Pending Review'}
                        onChange={(e) => {
                          const newStatus = e.target.value;
                          const updated = { ...data, reviewStatus: newStatus };
                          dispatch(saveAssignment(updated));
                          dispatch(queueAction({ type: 'assignments/saveAssignment', payload: updated, meta: { id: Date.now() } }));
                        }}
                        style={{
                          padding: '3px 6px',
                          fontSize: '0.72rem',
                          borderRadius: '4px',
                          border: '1px solid #cbd5e1',
                          background: '#fff',
                          fontWeight: 600,
                          color: '#334155',
                          cursor: 'pointer',
                          width: '100%',
                          outline: 'none'
                        }}
                      >
                        <option value="Pending Review">Pending Review</option>
                        <option value="Not Complete">Not Complete</option>
                        <option value="Complete">Complete</option>
                        <option value="Satisfactory">Satisfactory</option>
                      </select>
                    ) : (
                      // For Goals / Objectives, calculate a simple progress bar
                      (() => {
                        const est = parseFloat(data.estimatedHours) || 0;
                        const act = parseFloat(data.actualHours) || 0;
                        const pct = est > 0 ? Math.min(100, Math.round((act / est) * 100)) : 0;
                        return est > 0 ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ flex: 1, height: '5px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                              <div style={{ width: `${pct}%`, height: '100%', background: isGoal ? '#166534' : '#0284c7' }} />
                            </div>
                            <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#64748b' }}>{pct}%</span>
                          </div>
                        ) : (
                          <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '0.7rem' }}>No hours est.</span>
                        );
                      })()
                    )}
                  </td>

                  {/* Actions */}
                  <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                      <button
                        onClick={() => {
                          if (isGoal) {
                            dispatch(setEditingGoalIdRedux(data.id));
                            window.dispatchEvent(new CustomEvent('navigate-tab', { detail: 'planning' }));
                          } else if (isObjective) {
                            dispatch(setEditingObjectiveIdRedux(data.id));
                            window.dispatchEvent(new CustomEvent('navigate-tab', { detail: 'planning' }));
                          } else {
                            dispatch(setEditingAssignmentId(data.id));
                            window.dispatchEvent(new CustomEvent('navigate-tab', { detail: 'assignment' }));
                          }
                        }}
                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '2px' }}
                        title={`Edit ${type}`}
                      >
                        <Edit size={13} color="#64748b" />
                      </button>
                      <button
                        onClick={() => {
                          if (isGoal) {
                            handleDeleteGoal(data.id);
                          } else if (isObjective) {
                            handleDeleteObjective(data.id);
                          } else {
                            handleDeleteAssignment(data.id);
                          }
                        }}
                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '2px' }}
                        title={`Delete ${type}`}
                      >
                        <Trash2 size={13} color="#e11d48" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="sub-tabs-container">
          <button
            type="button"
            onClick={() => setActiveTab('roster')}
            className="sub-tab-btn"
            style={{
              background: activeTab === 'roster' ? 'white' : 'transparent',
              borderBottom: activeTab === 'roster' ? '3px solid var(--color-primary)' : 'none',
              color: activeTab === 'roster' ? 'var(--color-primary)' : 'var(--color-text-light)',
            }}
          >
            Planning Tree View
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('board')}
            className="sub-tab-btn"
            style={{
              background: activeTab === 'board' ? 'white' : 'transparent',
              borderBottom: activeTab === 'board' ? '3px solid var(--color-primary)' : 'none',
              color: activeTab === 'board' ? 'var(--color-primary)' : 'var(--color-text-light)',
            }}
          >
            Project Board View
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('taskList')}
            className="sub-tab-btn"
            style={{
              background: activeTab === 'taskList' ? 'white' : 'transparent',
              borderBottom: activeTab === 'taskList' ? '3px solid var(--color-primary)' : 'none',
              color: activeTab === 'taskList' ? 'var(--color-primary)' : 'var(--color-text-light)',
            }}
          >
            Project Task List
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('entry')}
            className="sub-tab-btn"
            style={{
              background: activeTab === 'entry' ? 'white' : 'transparent',
              borderBottom: activeTab === 'entry' ? '3px solid var(--color-primary)' : 'none',
              color: activeTab === 'entry' ? 'var(--color-primary)' : 'var(--color-text-light)',
            }}
          >
            {editingGoalId || editingObjId ? 'Edit Plan Entry' : 'New Plan Entry'}
          </button>
        </div>

        <div style={{ padding: '20px' }}>
          {activeTab === 'roster' && (
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
                    <div style={{ textAlign: 'center', padding: '20px 0' }}>
                      <p style={{ color: '#888', fontStyle: 'italic', marginBottom: '10px' }}>No goals have been created yet.</p>
                      <button
                        onClick={handleSyncFromDb}
                        disabled={isSyncingFromDb}
                        className="btn btn-primary"
                        style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                      >
                        {isSyncingFromDb ? 'Syncing...' : 'Sync & Recover Goals & Objectives from Neo4j'}
                      </button>
                    </div>
                  ) : (
                    renderGoalsTree('')
                  )}
                </div>
              ) : (
                <div style={{ padding: '15px', background: '#fafafa', borderRadius: '8px', border: '1px solid #eee' }}>
                  {objectives.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '20px 0' }}>
                      <p style={{ color: '#888', fontStyle: 'italic', marginBottom: '10px' }}>No objectives have been created yet.</p>
                      <button
                        onClick={handleSyncFromDb}
                        disabled={isSyncingFromDb}
                        className="btn btn-primary"
                        style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                      >
                        {isSyncingFromDb ? 'Syncing...' : 'Sync & Recover Goals & Objectives from Neo4j'}
                      </button>
                    </div>
                  ) : (
                    renderObjectivesTree()
                  )}
                </div>
              )}
            </>
          )}

          {activeTab === 'board' && renderProjectBoard()}

          {activeTab === 'taskList' && renderProjectTaskList()}

          {activeTab === 'entry' && (
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
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', justifyContent: 'flex-end' }}>
                    <button type="button" className="btn" onClick={resetForm}>
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-primary">
                      <Target size={16} style={{ marginRight: 6 }} /> {editingGoalId ? 'Update Goal' : 'Save Goal'}
                    </button>
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
                </form>
              ) : (
                <form onSubmit={handleObjectiveSubmit}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                    <h2 style={{ margin: 0 }}>{editingObjId ? 'Edit Objective' : 'New Objective'}</h2>
                  </div>
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', justifyContent: 'flex-end' }}>
                    <button type="button" className="btn" onClick={resetForm}>
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-primary">
                      <PlusCircle size={16} style={{ marginRight: 6 }} /> {editingObjId ? 'Update Objective' : 'Save Objective'}
                    </button>
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
                </form>
              )}
            </>
          )}
        </div>
      </div>

    </div>
  );
}
