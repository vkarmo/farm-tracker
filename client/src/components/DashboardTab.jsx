import React, { useMemo, useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { saveAssignment, removeAssignment, setEditingAssignmentId } from '../store/assignmentSlice';
import { saveGoal, removeGoal, saveObjective, removeObjective, setEditingGoalIdRedux, setEditingObjectiveIdRedux } from '../store/planningSlice';
import { queueAction } from '../store/syncSlice';
import Select from 'react-select';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { TrendingUp, Layers, Rabbit, DollarSign, Sun, CloudRain, Cloud, CloudLightning, Snowflake, CloudFog, MapPin, Droplets, Wind, ThermometerSun, CloudSun, Droplet, Clock, AlertTriangle, ShieldCheck, AlertCircle, Info, Thermometer, Target, ClipboardList, List, ChevronRight, ChevronDown, Edit, Trash2, User, Users, Calendar, AlertOctagon, Trees, Home, Flame } from 'lucide-react';
import CrudTable from './CrudTable';
import area from '@turf/area';
import { polygon } from '@turf/helpers';


const CollapsibleCard = ({ title, children, defaultOpen = true, forceFullGrid = false }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className={`card ${forceFullGrid ? 'form-grid-full' : ''}`} style={{ marginBottom: 0 }}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', marginBottom: isOpen ? '20px' : '0', borderBottom: isOpen ? '2px solid #efefef' : 'none', paddingBottom: isOpen ? '10px' : '0' }}
      >
        <h3 style={{ fontSize: '1.05rem', margin: 0, color: '#333' }}>
          {title}
        </h3>
        <button tabIndex="-1" className="btn" style={{ padding: '4px 8px', fontSize: '0.8rem', pointerEvents: 'none' }}>
          {isOpen ? 'Hide' : 'Show'}
        </button>
      </div>
      {isOpen && children}
    </div>
  );
};

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


export default function DashboardTab() {
  const dispatch = useDispatch();
  const currentUser = useSelector(state => state.auth?.currentUser);
  const fields = useSelector(state => state.fields.data) || [];
  const crops = useSelector(state => state.assets.crops) || [];
  const nurseries = useSelector(state => state.nurseries?.beds) || [];
  const harvests = useSelector(state => state.assets.harvests) || [];
  const livestock = useSelector(state => state.assets.livestock) || [];
  const transactions = useSelector(state => state.financials.transactions) || [];
  const activities = useSelector(state => state.activities?.log) || [];
  const deadlines = useSelector(state => state.deadlines?.list) || [];
  const incidents = useSelector(state => state.incidents?.list) || [];
  const goals = useSelector(state => state.planning?.goals) || [];
  const objectives = useSelector(state => state.planning?.objectives) || [];
  const assignments = useSelector(state => state.assignments?.list) || [];
  const employeesList = useSelector(state => state.employees?.list) || [];
  const charcoalAlerts = useSelector(state => state.charcoal?.list || []);

  const mapCenter = useSelector(state => state.settings?.mapCenter) || [51.505, -0.09];
  const simulateHighWinds = useSelector(state => state.settings?.simulateHighWinds) || false;
  const googleMapsApiKey = useSelector(state => state.settings?.googleMapsApiKey) || '';

  const [selectedLocId, setSelectedLocId] = useState('default');
  const [weatherData, setWeatherData] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [geeWeatherData, setGeeWeatherData] = useState(null);
  const [geeWeatherLoading, setGeeWeatherLoading] = useState(false);
  const [geeWeatherError, setGeeWeatherError] = useState(null);
  const [deviceCoords, setDeviceCoords] = useState(null);
  const [deviceCoordsLoading, setDeviceCoordsLoading] = useState(false);
  const [deviceCoordsError, setDeviceCoordsError] = useState(null);
  const [deviceLocationName, setDeviceLocationName] = useState('');

  const effectiveGeeWeatherLoading = simulateHighWinds ? false : geeWeatherLoading;

  const effectiveGeeWeatherData = useMemo(() => {
    if (!geeWeatherData) {
      if (simulateHighWinds) {
        return {
          temperature: 28.0,
          precipitation: 0.0,
          windSpeed: 18.0,
          humidity: 85,
          clouds: 90,
          dateStr: new Date().toLocaleDateString() + ' (Simulated)',
          duration: '3 Hours (Hourly Forecast)',
          isSimulated: true,
          weatherCode: 3
        };
      }
      return null;
    }
    if (simulateHighWinds) {
      return {
        ...geeWeatherData,
        windSpeed: 18.0,
        isSimulated: true
      };
    }
    return geeWeatherData;
  }, [geeWeatherData, simulateHighWinds]);
  const [activeWeatherTab, setActiveWeatherTab] = useState('current');
  const [showRainProbability, setShowRainProbability] = useState(false);
  const [activeDashboardTab, setActiveDashboardTab] = useState('weather');
  const [primaryView, setPrimaryView] = useState('assignments_view');
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [collapsedColumns, setCollapsedColumns] = useState({});
  const [selectedCropIds, setSelectedCropIds] = useState([]);
  const [harvestFromDate, setHarvestFromDate] = useState('');
  const [harvestToDate, setHarvestToDate] = useState('');
  const [harvestViewToggle, setHarvestViewToggle] = useState('graph');
  const [expandedNodes, setExpandedNodes] = useState({});

  const activeRate = useMemo(() => {
    const sorted = [...transactions].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const recent = sorted.find(t => t.exchangeRate && String(t.exchangeRate).trim() !== '');
    const rateVal = recent ? parseFloat(recent.exchangeRate) : 150;
    return rateVal > 0 ? rateVal : 150;
  }, [transactions]);

  const getEmployeeHourlyRate = (emp) => {
    if (!emp) return 0;
    if (emp.type === 'Daily') {
      const dailyLD = parseFloat(emp.dailyRateLD) || 0;
      const dailyUSD = activeRate > 0 ? (dailyLD / activeRate) : 0;
      return dailyUSD / 8; // assuming standard 8-hour day
    } else {
      const biweeklyUSD = parseFloat(emp.twoWeekPayUSD) || 0;
      return biweeklyUSD / 80; // assuming standard 80 hours per 2 weeks
    }
  };

  const avgHourlyRate = useMemo(() => {
    const activeEmployees = employeesList.filter(e => !e.isTerminated);
    if (activeEmployees.length === 0) return 0;
    const sum = activeEmployees.reduce((s, e) => s + getEmployeeHourlyRate(e), 0);
    return sum / activeEmployees.length;
  }, [employeesList, activeRate]);

  const getAssignmentCost = (ass) => {
    const assHours = parseFloat(ass.hours) || 0;
    if (assHours <= 0) return 0;

    const ids = ass.workerIds || [];
    if (ids.length === 0) {
      return assHours * avgHourlyRate;
    }

    const hoursPerWorker = assHours / ids.length;
    let totalCost = 0;
    ids.forEach(id => {
      const emp = employeesList.find(e => e.id === id);
      const rate = getEmployeeHourlyRate(emp);
      totalCost += hoursPerWorker * rate;
    });
    return totalCost;
  };

  const renderWorkerNames = (workerIds) => {
    if (!workerIds || workerIds.length === 0) return 'None';
    const names = workerIds.map(id => {
      const emp = employeesList.find(e => e.id === id);
      return emp ? `${emp.firstName} ${emp.lastName}` : 'Unknown';
    });
    return names.join(', ');
  };

  const parseLocalDate = (dateStr) => {
    if (!dateStr) return new Date();
    const parts = dateStr.split('-');
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
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
          dispatch(setEditingGoalIdRedux(goal.id));
          window.dispatchEvent(new CustomEvent('navigate-tab', { detail: 'planning' }));
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
              dispatch(setEditingObjectiveIdRedux(obj.id));
              window.dispatchEvent(new CustomEvent('navigate-tab', { detail: 'planning' }));
            }}
          >
            {assignments.filter(a => a.planningId === obj.id).sort((a, b) => (b.assignmentDate || '').localeCompare(a.assignmentDate || '')).map(ass => (
              <TreeNode
                key={ass.id}
                label={`${ass.task} (Assigned: ${ass.workers || renderWorkerNames(ass.workerIds)})`}
                icon={List}
                isSelected={selectedNodeId === ass.id}
                onSelect={() => setSelectedNodeId(ass.id)}
                onEdit={() => {
                  dispatch(setEditingAssignmentId(ass.id));
                  window.dispatchEvent(new CustomEvent('navigate-tab', { detail: 'assignment' }));
                }}
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
          dispatch(setEditingObjectiveIdRedux(obj.id));
          window.dispatchEvent(new CustomEvent('navigate-tab', { detail: 'planning' }));
        }}
      >
        {assignments.filter(a => a.planningId === obj.id).sort((a, b) => (b.assignmentDate || '').localeCompare(a.assignmentDate || '')).map(ass => (
          <TreeNode
            key={ass.id}
            label={`${ass.task} (Assigned: ${ass.workers || renderWorkerNames(ass.workerIds)})`}
            icon={List}
            isSelected={selectedNodeId === ass.id}
            onSelect={() => setSelectedNodeId(ass.id)}
            onEdit={() => {
              dispatch(setEditingAssignmentId(ass.id));
              window.dispatchEvent(new CustomEvent('navigate-tab', { detail: 'assignment' }));
            }}
          />
        ))}
      </TreeNode>
    ));
  };

  const getHierarchicalList = () => {
    const list = [];
    const addedGoalIds = new Set();
    const addedObjIds = new Set();
    const addedAssIds = new Set();

    const addGoalAndChildren = (parentId, depth) => {
      const matchingGoals = goals.filter(g => (g.parentGoalId || '') === parentId);
      matchingGoals.forEach(goal => {
        addedGoalIds.add(goal.id);
        list.push({ type: 'Goal', data: goal, depth });

        // Objectives for this goal
        const goalObjectives = objectives.filter(o => o.goalId === goal.id);
        goalObjectives.forEach(obj => {
          addedObjIds.add(obj.id);
          list.push({ type: 'Objective', data: obj, depth: depth + 1 });

          // Assignments for this objective
          const objAssignments = assignments.filter(a => a.planningId === obj.id);
          objAssignments.forEach(ass => {
            addedAssIds.add(ass.id);
            list.push({ type: 'Assignment', data: ass, depth: depth + 2 });
          });
        });

        // Recurse child goals
        addGoalAndChildren(goal.id, depth + 1);
      });
    };

    addGoalAndChildren('', 0);

    // Append unlinked/orphan goals
    goals.forEach(goal => {
      if (!addedGoalIds.has(goal.id)) {
        addedGoalIds.add(goal.id);
        list.push({ type: 'Goal', data: goal, depth: 0 });
        const goalObj = objectives.filter(o => o.goalId === goal.id);
        goalObj.forEach(obj => {
          addedObjIds.add(obj.id);
          list.push({ type: 'Objective', data: obj, depth: 1 });
          const objAss = assignments.filter(a => a.planningId === obj.id);
          objAss.forEach(ass => {
            addedAssIds.add(ass.id);
            list.push({ type: 'Assignment', data: ass, depth: 2 });
          });
        });
      }
    });

    // Append unlinked/orphan objectives
    const orphanObjectives = objectives.filter(o => !addedObjIds.has(o.id));
    orphanObjectives.forEach(obj => {
      addedObjIds.add(obj.id);
      list.push({ type: 'Objective', data: obj, depth: 0 });
      const objAss = assignments.filter(a => a.planningId === obj.id);
      objAss.forEach(ass => {
        addedAssIds.add(ass.id);
        list.push({ type: 'Assignment', data: ass, depth: 1 });
      });
    });

    // Append unlinked/orphan assignments
    const orphanAssignments = assignments.filter(a => !addedAssIds.has(a.id));
    orphanAssignments.forEach(ass => {
      list.push({ type: 'Assignment', data: ass, depth: 0 });
    });

    return list;
  };

  const handleDeleteGoal = (id) => {
    if (window.confirm("Delete this Goal and all its associated Objectives?")) {
      dispatch(removeGoal(id));
      dispatch(queueAction({ type: 'core/deleteNode', payload: { id }, meta: { id: Date.now() } }));
    }
  };

  const handleDeleteObjective = (id) => {
    if (window.confirm("Delete this Objective?")) {
      dispatch(removeObjective(id));
      dispatch(queueAction({ type: 'core/deleteNode', payload: { id }, meta: { id: Date.now() } }));
    }
  };

  const handleDeleteAssignment = (id) => {
    if (window.confirm("Delete this Work Assignment?")) {
      dispatch(removeAssignment(id));
      dispatch(queueAction({ type: 'core/deleteNode', payload: { id }, meta: { id: Date.now() } }));
    }
  };

  const renderProjectBoard = () => {
    const COLUMNS = [
      { status: 'Pending Review', label: 'PENDING REVIEW', color: '#ef6c00', bg: '#ffe0b2', border: '#ffe0b2' },
      { status: 'Not Complete', label: 'NOT COMPLETE', color: '#c62828', bg: '#ffebee', border: '#ffcdd2' },
      { status: 'Complete', label: 'COMPLETE', color: '#2e7d32', bg: '#e8f5e9', border: '#c8e6c9' },
      { status: 'Satisfactory', label: 'SATISFACTORY', color: '#1a237e', bg: '#e8eaf6', border: '#c5cae9' }
    ];

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
                    const linkedField = fields.find(f => f.id === ass.fieldId);
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
                        {/* Task Title & Actions */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '6px' }}>
                          <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.85rem', lineHeight: '1.2' }}>
                            {ass.task}
                          </span>
                          <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                            <button
                              onClick={() => {
                                dispatch(setEditingAssignmentId(ass.id));
                                window.dispatchEvent(new CustomEvent('navigate-tab', { detail: 'assignment' }));
                              }}
                              style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '2px', flexShrink: 0 }}
                              title="Edit Assignment"
                            >
                              <Edit size={12} color="#64748b" />
                            </button>
                            <button
                              onClick={() => handleDeleteAssignment(ass.id)}
                              style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '2px', flexShrink: 0 }}
                              title="Delete Assignment"
                            >
                              <Trash2 size={12} color="#e11d48" />
                            </button>
                          </div>
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

  const renderProjectTaskList = () => {
    const flattenedItems = getHierarchicalList();

    if (flattenedItems.length === 0) {
      return (
        <div style={{ textAlign: 'center', color: '#64748b', padding: '40px 0', fontSize: '0.9rem', fontStyle: 'italic' }}>
          No goals, objectives, or assignments found.
        </div>
      );
    }

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

              let rowBg = '#fff';
              if (isGoal) rowBg = '#f0fdf4';
              else if (isObjective) rowBg = '#f0f9ff';
              else if (idx % 2 === 1) rowBg = '#f8fafc';

              let badgeColor = '#475569';
              let badgeBg = '#f1f5f9';
              if (isGoal) {
                badgeColor = '#166534';
                badgeBg = '#dcfce7';
              } else if (isObjective) {
                badgeColor = '#075985';
                badgeBg = '#e0f2fe';
              }

              const workersStr = data.workerIds ? renderWorkerNames(data.workerIds) : (data.workers || '-');
              const timelineStr = isAssignment
                ? (data.assignmentDate || '-')
                : `${data.fromDate || '?'} to ${data.toDate || '?'}`;

              const estHours = data.estimatedHours || '-';
              const actHours = data.actualHours || data.hours || '-';

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

                  <td style={{ padding: '10px 16px', color: '#64748b' }}>
                    {timelineStr}
                  </td>

                  <td style={{ padding: '10px 16px', textAlign: 'center', color: '#334155' }}>
                    {estHours}
                  </td>

                  <td style={{ padding: '10px 16px', textAlign: 'center', color: '#334155' }}>
                    {actHours}
                  </td>

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

                  <td style={{ padding: '10px 16px', color: '#475569' }}>
                    {linkedField}
                  </td>

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

  const weatherLocations = useMemo(() => {
    const list = [
      { id: 'default', label: 'Default Farm Location', coords: mapCenter },
      { id: 'bomi', label: 'Bomi County, Liberia', coords: [6.7319579, -10.8700117] }
    ];
    if (deviceCoords) {
      list.push({ id: 'device', label: deviceLocationName || 'Current Device Location', coords: deviceCoords });
    } else if (deviceCoordsLoading) {
      list.push({ id: 'device', label: 'Current Device Location (Locating...)', coords: null });
    } else if (deviceCoordsError) {
      list.push({ id: 'device', label: 'Current Device Location (Error - Click to Retry)', coords: null });
    } else {
      list.push({ id: 'device', label: 'Current Device Location', coords: null });
    }
    return list.sort((a, b) => (a.label || '').localeCompare(b.label || ''));
  }, [mapCenter, deviceCoords, deviceCoordsLoading, deviceCoordsError, deviceLocationName]);

  // Fetch Weather Data
  useEffect(() => {
    let isMounted = true;
    const fetchWeather = async () => {
      const loc = weatherLocations.find(l => l.id === selectedLocId);
      if (!loc) return;

      let coords = loc.coords;

      if (!coords && loc.id === 'device') {
        if (deviceCoordsLoading) return;
        if (navigator.geolocation) {
          setDeviceCoordsLoading(true);
          setDeviceCoordsError(null);
          navigator.geolocation.getCurrentPosition(
            (position) => {
              const lat = position.coords.latitude;
              const lng = position.coords.longitude;
              const newCoords = [lat, lng];

              // Immediately set GPS coordinates first without waiting for reverse lookup
              if (isMounted) {
                setDeviceCoords(newCoords);
                setDeviceCoordsLoading(false);
                setDeviceLocationName('Current Device Location');
              }

              // Build Geocoding request (use Google Geocoding API if key is available, fallback to BigDataCloud)
              const url = googleMapsApiKey
                ? `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${googleMapsApiKey}`
                : `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`;

              fetch(url)
                .then(r => r.json())
                .then(json => {
                  let label = '';
                  if (googleMapsApiKey) {
                    // Extract City/Town and Country from Google Geocoding response
                    let city = '';
                    let country = '';
                    if (json.results && json.results.length > 0) {
                      for (const result of json.results) {
                        if (result.address_components) {
                          for (const comp of result.address_components) {
                            if (comp.types.includes('locality') || comp.types.includes('sublocality') || comp.types.includes('postal_town') || comp.types.includes('administrative_area_level_3') || comp.types.includes('neighborhood')) {
                              if (!city) city = comp.long_name;
                            }
                            if (comp.types.includes('country')) {
                              if (!country) country = comp.long_name;
                            }
                          }
                        }
                        if (city && country) break;
                      }
                    }
                    if (city && country) {
                      label = `${city}, ${country}`;
                    } else {
                      label = city || country || 'Current Device Location';
                    }
                  } else {
                    // Fallback to BigDataCloud
                    const placeName = json.city || json.locality || json.principalSubdivision || '';
                    const country = json.countryName || '';
                    if (placeName && country) {
                      label = `${placeName}, ${country}`;
                    } else {
                      label = placeName || country || 'Current Device Location';
                    }
                  }

                  if (isMounted) {
                    setDeviceLocationName(label);
                  }
                })
                .catch(err => {
                  console.warn('Error reverse geocoding device coordinates:', err);
                });
            },
            (error) => {
              console.warn('Error getting device location for weather:', error);
              if (isMounted) {
                let msg = 'Position unavailable';
                if (error.code === 1) {
                  msg = 'Permission denied';
                } else if (error.code === 2) {
                  msg = 'Position unavailable';
                } else if (error.code === 3) {
                  msg = 'Timeout';
                }
                setDeviceCoordsError(msg);
                setDeviceCoordsLoading(false);
              }
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
          );
        } else {
          setDeviceCoordsError('Geolocation is not supported by this browser.');
        }
        return;
      }

      if (!coords) return;

      setWeatherLoading(true);
      try {
        const [lat, lng] = coords;
        // Open-Meteo free API
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min&hourly=precipitation_probability&timezone=auto&temperature_unit=fahrenheit`);
        const data = await res.json();
        if (isMounted) {
          setWeatherData(data);
          setWeatherLoading(false);
        }
      } catch (err) {
        console.error("Failed to fetch weather", err);
        if (isMounted) setWeatherLoading(false);
      }
    };
    fetchWeather();
    return () => { isMounted = false; };
  }, [weatherLocations, selectedLocId]);

  // Fetch GEE Weather Data
  useEffect(() => {
    let isMounted = true;
    const fetchGeeWeather = async () => {
      const loc = weatherLocations.find(l => l.id === selectedLocId);
      if (!loc || !loc.coords) return;

      setGeeWeatherLoading(true);
      setGeeWeatherError(null);
      try {
        const [lat, lng] = loc.coords;
        const polygon = [
          [lat - 0.005, lng - 0.005],
          [lat + 0.005, lng - 0.005],
          [lat + 0.005, lng + 0.005],
          [lat - 0.005, lng + 0.005]
        ];

        const response = await fetch('/api/gee/weather', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ polygon, dateOffset: 0, farmId: localStorage.getItem('activeFarmId') || 'default_farm', email: currentUser?.email })
        });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        if (isMounted) {
          setGeeWeatherData(data);
          setGeeWeatherLoading(false);
        }
      } catch (err) {
        console.error("Failed to fetch GEE weather forecast reanalysis:", err);
        if (isMounted) {
          setGeeWeatherError(err.message || 'Failed to fetch weather');
          setGeeWeatherLoading(false);
        }
      }
    };
    fetchGeeWeather();
    return () => { isMounted = false; };
  }, [weatherLocations, selectedLocId]);

  // Weather Code to Icon Mapper
  const getWeatherIcon = (code, temp, size = 24) => {
    if (code === 0) {
      if (temp && temp >= 90) return <ThermometerSun size={size} color="#d32f2f" />;
      return <Sun size={size} color="#f57c00" />;
    }
    if (code >= 1 && code <= 2) return <CloudSun size={size} color="#fbc02d" />;
    if (code === 3) return <Cloud size={size} color="#90a4ae" />;
    if (code >= 45 && code <= 48) return <CloudFog size={size} color="#78909c" />;
    if (code >= 51 && code <= 67) return <CloudRain size={size} color="#1e88e5" />;
    if (code >= 71 && code <= 82) return <CloudRain size={size} color="#1565c0" />; // Replaces snow with heavy tropical rain
    if (code >= 95 && code <= 99) return <CloudLightning size={size} color="#5e35b1" />;
    return <Sun size={size} color="#f57c00" />;
  };

  const getWeatherDescription = (code) => {
    if (code === 0) return 'Clear sky';
    if (code === 1) return 'Mainly clear';
    if (code === 2) return 'Partly cloudy';
    if (code === 3) return 'Overcast';
    if (code >= 45 && code <= 48) return 'Foggy';
    if (code >= 51 && code <= 55) return 'Drizzle';
    if (code >= 61 && code <= 67) return 'Rain';
    if (code >= 71 && code <= 82) return 'Heavy Rain'; // Replaces snow with heavy rain for tropical context
    if (code >= 95 && code <= 99) return 'Thunderstorm';
    return 'Unknown';
  };

  // Top-Level Metric Calculations
  const totalAcres = fields
    .filter(f => f.includeInStats !== false)
    .reduce((sum, f) => sum + (parseFloat(f.area) || 0), 0);
  const activeCrops = crops.filter(c => c.status !== 'Harvested/Completed');
  const activeLivestock = livestock.filter(l => l.healthStatus !== 'Deceased');

  const netGross = transactions.reduce((sum, tx) => {
    const val = parseFloat(tx.amount) || 0;
    return tx.txType === 'Sale' ? sum + val : sum - val;
  }, 0);

  // 1. Harvest by Day
  const harvestByDay = useMemo(() => {
    const map = {};
    const filteredHarvests = harvests.filter(h => {
      if (selectedCropIds.length > 0 && !selectedCropIds.includes(h.cropId)) return false;
      if (harvestFromDate && h.date < harvestFromDate) return false;
      if (harvestToDate && h.date > harvestToDate) return false;
      return true;
    });
    filteredHarvests.forEach(h => {
      const d = h.date || 'Unknown';
      if (!map[d]) map[d] = { date: d, yield: 0 };
      map[d].yield += parseFloat(h.amount) || 0;
    });
    return Object.values(map).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  }, [harvests, selectedCropIds, harvestFromDate, harvestToDate]);

  const cropsWithHarvests = useMemo(() => {
    const cropIds = new Set(harvests.map(h => h.cropId));
    return crops.filter(c => cropIds.has(c.id)).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [harvests, crops]);

  const cropSelectOptions = useMemo(() => cropsWithHarvests.map(c => ({
    value: c.id, label: `${c.name} ${c.variety ? `(${c.variety})` : ''}`
  })), [cropsWithHarvests]);

  const harvestReportData = useMemo(() => {
    const filteredHarvests = harvests.filter(h => {
      if (selectedCropIds.length > 0 && !selectedCropIds.includes(h.cropId)) return false;
      if (harvestFromDate && h.date < harvestFromDate) return false;
      if (harvestToDate && h.date > harvestToDate) return false;
      return true;
    });

    return filteredHarvests.map(h => {
      const crop = crops.find(c => c.id === h.cropId);
      const cropName = crop ? `${crop.name} ${crop.variety ? `(${crop.variety})` : ''}` : 'Unknown Crop';
      const relatedSales = transactions.filter(tx => tx.txType === 'Sale' && tx.assetId === h.id);
      const salesTotal = relatedSales.reduce((sum, tx) => sum + (parseFloat(tx.amount) || 0), 0);

      return {
        id: h.id,
        date: h.date || '-',
        cropName,
        amountText: `${h.amount || 0} ${h.unit || ''}`,
        amountValue: parseFloat(h.amount) || 0,
        salesTotal
      };
    }).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [harvests, crops, transactions, selectedCropIds, harvestFromDate, harvestToDate]);

  const totalHarvestAmount = harvestReportData.reduce((sum, h) => sum + h.amountValue, 0);
  const totalHarvestSales = harvestReportData.reduce((sum, h) => sum + h.salesTotal, 0);

  const reportColumns = [
    { key: 'date', header: 'Date' },
    { key: 'cropName', header: 'Crop Details' },
    { key: 'amountText', header: 'Quantity' },
    { key: 'salesTotal', header: 'Related Sales', render: (r) => r.salesTotal > 0 ? `$${r.salesTotal.toFixed(2)}` : '-' }
  ];

  // Financial Grouping Function (By 2 weeks)
  const getFortnight = (dateStr) => {
    if (!dateStr) return 'Unknown';
    const date = new Date(dateStr);
    const startOfYear = new Date(date.getFullYear(), 0, 1);
    const days = Math.floor((date - startOfYear) / (24 * 60 * 60 * 1000));
    const fortnight = Math.ceil(days / 14);
    return `${date.getFullYear()}-F${fortnight.toString().padStart(2, '0')}`;
  };

  const dashboardChartsData = useMemo(() => {
    const fortnightMap = {};
    const monthMap = {};
    const revCategoryMap = {};
    const expCategoryMap = {};

    transactions.forEach(tx => {
      const val = parseFloat(tx.amount) || 0;
      const fn = getFortnight(tx.date);
      const m = tx.date ? tx.date.substring(0, 7) : 'Unknown';
      const cat = tx.category || 'Other';

      if (!fortnightMap[fn]) fortnightMap[fn] = { time: fn, Revenue: 0, Expenses: 0 };
      if (!monthMap[m]) monthMap[m] = { time: m, Revenue: 0, Expenses: 0 };

      if (tx.txType === 'Sale' || tx.txType === 'Revenue') {
        fortnightMap[fn].Revenue += val;
        monthMap[m].Revenue += val;
        revCategoryMap[cat] = (revCategoryMap[cat] || 0) + val;
      } else {
        fortnightMap[fn].Expenses += val;
        monthMap[m].Expenses += val;
        expCategoryMap[cat] = (expCategoryMap[cat] || 0) + val;
      }
    });

    return {
      fortnightData: Object.values(fortnightMap).sort((a, b) => (a.time || '').localeCompare(b.time || '')),
      monthData: Object.values(monthMap).sort((a, b) => (a.time || '').localeCompare(b.time || '')),
      revPieData: Object.entries(revCategoryMap).map(([name, value]) => ({ name, value })),
      expPieData: Object.entries(expCategoryMap).map(([name, value]) => ({ name, value }))
    };
  }, [transactions]);

  const { fortnightData, monthData, revPieData, expPieData } = dashboardChartsData;

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658'];

  // Activities Feed
  const today = new Date().toISOString().split('T')[0];
  const sortedActivities = [...activities].sort((a, b) => {
    const dateA = a.plannedDate || a.date || '';
    const dateB = b.plannedDate || b.date || '';
    return (dateB || '').localeCompare(dateA || ''); // Descending
  });

  const getSeverity = (act) => {
    if (act.date) return { color: '#4caf50', title: 'Executed' }; // Green
    if (!act.plannedDate) return { color: '#9e9e9e', title: 'Unplanned' }; // Grey
    if (act.plannedDate >= today) return { color: '#ffeb3b', title: 'Upcoming' }; // Yellow
    if (act.plannedDate < today) return { color: '#f44336', title: 'Overdue' }; // Red
    return { color: '#9e9e9e', title: 'Unknown' };
  };

  const getTargetName = (id) => {
    if (!id) return '-';
    const crop = crops.find(c => c.id === id);
    if (crop) return `Crop: ${crop.name}`;
    const field = fields.find(f => f.id === id);
    if (field) return `Field: ${field.name}`;
    const bed = nurseries.find(n => n.id === id);
    if (bed) return `Nursery: ${bed.name}`;
    return id;
  };

  const incidentColumns = [
    { key: 'date', header: 'Date' },
    { key: 'title', header: 'Title' },
    { key: 'associatedAsset', header: 'Affected Asset', render: (r) => r.associatedAsset || '-' },
    {
      key: 'severity', header: 'Severity', render: (r) => (
        <span style={{
          color: r.severity === 'High' ? '#c62828' : r.severity === 'Medium' ? '#f57c00' : '#4caf50',
          fontWeight: 'bold'
        }}>{r.severity}</span>
      )
    },
    { key: 'resolutionStatus', header: 'Status' }
  ];

  const deadlineColumns = [
    { key: 'dueDate', header: 'Due Date' },
    { key: 'title', header: 'Title' },
    { key: 'type', header: 'Category' },
    { key: 'personResponsible', header: 'Responsible', render: (r) => r.personResponsible || '-' },
    {
      key: 'status', header: 'Status', render: (r) => (
        <span style={{ color: r.status === 'Overdue' ? '#c62828' : r.status === 'Resolved' ? '#2e7d32' : '#f57c00' }}>
          {r.status}
        </span>
      )
    }
  ];

  const renderForecastCard = (time, idx, date, isWeekend) => {
    if (!weatherData) return null;
    const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
    const dateString = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const weatherCode = weatherData.daily.weather_code[idx];
    const tempMax = Math.round(weatherData.daily.temperature_2m_max[idx]);
    const tempMin = Math.round(weatherData.daily.temperature_2m_min[idx]);
    const description = getWeatherDescription(weatherCode);

    const themeColor = isWeekend ? '#b58900' : '#1b5e20';
    const bgGradient = isWeekend
      ? 'linear-gradient(135deg, #fffcf4 0%, #fff9e6 100%)'
      : 'linear-gradient(135deg, #f7faf7 0%, #edf4ed 100%)';
    const ringBorder = isWeekend
      ? '2px solid rgba(181, 137, 0, 0.3)'
      : '2px solid rgba(27, 94, 32, 0.3)';

    let hourlyProbabilities = [];
    if (weatherData.hourly && weatherData.hourly.precipitation_probability) {
      hourlyProbabilities = weatherData.hourly.precipitation_probability.slice(idx * 24, (idx + 1) * 24);
    }
    if (hourlyProbabilities.length === 0) {
      hourlyProbabilities = Array(24).fill(0);
    }

    return (
      <div
        key={time}
        style={{
          flex: '1 1 140px',
          background: 'white',
          border: '1px solid #eef2f6',
          borderTop: `4px solid ${themeColor}`,
          borderRadius: '12px',
          padding: '16px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.04)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          gap: '8px',
          transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
          cursor: 'default',
          minHeight: '215px'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-3px)';
          e.currentTarget.style.boxShadow = '0 8px 16px rgba(0, 0, 0, 0.1)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'none';
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.04)';
        }}
      >
        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: themeColor, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {idx === 0 ? 'Today' : dayName}
        </div>
        <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '-4px', fontWeight: 500 }}>
          {dateString}
        </div>

        {showRainProbability ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', margin: '8px 0', flex: 1, justifyContent: 'center' }}>
            <svg width="108" height="60" style={{ overflow: 'visible' }}>
              {hourlyProbabilities.map((prob, i) => {
                const height = 50;
                const barWidth = 3;
                const gap = 1.5;
                const barHeight = (prob / 100) * height;
                const x = i * (barWidth + gap);
                const y = height - barHeight;
                const fillColor = `rgba(37, 99, 235, ${0.2 + (prob / 100) * 0.8})`;
                return (
                  <rect
                    key={i}
                    x={x}
                    y={y}
                    width={barWidth}
                    height={Math.max(barHeight, 1.5)}
                    rx="1"
                    fill={fillColor}
                  >
                    <title>{`${i}:00: ${prob}% rain chance`}</title>
                  </rect>
                );
              })}
            </svg>
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '108px', fontSize: '0.6rem', color: '#64748b', marginTop: '4px', fontWeight: 600 }}>
              <span>12A</span>
              <span>12P</span>
              <span>11P</span>
            </div>
            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#2563eb', marginTop: '8px' }}>
              Peak: {Math.max(...hourlyProbabilities)}%
            </div>
          </div>
        ) : (
          <>
            <div style={{
              width: '76px',
              height: '76px',
              borderRadius: '50%',
              background: bgGradient,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '8px 0',
              boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
              border: ringBorder
            }}>
              {getWeatherIcon(weatherCode, tempMax, 46)}
            </div>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e293b', minHeight: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {description}
            </div>
            <div style={{ display: 'flex', gap: '8px', fontSize: '0.95rem', marginTop: '4px', alignItems: 'center' }}>
              <span style={{ fontWeight: 800, color: '#dc2626' }}>{tempMax}°</span>
              <span style={{ color: '#cbd5e1', fontWeight: 300 }}>|</span>
              <span style={{ color: '#2563eb', fontWeight: 800 }}>{tempMin}°</span>
            </div>
          </>
        )}
      </div>
    );
  };

  const highConfCount = charcoalAlerts.filter(a => a.confidence === 'High').length;
  const clearingCount = charcoalAlerts.filter(a => a.confidence === 'Clearing').length;
  const thatchCount = charcoalAlerts.filter(a => a.confidence === 'Thatch Kitchen').length;
  const coalBayCount = charcoalAlerts.filter(a => a.confidence === 'Coal Bay').length;
  const lowConfCount = charcoalAlerts.filter(a => a.confidence === 'Low').length;
  const totalAnomalies = charcoalAlerts.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* 1. Global Metric Cards */}
      <div style={{ width: '100%' }}>
        <div className="metric-grid">
          <div className="metric-card">
            <div className="metric-card-icon" style={{ background: netGross >= 0 ? '#2e7d32' : '#d32f2f' }}><DollarSign size={20} /></div>
            <div className="metric-card-content">
              <div className="metric-card-title">NET BALANCE</div>
              <div className="metric-card-value">${netGross.toFixed(2)}</div>
            </div>
          </div>
          <div className="metric-card">
            <div className="metric-card-icon" style={{ background: '#1565c0' }}><Layers size={20} /></div>
            <div className="metric-card-content">
              <div className="metric-card-title">ACTIVE ACREAGE</div>
              <div className="metric-card-value">{totalAcres.toFixed(1)} ac</div>
            </div>
          </div>
          <div className="metric-card">
            <div className="metric-card-icon" style={{ background: '#f57c00' }}><Rabbit size={20} /></div>
            <div className="metric-card-content">
              <div className="metric-card-title">LIVESTOCK</div>
              <div className="metric-card-value">{activeLivestock.length}</div>
            </div>
          </div>
          <div className="metric-card">
            <div className="metric-card-icon" style={{ background: '#6a1b9a' }}><TrendingUp size={20} /></div>
            <div className="metric-card-content">
              <div className="metric-card-title">CROPS</div>
              <div className="metric-card-value">{activeCrops.length}</div>
            </div>
          </div>

          {totalAnomalies > 0 && (
            <div className="anomalies-dashboard-card">
              {/* Left Side Total Stats */}
              <div className="anomalies-stats-container">
                <div className="anomalies-main-icon-container">
                  <AlertOctagon size={24} color="white" />
                </div>
                <div>
                  <div className="anomalies-title">DETECTED ANOMALIES</div>
                  <div className="anomalies-value-row">
                    <div className="anomalies-value">{totalAnomalies}</div>
                    <span className="anomalies-subtitle">Active alerts require verification</span>
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div className="anomalies-card-divider" />

              {/* Right Side Categories Grid */}
              <div className="anomalies-categories-grid">
                {highConfCount > 0 && (
                  <div className="anomalies-category-item">
                    <div style={{ background: '#fecaca', borderRadius: '8px', padding: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <AlertOctagon size={22} color="#ef4444" />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '600' }}>High Conf</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: '700', color: '#ef4444' }}>{highConfCount}</div>
                    </div>
                  </div>
                )}
                {clearingCount > 0 && (
                  <div className="anomalies-category-item">
                    <div style={{ background: '#dcfce7', borderRadius: '8px', padding: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Trees size={22} color="#22c55e" />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '600' }}>Clearings</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: '700', color: '#22c55e' }}>{clearingCount}</div>
                    </div>
                  </div>
                )}
                {thatchCount > 0 && (
                  <div className="anomalies-category-item">
                    <div style={{ background: '#fdf2ff', borderRadius: '8px', padding: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Home size={22} color="#d946ef" />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '600' }}>Thatch Kitchens</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: '700', color: '#d946ef' }}>{thatchCount}</div>
                    </div>
                  </div>
                )}
                {coalBayCount > 0 && (
                  <div className="anomalies-category-item">
                    <div style={{ background: '#f3f4f6', borderRadius: '8px', padding: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Flame size={22} color="#374151" />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '600' }}>Coal Bays</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: '700', color: '#374151' }}>{coalBayCount}</div>
                    </div>
                  </div>
                )}
                {lowConfCount > 0 && (
                  <div className="anomalies-category-item">
                    <div style={{ background: '#fef3c7', borderRadius: '8px', padding: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <AlertTriangle size={22} color="#f59e0b" />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '600' }}>Low Conf</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: '700', color: '#f59e0b' }}>{lowConfCount}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Relocated Alerts (arranged horizontally below metrics row) */}
      {effectiveGeeWeatherData && (
        <div style={{ display: 'flex', flexDirection: 'row', gap: '12px', flexWrap: 'wrap', width: '100%', marginBottom: '10px' }}>
          {(() => {
            const alerts = [];
            const w = effectiveGeeWeatherData;

            // 1. Spraying Advisory
            if (w.windSpeed > 5.0) {
              alerts.push({
                type: 'warning',
                title: 'Spraying Advisory',
                text: `High wind drift risk (${Math.round(w.windSpeed * 3.6)} km/h / ${w.windSpeed} m/s). Avoid chemical spraying.`,
                color: '#e65100',
                bg: '#fff8e1'
              });
            } else if (w.windSpeed < 1.0) {
              alerts.push({
                type: 'warning',
                title: 'Spraying Advisory',
                text: `Calm wind (${Math.round(w.windSpeed * 3.6)} km/h / ${w.windSpeed} m/s). Risk of thermal inversion drift.`,
                color: '#d84315',
                bg: '#fbe9e7'
              });
            } else {
              alerts.push({
                type: 'success',
                title: 'Spraying Advisory',
                text: `Optimal spraying window (${Math.round(w.windSpeed * 3.6)} km/h).`,
                color: '#2e7d32',
                bg: '#e8f5e9'
              });
            }

            // 2. Precipitation
            if (w.precipitation > 0.1) {
              alerts.push({
                type: 'info',
                title: 'Precipitation Active',
                text: `Rain (${w.precipitation} mm/h) detected. Pause scheduled irrigation.`,
                color: '#1565c0',
                bg: '#e3f2fd'
              });
            }

            // 3. Disease Risk
            if (w.humidity > 85.0 && w.temperature >= 18.0 && w.temperature <= 28.0) {
              alerts.push({
                type: 'danger',
                title: 'Disease Risk',
                text: `Humid & warm conditions favor fungal / mildew growth.`,
                color: '#c62828',
                bg: '#ffebee'
              });
            }

            return alerts.map((alert, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  padding: '12px 14px',
                  borderRadius: '8px',
                  background: alert.bg,
                  borderLeft: `5px solid ${alert.color}`,
                  borderTop: '1px solid rgba(0,0,0,0.03)',
                  borderRight: '1px solid rgba(0,0,0,0.03)',
                  borderBottom: '1px solid rgba(0,0,0,0.03)',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
                  flex: '1 1 280px',
                  minWidth: '280px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {alert.type === 'danger' && <AlertCircle size={26} color={alert.color} style={{ flexShrink: 0 }} />}
                  {alert.type === 'warning' && <AlertTriangle size={26} color={alert.color} style={{ flexShrink: 0 }} />}
                  {alert.type === 'success' && <ShieldCheck size={26} color={alert.color} style={{ flexShrink: 0 }} />}
                  {alert.type === 'info' && <Info size={26} color={alert.color} style={{ flexShrink: 0 }} />}
                  <strong style={{ fontSize: '1.02rem', fontWeight: 800, color: alert.color }}>
                    {alert.title}
                  </strong>
                </div>
                <div style={{ color: '#4b5563', fontSize: '0.72rem', lineHeight: 1.45, paddingLeft: '34px', fontWeight: 500 }}>
                  {alert.text}
                </div>
              </div>
            ));
          })()}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0px' }}>
        {/* Sub-Tabs Selector */}
        <div
          className="hide-scrollbar"
          style={{
            display: 'flex',
            gap: '4px',
            background: '#e2e8f0',
            padding: '5px',
            borderRadius: '10px',
            width: '100%',
            flexWrap: 'nowrap',
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
            marginBottom: '0px'
          }}
        >
          {[
            { key: 'weather', label: 'WEATHER' },
            { key: 'assignments', label: 'ASSIGNMENTS' },
            { key: 'incidents', label: 'INCIDENTS' },
            { key: 'deadlines', label: 'DEADLINES' },
            { key: 'harvests', label: 'HARVESTS' },
            { key: 'financials', label: 'FINANCIALS' }
          ].map(tab => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveDashboardTab(tab.key)}
              style={{
                flex: '1 0 auto',
                padding: '12px 20px',
                minHeight: '48px',
                borderRadius: '8px',
                border: 'none',
                background: activeDashboardTab === tab.key ? 'white' : 'transparent',
                color: activeDashboardTab === tab.key ? '#1b5e20' : '#475569',
                fontFamily: "'Montserrat', -apple-system, sans-serif",
                fontWeight: 800,
                fontSize: '0.95rem',
                textTransform: 'uppercase',
                letterSpacing: '0.6px',
                boxShadow: activeDashboardTab === tab.key ? '0 2px 6px rgba(0,0,0,0.08)' : 'none',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                justify: 'center'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Agricultural Impact Analysis (placed globally below the sub-tabs selector) */}
        {(() => {
          if (!effectiveGeeWeatherData) return null;
          const alerts = [];
          const w = effectiveGeeWeatherData;

          if (w.windSpeed > 15.0) {
            alerts.push({
              type: 'danger',
              title: 'Severe High Winds Warning',
              text: `Dangerous winds detected (${Math.round(w.windSpeed * 3.6)} km/h / ${w.windSpeed} m/s). High risk of crop flattening, nursery damage, and minor structural damage. Secure covers and loose gear.`,
              color: '#c62828',
              bg: '#ffebee'
            });
          }

          if (w.temperature < 2.0) {
            alerts.push({
              type: 'danger',
              title: 'Frost Alert',
              text: `Low temp (${Math.round(w.temperature * 1.8 + 32)}°F / ${w.temperature}°C). Cover sensitive crops & nurseries.`,
              color: '#c62828',
              bg: '#ffebee'
            });
          } else if (w.temperature > 32.0) {
            alerts.push({
              type: 'danger',
              title: 'Heat Alert',
              text: `High temp (${Math.round(w.temperature * 1.8 + 32)}°F / ${w.temperature}°C). Elevate crop irrigation frequency.`,
              color: '#c62828',
              bg: '#ffebee'
            });
          }

          if (w.humidity < 35.0) {
            alerts.push({
              type: 'warning',
              title: 'Dry Air Alert',
              text: `Humidity is low (${w.humidity}%). Monitor soil moisture profiles.`,
              color: '#e65100',
              bg: '#fff8e1'
            });
          }

          if (alerts.length === 0) return null;

          return (
            <div style={{ display: 'flex', flexDirection: 'row', gap: '12px', flexWrap: 'wrap', width: '100%', marginBottom: '20px' }}>
              {alerts.map((alert, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    padding: '12px 14px',
                    borderRadius: '8px',
                    background: alert.bg,
                    borderLeft: `5px solid ${alert.color}`,
                    borderTop: '1px solid rgba(0,0,0,0.03)',
                    borderRight: '1px solid rgba(0,0,0,0.03)',
                    borderBottom: '1px solid rgba(0,0,0,0.03)',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
                    flex: '1 1 280px',
                    minWidth: '280px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {alert.type === 'danger' && <AlertCircle size={26} color={alert.color} style={{ flexShrink: 0 }} />}
                    {alert.type === 'warning' && <AlertTriangle size={26} color={alert.color} style={{ flexShrink: 0 }} />}
                    {alert.type === 'success' && <ShieldCheck size={26} color={alert.color} style={{ flexShrink: 0 }} />}
                    {alert.type === 'info' && <Info size={26} color={alert.color} style={{ flexShrink: 0 }} />}
                    <strong style={{ fontSize: '1.02rem', fontWeight: 800, color: alert.color }}>
                      {alert.title}
                    </strong>
                  </div>
                  <div style={{ color: '#4b5563', fontSize: '0.72rem', lineHeight: 1.45, paddingLeft: '34px', fontWeight: 500 }}>
                    {alert.text}
                  </div>
                </div>
              ))}
            </div>
          );
        })()}

        {activeDashboardTab === 'weather' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Weather Forecast Widget */}
            <CollapsibleCard title="Current Weather & Forecast">
              {/* Tab Controls and Location Selector */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '20px', borderBottom: '1px solid #eef2f6', paddingBottom: '12px' }}>
                <div style={{ display: 'flex', gap: '4px', background: '#f1f5f9', padding: '4px', borderRadius: '8px' }}>
                  <button
                    onClick={() => setActiveWeatherTab('current')}
                    style={{
                      padding: '6px 16px',
                      borderRadius: '6px',
                      border: 'none',
                      background: activeWeatherTab === 'current' ? 'white' : 'transparent',
                      color: activeWeatherTab === 'current' ? '#2e7d32' : '#64748b',
                      fontWeight: 600,
                      fontSize: '0.875rem',
                      boxShadow: activeWeatherTab === 'current' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    Current Conditions
                  </button>
                  <button
                    onClick={() => setActiveWeatherTab('forecast')}
                    style={{
                      padding: '6px 16px',
                      borderRadius: '6px',
                      border: 'none',
                      background: activeWeatherTab === 'forecast' ? 'white' : 'transparent',
                      color: activeWeatherTab === 'forecast' ? '#2e7d32' : '#64748b',
                      fontWeight: 600,
                      fontSize: '0.875rem',
                      boxShadow: activeWeatherTab === 'forecast' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    Forecast
                  </button>
                </div>
                <select
                  value={selectedLocId}
                  onChange={(e) => setSelectedLocId(e.target.value)}
                  style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #ccc', background: 'white', fontWeight: 600, color: 'var(--color-primary-dark)', cursor: 'pointer' }}
                >
                  {weatherLocations.map((loc) => (
                    <option key={loc.id} value={loc.id}>{loc.label}</option>
                  ))}
                </select>
              </div>

              {deviceCoordsError ? (
                <div style={{
                  textAlign: 'center',
                  padding: '30px 20px',
                  color: '#c62828',
                  background: '#ffebee',
                  borderRadius: '8px',
                  margin: '20px 0',
                  border: '1px solid rgba(198, 40, 40, 0.2)'
                }}>
                  <span style={{ display: 'inline-block', marginRight: '8px', fontSize: '1.2rem' }}>⚠️</span>
                  <strong style={{ display: 'block', marginBottom: '4px' }}>Geolocation Failed</strong>
                  <span style={{ fontSize: '0.85rem' }}>Error details: {deviceCoordsError}. Please ensure location services and browser permissions are enabled.</span>
                </div>
              ) : deviceCoordsLoading ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#888' }}>
                  <span style={{ display: 'inline-block', marginRight: '8px' }}>⌛</span>
                  Retrieving device GPS location...
                </div>
              ) : weatherLoading ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#888' }}>Loading weather data...</div>
              ) : weatherData && weatherData.current ? (
                activeWeatherTab === 'current' ? (
                  <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
                    {/* Agricultural Advisory */}
                    <div style={{
                      flex: '1 1 100%',
                      maxWidth: '800px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '16px',
                      background: 'white',
                      border: '1px solid #eef2f6',
                      borderTop: '4px solid #1b5e20',
                      borderRadius: '12px',
                      padding: '20px',
                      color: '#1e293b',
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.04)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #eef2f6', paddingBottom: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px', borderRadius: '50%', background: '#e8f5e9', color: '#1b5e20' }}>
                            <ShieldCheck size={24} />
                          </span>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1b5e20' }}>Agricultural Advisory</span>
                            <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>NOAA GFS Reanalysis & Alerts</span>
                          </div>
                        </div>
                        {effectiveGeeWeatherData && (
                          <span style={{ fontSize: '0.6rem', background: effectiveGeeWeatherData.isSimulated ? '#fff3e0' : '#e8f5e9', padding: '2px 6px', borderRadius: '4px', color: effectiveGeeWeatherData.isSimulated ? '#e65100' : '#2e7d32', fontWeight: 600 }}>
                            {effectiveGeeWeatherData.isSimulated ? 'Simulated' : 'Verified GEE'}
                          </span>
                        )}
                      </div>

                      {effectiveGeeWeatherLoading ? (
                        <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', padding: '40px 0', fontSize: '0.85rem', color: '#888' }}>
                          Fetching GEE weather & agricultural alerts...
                        </div>
                      ) : effectiveGeeWeatherData ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                          {/* Weather Metrics Grid */}
                          <div className="weather-advisory-metrics-container">
                            {/* Temp Card */}
                            <div className="weather-metric-card-item" style={{ border: '1px solid #ffcc80', boxShadow: '0 2px 8px rgba(230,81,0,0.03)' }}>
                              <Thermometer size={32} color="#e65100" />
                              <span style={{ fontSize: '0.75rem', color: '#8c3d00', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Temp</span>
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.1 }}>
                                <span style={{ fontSize: '1rem', fontWeight: 800, color: '#e65100' }}>{Math.round(effectiveGeeWeatherData.temperature * 1.8 + 32)}°F</span>
                                <span style={{ fontSize: '0.75rem', color: '#757575', fontWeight: 500 }}>{effectiveGeeWeatherData.temperature}°C</span>
                              </div>
                            </div>

                            {/* Rain Card */}
                            <div className="weather-metric-card-item" style={{ border: '1px solid #90caf9', boxShadow: '0 2px 8px rgba(21,101,192,0.03)' }}>
                              <CloudRain size={32} color="#1565c0" />
                              <span style={{ fontSize: '0.75rem', color: '#0d47a1', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Rain</span>
                              <span style={{ fontSize: '1rem', fontWeight: 800, color: '#1565c0' }}>{effectiveGeeWeatherData.precipitation} mm</span>
                            </div>

                            {/* Wind Card */}
                            <div className="weather-metric-card-item" style={{ border: '1px solid #81d4fa', boxShadow: '0 2px 8px rgba(2,136,209,0.03)' }}>
                              <Wind size={32} color="#0288d1" />
                              <span style={{ fontSize: '0.75rem', color: '#01579b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Wind</span>
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.1 }}>
                                <span style={{ fontSize: '1rem', fontWeight: 800, color: '#0288d1' }}>{Math.round(effectiveGeeWeatherData.windSpeed * 3.6)} km/h</span>
                                <span style={{ fontSize: '0.75rem', color: '#757575', fontWeight: 500 }}>{effectiveGeeWeatherData.windSpeed} m/s</span>
                              </div>
                            </div>

                            {/* Humidity Card */}
                            <div className="weather-metric-card-item" style={{ border: '1px solid #80deea', boxShadow: '0 2px 8px rgba(0,172,193,0.03)' }}>
                              <Droplet size={32} color="#00acc1" />
                              <span style={{ fontSize: '0.75rem', color: '#006064', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Humidity</span>
                              <span style={{ fontSize: '1rem', fontWeight: 800, color: '#00acc1' }}>{effectiveGeeWeatherData.humidity}%</span>
                            </div>

                            {/* Clouds Card */}
                            <div className="weather-metric-card-item" style={{ border: '1px solid #b0bec5', boxShadow: '0 2px 8px rgba(84,110,122,0.03)' }}>
                              <Cloud size={32} color="#546e7a" />
                              <span style={{ fontSize: '0.75rem', color: '#263238', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Clouds</span>
                              <span style={{ fontSize: '1rem', fontWeight: 800, color: '#546e7a' }}>{effectiveGeeWeatherData.clouds}%</span>
                            </div>
                          </div>

                          {/* Expected Time & Duration Banner */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', background: 'white', padding: '12px 16px', borderRadius: '10px', border: '1px solid #eef2f6', boxShadow: '0 1px 3px rgba(0,0,0,0.02)', flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1 1 200px' }}>
                              <Clock size={16} color="#1b5e20" style={{ flexShrink: 0 }} />
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 600 }}>Expected Forecast Time</span>
                                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1e293b' }}>{effectiveGeeWeatherData.dateStr}</span>
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1 1 120px', borderLeft: '1px solid #e2e8f0', paddingLeft: '16px' }}>
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 600 }}>Duration</span>
                                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1e293b' }}>{effectiveGeeWeatherData.duration}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div style={{ color: '#c62828', fontSize: '0.8rem', padding: '10px 0' }}>
                          Failed to load NOAA GFS advisories.
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  /* 7-Day Forecast Tab: Sequential Date Order */
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6px', borderRadius: '50%', background: '#e8f5e9', color: '#1b5e20' }}>
                          <ThermometerSun size={18} />
                        </span>
                        <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#1b5e20', margin: 0 }}>
                          7-Day Weather Forecast
                        </h4>
                      </div>

                      <button
                        type="button"
                        onClick={() => setShowRainProbability(!showRainProbability)}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '6px',
                          border: '1px solid #c8e6c9',
                          background: showRainProbability ? '#e8f5e9' : 'white',
                          color: '#1b5e20',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <CloudRain size={14} />
                        {showRainProbability ? 'Hide Rain Chance' : 'Show Rain Chance'}
                      </button>
                    </div>
                    <div style={{ flex: 1, height: '2px', background: 'linear-gradient(to right, #c8e6c9, transparent)', marginTop: '-8px', marginBottom: '8px' }}></div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', width: '100%' }}>
                      {(() => {
                        const items = [];
                        weatherData.daily?.time?.forEach((time, idx) => {
                          const parts = time.split('-');
                          const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
                          const dayOfWeek = date.getDay();
                          const isWeekend = dayOfWeek === 0 || dayOfWeek === 5 || dayOfWeek === 6;
                          items.push(renderForecastCard(time, idx, date, isWeekend));
                        });
                        return items.length > 0 ? items : (
                          <div style={{ fontSize: '0.85rem', color: '#64748b', fontStyle: 'italic', padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #e2e8f0', width: '100%', textAlign: 'center' }}>
                            No forecast days available.
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                )
              ) : (
                <div style={{ textAlign: 'center', padding: '20px', color: '#f44336' }}>Failed to load weather data.</div>
              )}
            </CollapsibleCard>
          </div>
        )}

        {activeDashboardTab === 'assignments' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0px' }}>

            {/* Top-level view selector */}
            <div
              className="hide-scrollbar"
              style={{
                display: 'flex',
                gap: '0px',
                marginBottom: '0px',
                background: '#f1f5f9',
                padding: '4px',
                borderRadius: '8px',
                width: '100%',
                overflowX: 'auto',
                WebkitOverflowScrolling: 'touch'
              }}
            >
              {[
                { key: 'assignments_view', label: 'ASSIGNMENTS VIEW' },
                { key: 'tree', label: 'PLANNING TREE VIEW' },
                { key: 'board', label: 'PROJECT BOARD VIEW' },
                { key: 'taskList', label: 'PROJECT TASK LIST' }
              ].map(tab => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setPrimaryView(tab.key)}
                  style={{
                    flex: '1 0 auto',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: 'none',
                    background: primaryView === tab.key ? 'white' : 'transparent',
                    color: primaryView === tab.key ? 'var(--color-primary)' : '#475569',
                    fontFamily: "'Montserrat', -apple-system, sans-serif",
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    boxShadow: primaryView === tab.key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    cursor: 'pointer',
                    fontSize: '0.82rem',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {primaryView === 'assignments_view' && (
              <CollapsibleCard title="Assignments Progress" forceFullGrid>
                {(() => {
                  const sortedActivePlanAssignments = [...assignments].sort((a, b) => (b.assignmentDate || '').localeCompare(a.assignmentDate || ''));

                  const totalTasks = sortedActivePlanAssignments.length;
                  const totalHours = sortedActivePlanAssignments.reduce((sum, a) => sum + (parseFloat(a.hours) || 0), 0);
                  const totalCost = sortedActivePlanAssignments.reduce((sum, a) => sum + getAssignmentCost(a), 0);

                  const hasApprovalPermission = currentUser?.role === 'Admin' || currentUser?.canApprove;

                  if (totalTasks === 0) {
                    return (
                      <div style={{ padding: '20px', textAlign: 'center', color: '#64748b', fontStyle: 'italic' }}>
                        No active tasks associated with active goals or objectives found.
                      </div>
                    );
                  }

                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                      {/* Summary row */}
                      <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
                        <div style={{ padding: '8px 16px', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0', color: '#166534', fontSize: '0.9rem', fontWeight: 600 }}>
                          Active Tasks: {totalTasks}
                        </div>
                        <div style={{ padding: '8px 16px', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0', color: '#166534', fontSize: '0.9rem', fontWeight: 600 }}>
                          Total Hours Spent: {totalHours.toFixed(1)} hrs
                        </div>
                        <div style={{ padding: '8px 16px', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0', color: '#166534', fontSize: '0.9rem', fontWeight: 600 }}>
                          Total Money Spent: ${totalCost.toFixed(2)}
                        </div>
                      </div>

                      {/* Flat table */}
                      <div style={{ overflowX: 'auto', margin: '0 -20px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '900px' }}>
                          <thead>
                            <tr style={{ background: '#f5f7fa', borderBottom: '2px solid var(--color-border-light)' }}>
                              <th style={{ padding: '12px 16px', color: '#475569', fontSize: '0.85rem', verticalAlign: 'bottom', textTransform: 'uppercase', fontWeight: 700 }}></th>
                              <th style={{ padding: '12px 16px', color: '#475569', fontSize: '0.85rem', verticalAlign: 'bottom', textTransform: 'uppercase', fontWeight: 700, whiteSpace: 'nowrap', minWidth: '130px' }}>Health</th>
                              <th style={{ padding: '12px 16px', color: '#475569', fontSize: '0.85rem', verticalAlign: 'bottom', whiteSpace: 'nowrap' }}>STATUS</th>
                              <th style={{ padding: '12px 16px', color: '#475569', fontSize: '0.85rem', verticalAlign: 'bottom', textTransform: 'uppercase', fontWeight: 700, width: '180px', minWidth: '180px', whiteSpace: 'nowrap' }}>Approval</th>
                              <th style={{ padding: '12px 16px', color: '#475569', fontSize: '0.85rem', verticalAlign: 'bottom', textTransform: 'uppercase', fontWeight: 700, width: '220px', minWidth: '220px', maxWidth: '220px' }}>Tasks</th>
                              <th style={{ padding: '12px 16px', color: '#475569', fontSize: '0.85rem', verticalAlign: 'bottom', textTransform: 'uppercase', fontWeight: 700, whiteSpace: 'nowrap' }}>Target</th>
                              <th style={{ padding: '12px 16px', color: '#475569', fontSize: '0.85rem', verticalAlign: 'bottom', textTransform: 'uppercase', fontWeight: 700, whiteSpace: 'nowrap' }}>Est. Hrs</th>
                              <th style={{ padding: '12px 16px', color: '#475569', fontSize: '0.85rem', verticalAlign: 'bottom', textTransform: 'uppercase', fontWeight: 700 }}>STARTED</th>
                              <th style={{ padding: '12px 16px', color: '#475569', fontSize: '0.85rem', verticalAlign: 'bottom', whiteSpace: 'nowrap' }}>COMPLETED</th>
                              <th style={{ padding: '12px 16px', color: '#1e293b', fontWeight: 500, verticalAlign: 'bottom' }}>HRS</th>
                              <th style={{ padding: '12px 16px', color: '#1e293b', fontWeight: 600, verticalAlign: 'bottom' }}>$$</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sortedActivePlanAssignments.map(ass => {
                              const assProgress = ass.completedDate ? 100 : 0;
                              const assHours = parseFloat(ass.hours) || 0;
                              const assCost = getAssignmentCost(ass);
                              const reviewText = ass.reviewStatus || 'Pending Review';
                              const assStatus = ass.completedDate ? `Completed (${reviewText})` : `In Progress`;
                              let assBg = '#fff3e0';
                              let assFg = '#e65100';
                              if (ass.completedDate) {
                                if (reviewText === 'Complete' || reviewText === 'Satisfactory') {
                                  assBg = '#e8f5e9';
                                  assFg = '#2e7d32';
                                } else if (reviewText === 'Not Complete') {
                                  assBg = '#ffebee';
                                  assFg = '#c62828';
                                }
                              } else {
                                assBg = '#e3f2fd';
                                assFg = '#1565c0';
                              }

                              const planGoal = goals.find(g => g.id === ass.planningId);
                              const planObj = planGoal ? null : objectives.find(o => o.id === ass.planningId);
                              const plan = planGoal || planObj;
                              const planEstHours = plan ? (parseFloat(plan.estimatedHours) || 0) : 0;

                              let isExceedingEstimate = false;
                              let isOverdue = false;
                              if (plan) {
                                const planAssignments = assignments.filter(a => a.planningId === plan.id);
                                const totalPlanHours = planAssignments.reduce((sum, a) => sum + (parseFloat(a.hours) || 0), 0);
                                if (planEstHours > 0 && totalPlanHours > planEstHours) {
                                  isExceedingEstimate = true;
                                }

                                const todayStr = new Date().toISOString().split('T')[0];
                                if (plan.toDate && todayStr > plan.toDate && !plan.completionDate) {
                                  isOverdue = true;
                                }
                              }

                              return (
                                <tr key={ass.id} style={{ borderBottom: '1px solid #e2e8f0', background: '#ffffff', verticalAlign: 'top' }}>
                                  <td style={{ padding: '12px 16px', color: '#1e293b', fontWeight: 800, fontSize: '1.1rem', verticalAlign: 'top' }}>
                                    {assProgress}%
                                  </td>
                                  <td style={{ padding: '12px 16px', verticalAlign: 'top' }}>
                                    {!plan ? '-' : (
                                      isExceedingEstimate && isOverdue ? (
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#c62828', fontWeight: 800, fontSize: '1.1rem' }} title="Exceeds estimated hours & past due date">
                                          <AlertTriangle size={18} color="#c62828" /> Critical
                                        </span>
                                      ) : isExceedingEstimate ? (
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#ef6c00', fontWeight: 800, fontSize: '1.1rem' }} title="Total spent hours exceed estimate">
                                          <AlertTriangle size={18} color="#ef6c00" /> Over Hours
                                        </span>
                                      ) : isOverdue ? (
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#c62828', fontWeight: 800, fontSize: '1.1rem' }} title="Past planned complete date">
                                          <AlertCircle size={18} color="#c62828" /> Overdue
                                        </span>
                                      ) : (
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#2e7d32', fontWeight: 800, fontSize: '1.1rem' }} title="On schedule and within estimate">
                                          <ShieldCheck size={18} color="#2e7d32" /> On Track
                                        </span>
                                      )
                                    )}
                                  </td>
                                  <td style={{ padding: '12px 16px', verticalAlign: 'top' }}>
                                    <span className="status-indicator" style={{
                                      background: assBg,
                                      color: assFg,
                                      fontWeight: 600,
                                      fontSize: '0.8rem'
                                    }}>
                                      {assStatus}
                                    </span>
                                  </td>
                                  <td style={{ padding: '12px 16px', width: '180px', minWidth: '180px', verticalAlign: 'top' }}>
                                    <select
                                      value={ass.reviewStatus || 'Pending Review'}
                                      disabled={!hasApprovalPermission}
                                      onChange={(e) => {
                                        const newStatus = e.target.value;
                                        const updatedAss = { ...ass, reviewStatus: newStatus };
                                        dispatch(saveAssignment(updatedAss));
                                      }}
                                      style={{
                                        width: '100%',
                                        padding: '6px 10px',
                                        fontSize: '0.8rem',
                                        borderRadius: '4px',
                                        border: '1px solid #cbd5e1',
                                        background: hasApprovalPermission ? '#fff' : '#f1f5f9',
                                        color: '#334155',
                                        fontWeight: 500,
                                        cursor: hasApprovalPermission ? 'pointer' : 'not-allowed'
                                      }}
                                    >
                                      <option value="Pending Review">Pending Review</option>
                                      <option value="Complete">Complete</option>
                                      <option value="Satisfactory">Satisfactory</option>
                                      <option value="Not Complete">Not Complete</option>
                                    </select>
                                  </td>
                                  <td style={{ padding: '12px 16px', width: '220px', minWidth: '220px', maxWidth: '220px', verticalAlign: 'top' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', wordBreak: 'break-word', whiteSpace: 'normal' }}>
                                      <span style={{ fontWeight: 600, color: '#1e293b' }}>{ass.task}</span>
                                      <span style={{ color: '#64748b', fontSize: '0.8rem' }}>Assigned: {ass.workers || renderWorkerNames(ass.workerIds)}</span>
                                    </div>
                                  </td>
                                  <td style={{ padding: '12px 16px', color: '#475569', fontSize: '0.85rem', fontWeight: 500, verticalAlign: 'top' }}>
                                    {getTargetName(ass.fieldId)}
                                  </td>
                                  <td style={{ padding: '12px 16px', color: '#1e293b', fontWeight: 500, verticalAlign: 'top' }}>
                                    {planEstHours > 0 ? `${planEstHours.toFixed(1)} hrs` : '-'}
                                  </td>
                                  <td style={{ padding: '12px 16px', color: '#475569', fontSize: '0.85rem', whiteSpace: 'nowrap', verticalAlign: 'top' }}>{ass.assignmentDate || '-'}</td>
                                  <td style={{ padding: '12px 16px', color: '#475569', fontSize: '0.85rem', whiteSpace: 'nowrap', verticalAlign: 'top' }}>{ass.completedDate || '-'}</td>
                                  <td style={{ padding: '12px 16px', color: '#1e293b', fontWeight: 500, verticalAlign: 'top' }}>{assHours > 0 ? `${assHours.toFixed(1)} hrs` : '-'}</td>
                                  <td style={{ padding: '12px 16px', color: '#1e293b', fontWeight: 600, verticalAlign: 'top' }}>{assCost > 0 ? `$${assCost.toFixed(2)}` : '-'}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })()}
              </CollapsibleCard>
            )}

            {primaryView === 'tree' && (
              <CollapsibleCard title="Planning Tree View" forceFullGrid>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div>
                    <h4 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', color: '#166534', borderBottom: '1px solid #dcfce7', paddingBottom: '4px' }}>Goals & Objectives Hierarchy</h4>
                    {renderGoalsTree('')}
                  </div>
                  <div>
                    <h4 style={{ margin: '10px 0 10px 0', fontSize: '0.9rem', color: '#075985', borderBottom: '1px solid #e0f2fe', paddingBottom: '4px' }}>Unparented Objectives</h4>
                    {renderObjectivesTree()}
                  </div>
                </div>
              </CollapsibleCard>
            )}

            {primaryView === 'board' && (
              <CollapsibleCard title="Project Board View" forceFullGrid>
                {renderProjectBoard()}
              </CollapsibleCard>
            )}

            {primaryView === 'taskList' && (
              <CollapsibleCard title="Project Task List" forceFullGrid>
                {renderProjectTaskList()}
              </CollapsibleCard>
            )}

          </div>
        )}

        {activeDashboardTab === 'incidents' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Incidents Feed Table */}
            <CollapsibleCard title="Active Incidents & Issues" forceFullGrid>
              <CrudTable
                data={[...incidents].sort((a, b) => (b.date || '').localeCompare(a.date || ''))}
                columns={incidentColumns}
                itemLabel="Incident"
                hideTitle
              />
            </CollapsibleCard>
          </div>
        )}

        {activeDashboardTab === 'deadlines' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Deadlines Feed Table */}
            <CollapsibleCard title="Upcoming Deadlines" forceFullGrid>
              <CrudTable
                data={[...deadlines].sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''))}
                columns={deadlineColumns}
                itemLabel="Deadline"
                hideTitle
                rowStyle={(row) => ({ opacity: row.status === 'Resolved' ? 0.6 : 1 })}
              />
            </CollapsibleCard>
          </div>
        )}

        {activeDashboardTab === 'harvests' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Harvests */}
            <CollapsibleCard title="Harvests" forceFullGrid>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', padding: '15px', background: '#f5f7fa', borderRadius: '8px' }}>
                <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <label style={{ fontWeight: 600, fontSize: '0.9rem', color: '#555' }}>From:</label>
                    <input type="date" value={harvestFromDate} onChange={e => setHarvestFromDate(e.target.value)} style={{ padding: '6px', borderRadius: '4px', border: '1px solid #ccc' }} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <label style={{ fontWeight: 600, fontSize: '0.9rem', color: '#555' }}>To:</label>
                    <input type="date" value={harvestToDate} onChange={e => setHarvestToDate(e.target.value)} style={{ padding: '6px', borderRadius: '4px', border: '1px solid #ccc' }} />
                  </div>
                  <div style={{ minWidth: '200px', flex: '1 1 200px' }}>
                    <Select
                      isMulti
                      placeholder="Filter by specific crops..."
                      options={cropSelectOptions}
                      value={cropSelectOptions.filter(opt => selectedCropIds.includes(opt.value))}
                      onChange={(opts) => setSelectedCropIds(opts ? opts.map(o => o.value) : [])}
                      styles={{ control: (base) => ({ ...base, minHeight: '36px' }) }}
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', background: '#e0e0e0', padding: '4px', borderRadius: '6px' }}>
                  <button onClick={() => setHarvestViewToggle('graph')} style={{ padding: '6px 16px', border: 'none', borderRadius: '4px', background: harvestViewToggle === 'graph' ? 'white' : 'transparent', fontWeight: harvestViewToggle === 'graph' ? 600 : 400, boxShadow: harvestViewToggle === 'graph' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', cursor: 'pointer', color: '#333' }}>Graph</button>
                  <button onClick={() => setHarvestViewToggle('report')} style={{ padding: '6px 16px', border: 'none', borderRadius: '4px', background: harvestViewToggle === 'report' ? 'white' : 'transparent', fontWeight: harvestViewToggle === 'report' ? 600 : 400, boxShadow: harvestViewToggle === 'report' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', cursor: 'pointer', color: '#333' }}>Report</button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '20px', marginBottom: '20px', flexWrap: 'wrap' }}>
                <div style={{ padding: '10px 15px', background: '#e8f5e9', borderRadius: '6px', border: '1px solid #c8e6c9', color: '#2e7d32', fontSize: '1.05rem', minWidth: '200px' }}><strong style={{ color: '#1b5e20' }}>Total Harvest Yield:</strong> {totalHarvestAmount.toFixed(2)}</div>
                <div style={{ padding: '10px 15px', background: '#e8f5e9', borderRadius: '6px', border: '1px solid #c8e6c9', color: '#2e7d32', fontSize: '1.05rem', minWidth: '200px' }}><strong style={{ color: '#1b5e20' }}>Total Generated Sales:</strong> ${totalHarvestSales.toFixed(2)}</div>
              </div>

              {harvestViewToggle === 'graph' ? (
                <div style={{ width: '100%', height: 350 }}>
                  <ResponsiveContainer width="99%" height={350} minWidth={1} minHeight={1}>
                    <BarChart data={harvestByDay} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip cursor={{ fill: '#f5f5f5' }} />
                      <Bar dataKey="yield" fill="#4caf50" radius={[4, 4, 0, 0]} barSize={32} name="Total Yield" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <CrudTable
                  data={harvestReportData}
                  columns={reportColumns}
                  itemLabel="Harvest Record"
                  maxHeight="350px"
                />
              )}
            </CollapsibleCard>
          </div>
        )}

        {activeDashboardTab === 'financials' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Finances (2 Week Segments) */}
            <CollapsibleCard title="Finances (2 Week Segments)">
              <div style={{ width: '100%', height: 300 }}>
                <ResponsiveContainer width="99%" height={300} minWidth={1} minHeight={1}>
                  <BarChart data={fortnightData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="time" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip cursor={{ fill: '#f5f5f5' }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="Revenue" fill="#2196f3" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Expenses" fill="#f44336" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CollapsibleCard>

            {/* Side-by-side Pie Charts */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px' }}>
              <div style={{ flex: '1 1 350px' }}>
                <CollapsibleCard title="Revenue by Category">
                  <div style={{ width: '100%', height: 300, display: 'flex', justifyContent: 'center' }}>
                    <ResponsiveContainer width="99%" height={300} minWidth={1} minHeight={1}>
                      <PieChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                        <Pie data={revPieData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={5} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                          {revPieData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={(val) => `$${val}`} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CollapsibleCard>
              </div>
              <div style={{ flex: '1 1 350px' }}>
                <CollapsibleCard title="Expenses by Category">
                  <div style={{ width: '100%', height: 300, display: 'flex', justifyContent: 'center' }}>
                    <ResponsiveContainer width="99%" height={300} minWidth={1} minHeight={1}>
                      <PieChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                        <Pie data={expPieData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={5} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                          {expPieData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={(val) => `$${val}`} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CollapsibleCard>
              </div>
            </div>

            {/* Monthly Financial Trend */}
            <CollapsibleCard title="Monthly Financial Trend" forceFullGrid>
              <div style={{ width: '100%', height: 350 }}>
                <ResponsiveContainer width="99%" height={350} minWidth={1} minHeight={1}>
                  <LineChart data={monthData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <Tooltip formatter={(val) => `$${val}`} />
                    <Legend />
                    <Line type="monotone" dataKey="Revenue" stroke="#2196f3" activeDot={{ r: 8 }} strokeWidth={3} />
                    <Line type="monotone" dataKey="Expenses" stroke="#f44336" strokeWidth={3} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CollapsibleCard>
          </div>
        )}
      </div>
    </div>
  );
}
