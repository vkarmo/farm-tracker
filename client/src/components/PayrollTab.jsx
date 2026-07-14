import React, { useState, useMemo, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { DollarSign, Users, Calendar, Filter, FileText, Check, X, Plus, Trash2, ArrowLeft, Save } from 'lucide-react';
import Select from 'react-select';
import { queueAction } from '../store/syncSlice';
import { savePayroll, deletePayroll } from '../store/payrollSlice';
import NmkLogo from './NmkLogo';
import html2canvas from 'html2canvas';

const rankOrder = [
  'director',
  'assistant director',
  'general manager',
  'assistant manager',
  'supervisor',
  'foreman',
  'farm worker'
];

const getRankIndex = (jobTitle) => {
  const title = (jobTitle || '').toLowerCase().trim();
  const idx = rankOrder.indexOf(title);
  return idx === -1 ? 999 : idx;
};

export default function PayrollTab() {
  const dispatch = useDispatch();
  const employees = useSelector(state => state.employees?.list) || [];
  const savedPayrolls = useSelector(state => state.payroll?.list) || [];
  const budgets = useSelector(state => state.budgets?.list) || [];
  const activeBudget = budgets.find(b => b.status === 'Active') || {};
  const logo = useSelector(state => state.settings?.logo);

  // View state: 'list' or 'form'
  const [viewMode, setViewMode] = useState('list');
  const [editingId, setEditingId] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);

  // Responsive state
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Form states
  const getPastDateStr = (daysAgo) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return d.toISOString().split('T')[0];
  };

  const [fromDate, setFromDate] = useState(getPastDateStr(13));
  const [toDate, setToDate] = useState(getPastDateStr(0));
  const [pulledEmployees, setPulledEmployees] = useState([]);

  // Exchange rate fallback mechanism identical to BudgetTab
  const historicalRate = useMemo(() => {
    if (!budgets.length) return 150;
    const sorted = [...budgets].sort((a, b) => (b.id || '').localeCompare(a.id || ''));
    const recentWithRate = sorted.find(b => b.exchangeRate && String(b.exchangeRate).trim() !== '');
    return recentWithRate ? parseFloat(recentWithRate.exchangeRate) : 150;
  }, [budgets]);

  const [liveRate, setLiveRate] = useState(null);

  useEffect(() => {
    let mounted = true;
    fetch('https://open.er-api.com/v6/latest/USD')
      .then(res => res.json())
      .then(data => {
        if (mounted && data?.rates?.LRD) {
          setLiveRate(data.rates.LRD);
        }
      })
      .catch(err => console.warn('Could not fetch live exchange rate (offline mode active):', err));
    return () => { mounted = false; };
  }, []);

  const activeRate = liveRate || historicalRate;
  const defaultExchangeRate = parseFloat(activeBudget.exchangeRate) || activeRate;
  
  const [customExchangeRate, setCustomExchangeRate] = useState(defaultExchangeRate);
  
  // Sync customExchangeRate with default active budget exchange rate or activeRate when not editing
  useEffect(() => {
    if (!editingId) {
      setCustomExchangeRate(defaultExchangeRate);
    }
  }, [defaultExchangeRate, editingId]);

  // Default selection filter to Supervisor, Security, and Farm Worker
  const [selectedTitles, setSelectedTitles] = useState([
    { value: 'Supervisor', label: 'Supervisor' },
    { value: 'Security', label: 'Security' },
    { value: 'Farm Worker', label: 'Farm Worker' }
  ]);
  const [attendance, setAttendance] = useState({});

  // Generate array of date objects within range
  const dateRange = useMemo(() => {
    const dates = [];
    if (!fromDate || !toDate) return dates;
    
    const start = new Date(fromDate);
    const end = new Date(toDate);
    
    // Safety check to prevent infinite loop or huge ranges
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays > 45) {
      end.setDate(start.getDate() + 45);
    }

    const current = new Date(start);
    while (current <= end) {
      dates.push(current.toISOString().split('T')[0]);
      current.setDate(current.getDate() + 1);
    }
    return dates;
  }, [fromDate, toDate]);

  // Unique job titles options from all employees
  const jobTitleOptions = useMemo(() => {
    const titlesSet = new Set(['Supervisor', 'Security', 'Farm Worker']);
    employees.forEach(emp => {
      if (emp.jobTitle) titlesSet.add(emp.jobTitle);
    });
    return Array.from(titlesSet).sort().map(t => ({ value: t, label: t }));
  }, [employees]);

  // Pull all active employees (non-managers) and sort them by rank first, then last name, then first name
  const handlePullEmployees = () => {
    const eligible = employees.filter(emp => {
      const isManager = (emp.jobTitle || '').toLowerCase().includes('manager');
      const isActive = emp.isActive !== false && emp.isTerminated !== true;
      return isActive && !isManager;
    });

    const sorted = [...eligible].sort((a, b) => {
      const rankA = getRankIndex(a.jobTitle);
      const rankB = getRankIndex(b.jobTitle);
      if (rankA !== rankB) return rankA - rankB;
      
      const lastCompare = (a.lastName || '').localeCompare(b.lastName || '');
      if (lastCompare !== 0) return lastCompare;
      
      return (a.firstName || '').localeCompare(b.firstName || '');
    });

    setPulledEmployees(sorted);

    // Initialize attendance: Sunday (0) as non-work day (0), all other days (including Saturday) as work day (1)
    const newAttendance = { ...attendance };
    sorted.forEach(emp => {
      if (!newAttendance[emp.id]) {
        newAttendance[emp.id] = {};
      }
      dateRange.forEach(dateStr => {
        if (newAttendance[emp.id][dateStr] === undefined) {
          const date = new Date(dateStr);
          const day = date.getDay();
          newAttendance[emp.id][dateStr] = (day === 0) ? '0' : '1';
        }
      });
    });
    setAttendance(newAttendance);
  };

  // Sync attendance slots if dates change (Saturdays default to 1, Sundays to 0)
  useEffect(() => {
    if (pulledEmployees.length === 0) return;
    setAttendance(prev => {
      const next = { ...prev };
      pulledEmployees.forEach(emp => {
        if (!next[emp.id]) next[emp.id] = {};
        dateRange.forEach(dateStr => {
          if (next[emp.id][dateStr] === undefined) {
            const date = new Date(dateStr);
            const day = date.getDay();
            next[emp.id][dateStr] = (day === 0) ? '0' : '1';
          }
        });
      });
      return next;
    });
  }, [dateRange, pulledEmployees]);

  const handleCycleStatus = (empId, dateStr) => {
    setAttendance(prev => {
      const empAttendance = { ...(prev[empId] || {}) };
      const current = empAttendance[dateStr] || '0';
      let nextStatus = '1';
      if (current === '1') nextStatus = '0';
      else if (current === '0') nextStatus = 'X';
      else if (current === 'X') nextStatus = '1';
      
      return {
        ...prev,
        [empId]: {
          ...empAttendance,
          [dateStr]: nextStatus
        }
      };
    });
  };

  // Filter pulled employees on grid by multi picker titles
  const filteredPulledEmployees = useMemo(() => {
    if (selectedTitles.length === 0) return pulledEmployees;
    const filterVals = selectedTitles.map(t => t.value.toLowerCase());
    return pulledEmployees.filter(emp => 
      filterVals.includes((emp.jobTitle || '').toLowerCase())
    );
  }, [pulledEmployees, selectedTitles]);

  const payrollRows = useMemo(() => {
    return filteredPulledEmployees.map(emp => {
      const empAttendance = attendance[emp.id] || {};
      let daysWorked = 0;
      let daysAbsent = 0;
      let daysOff = 0;

      dateRange.forEach(dateStr => {
        const status = empAttendance[dateStr] || '0';
        if (status === '1') daysWorked++;
        else if (status === 'X') daysAbsent++;
        else daysOff++;
      });

      let rateDisplay = '';
      let calculatedTotal = 0;
      let currency = 'USD';

      if (emp.type === 'Daily') {
        const dailyLD = parseFloat(emp.dailyRateLD) || 0;
        rateDisplay = `${dailyLD.toLocaleString()} LD/day`;
        calculatedTotal = daysWorked * dailyLD;
        currency = 'LRD';
      } else {
        const biWeeklyUSD = parseFloat(emp.twoWeekPayUSD) || 0;
        const dailyRateUSD = biWeeklyUSD / 10;
        rateDisplay = `$${dailyRateUSD.toFixed(2)} USD/day`;
        calculatedTotal = daysWorked * dailyRateUSD;
        currency = 'USD';
      }

      return {
        employee: emp,
        daysWorked,
        daysAbsent,
        daysOff,
        rateDisplay,
        calculatedTotal,
        currency
      };
    });
  }, [filteredPulledEmployees, attendance, dateRange]);

  const summaryTotals = useMemo(() => {
    let usdTotal = 0;
    let lrdTotal = 0;
    let totalEmployees = payrollRows.length;
    const rate = parseFloat(customExchangeRate) || activeRate;

    payrollRows.forEach(row => {
      if (row.currency === 'USD') {
        usdTotal += row.calculatedTotal;
      } else {
        lrdTotal += row.calculatedTotal;
      }
    });

    const combinedUSD = usdTotal + (rate > 0 ? (lrdTotal / rate) : 0);
    const combinedLRD = lrdTotal + (usdTotal * rate);

    return {
      usdTotal,
      lrdTotal,
      combinedUSD,
      combinedLRD,
      totalEmployees
    };
  }, [payrollRows, customExchangeRate, activeRate]);

  // Load Saved Worksheet
  const handleLoadWorksheet = (sheet) => {
    setEditingId(sheet.id);
    setFromDate(sheet.fromDate);
    setToDate(sheet.toDate);
    setPulledEmployees(sheet.pulledEmployees || []);
    setAttendance(sheet.attendance || {});
    setCustomExchangeRate(sheet.exchangeRate !== undefined ? sheet.exchangeRate : defaultExchangeRate);
    setViewMode('form');
  };

  // Create New Worksheet
  const handleCreateNew = () => {
    setEditingId(null);
    setFromDate(getPastDateStr(13));
    setToDate(getPastDateStr(0));
    setPulledEmployees([]);
    setAttendance({});
    setCustomExchangeRate(defaultExchangeRate);
    setViewMode('form');
  };

  // Save Worksheet
  const handleSaveWorksheet = () => {
    if (pulledEmployees.length === 0) {
      alert('Please pull in active employees before saving.');
      return;
    }

    const id = editingId || 'payroll_' + Date.now();
    const rate = parseFloat(customExchangeRate) || defaultExchangeRate;
    const payload = {
      id,
      fromDate,
      toDate,
      exchangeRate: rate,
      attendance,
      pulledEmployees,
      totals: {
        usdTotal: summaryTotals.usdTotal,
        lrdTotal: summaryTotals.lrdTotal,
        combinedUSD: summaryTotals.combinedUSD,
        combinedLRD: summaryTotals.combinedLRD,
        totalEmployees: summaryTotals.totalEmployees
      },
      createdAt: Date.now()
    };

    dispatch(queueAction({ type: 'payroll/savePayroll', payload, meta: { id: Date.now() } }));
    dispatch(savePayroll(payload));
    
    setViewMode('list');
    setEditingId(null);
  };

  // Delete Worksheet (Direct or list action)
  const handleDeleteWorksheet = (id) => {
    if (window.confirm('Are you sure you want to permanently delete this payroll worksheet?')) {
      dispatch(queueAction({ type: 'core/deleteNode', payload: { id }, meta: { id: Date.now() } }));
      dispatch(deletePayroll(id));
      if (editingId === id) {
        setViewMode('list');
        setEditingId(null);
      }
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    if (payrollRows.length === 0) return alert('No payroll rows to export.');

    const rate = parseFloat(customExchangeRate) || activeRate;
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += `Payroll Report: ${fromDate} to ${toDate}\n`;
    csvContent += `Exchange Rate: 1 USD = ${rate} LRD\n\n`;
    csvContent += "Employee,Job Title,Type,Days Worked,Off Days,Absent Days,Pay Rate,Calculated Total,Currency\n";
    
    payrollRows.forEach(row => {
      const name = `"${row.employee.lastName}, ${row.employee.firstName}"`;
      csvContent += `${name},"${row.employee.jobTitle}",${row.employee.type},${row.daysWorked},${row.daysOff},${row.daysAbsent},"${row.rateDisplay}",${row.calculatedTotal.toFixed(2)},${row.currency}\n`;
    });

    csvContent += `\n,,Total LRD,,,,,${summaryTotals.lrdTotal.toFixed(2)} LRD\n`;
    csvContent += `,,Total USD,,,,,${summaryTotals.usdTotal.toFixed(2)} USD\n`;
    csvContent += `,,Combined Total (USD),,,,,${summaryTotals.combinedUSD.toFixed(2)} USD\n`;
    csvContent += `,,Combined Total (LRD),,,,,${summaryTotals.combinedLRD.toFixed(2)} LRD\n`;

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `payroll_report_${fromDate}_to_${toDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export PNG Report
  const handleExportPNG = () => {
    const element = document.getElementById('payroll-report-container');
    if (!element) return;

    html2canvas(element, {
      backgroundColor: '#ffffff',
      scale: 2,
      useCORS: true,
      logging: false
    }).then(canvas => {
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `payroll_report_${fromDate}_to_${toDate}.png`;
      link.href = dataUrl;
      link.click();
    }).catch(err => {
      console.error('Failed to export PNG', err);
      alert('Error generating PNG. Please try again.');
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', fontFamily: '"Inter", sans-serif' }}>
      
      {/* 1. Saved Payroll Worksheets Roster list */}
      {viewMode === 'list' && (
        <div style={{ background: 'white', padding: isMobile ? '12px' : '20px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center', flexDirection: isMobile ? 'column' : 'row', gap: '12px', marginBottom: '20px' }}>
            <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <DollarSign size={20} color="#16a34a" /> Saved Payroll Logs
            </h3>
            <button 
              onClick={handleCreateNew}
              style={{
                padding: '10px 16px',
                backgroundColor: '#1e293b',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '0.85rem',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              <Plus size={16} /> New Payroll Worksheet
            </button>
          </div>

          {savedPayrolls.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '50px 20px', border: '1px dashed #cbd5e1', borderRadius: '8px', color: '#64748b' }}>
              <DollarSign size={40} color="#cbd5e1" style={{ margin: '0 auto 12px auto' }} />
              <p style={{ margin: 0, fontWeight: '600', fontSize: '0.95rem' }}>No payroll sheets saved yet.</p>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem' }}>Click the button above to log and save a new pay period worksheet.</p>
            </div>
          ) : isMobile ? (
            /* Mobile saved worksheets card list */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {savedPayrolls.map(sheet => {
                const totalUSD = sheet.totals?.combinedUSD || 0;
                const totalLRD = sheet.totals?.combinedLRD || 0;
                const staff = sheet.totals?.totalEmployees || 0;
                const dateStr = new Date(sheet.createdAt || Date.now()).toLocaleDateString();

                return (
                  <div key={sheet.id} style={{ background: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid #cbd5e1', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: '700', color: '#1e293b', fontSize: '0.85rem' }}>{sheet.fromDate} to {sheet.toDate}</span>
                      <span style={{ fontSize: '0.72rem', color: '#64748b' }}>{dateStr}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#475569' }}>
                      <span>Workers: <strong>{staff}</strong></span>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '1px' }}>
                        <span style={{ color: '#16a34a', fontWeight: '700' }}>${totalUSD.toFixed(2)} USD</span>
                        <span style={{ color: '#1e3a8a', fontWeight: '700' }}>{totalLRD.toLocaleString()} LD</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                      <button
                        onClick={() => handleLoadWorksheet(sheet)}
                        className="btn"
                        style={{ flex: 1, padding: '8px', fontSize: '0.78rem', background: '#e2e8f0', color: '#334155' }}
                      >
                        Load Worksheet
                      </button>
                      <button
                        onClick={() => handleDeleteWorksheet(sheet.id)}
                        style={{ padding: '8px 12px', background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Desktop saved worksheets table list */
            <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '700' }}>Pay Period Range</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '700' }}>Staff Count</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '700' }}>Combined (USD)</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '700' }}>Combined (LRD)</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '700' }}>Logged At</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '700' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {savedPayrolls.map((sheet, idx) => {
                    const totalUSD = sheet.totals?.combinedUSD || 0;
                    const totalLRD = sheet.totals?.combinedLRD || 0;
                    const staff = sheet.totals?.totalEmployees || 0;
                    const dateStr = new Date(sheet.createdAt || Date.now()).toLocaleDateString();

                    return (
                      <tr key={sheet.id} style={{ borderBottom: '1px solid #e2e8f0', background: idx % 2 === 0 ? 'white' : '#f8fafc' }}>
                        <td style={{ padding: '12px 16px', fontWeight: '600', color: '#1e293b' }}>
                          {sheet.fromDate} to {sheet.toDate}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center', color: '#475569' }}>
                          {staff} workers
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '600', color: '#16a34a' }}>
                          ${totalUSD.toFixed(2)} USD
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '600', color: '#1e3a8a' }}>
                          {totalLRD.toLocaleString()} LD
                        </td>
                        <td style={{ padding: '12px 16px', color: '#64748b' }}>
                          {dateStr}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                            <button
                              onClick={() => handleLoadWorksheet(sheet)}
                              className="btn"
                              style={{ padding: '4px 10px', fontSize: '0.75rem', background: '#e2e8f0', color: '#334155' }}
                            >
                              Load
                            </button>
                            <button
                              onClick={() => handleDeleteWorksheet(sheet.id)}
                              className="btn"
                              style={{ padding: '4px 10px', fontSize: '0.75rem', background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 2. Interactive Worksheet Form Studio */}
      {viewMode === 'form' && (
        <div style={{ background: 'white', padding: isMobile ? '12px' : '20px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
          
          {/* Header Action Row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center', flexDirection: isMobile ? 'column' : 'row', gap: '14px', marginBottom: '20px', borderBottom: '1px solid #f1f5f9', paddingBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button 
                onClick={() => {
                  if (window.confirm('Cancel worksheet editor? Unsaved entries will be lost.')) {
                    setViewMode('list');
                    setEditingId(null);
                  }
                }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#64748b' }}
              >
                <ArrowLeft size={20} />
              </button>
              <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#1e293b' }}>
                {editingId ? 'Edit Payroll Worksheet' : 'New Payroll Worksheet'}
              </h3>
            </div>

            <div style={{ display: 'flex', gap: '8px', flexDirection: isMobile ? 'column' : 'row', width: isMobile ? '100%' : 'auto' }}>
              {editingId && (
                <button
                  type="button"
                  onClick={() => handleDeleteWorksheet(editingId)}
                  style={{
                    padding: '9px 14px',
                    backgroundColor: '#fee2e2',
                    color: '#ef4444',
                    border: '1px solid #fca5a5',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    width: isMobile ? '100%' : 'auto'
                  }}
                >
                  <Trash2 size={15} /> Delete Worksheet
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  if (window.confirm('Cancel worksheet editor? Unsaved entries will be lost.')) {
                    setViewMode('list');
                    setEditingId(null);
                  }
                }}
                style={{
                  padding: '9px 14px',
                  backgroundColor: 'white',
                  color: '#475569',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  justifyContent: 'center',
                  width: isMobile ? '100%' : 'auto'
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleSaveWorksheet}
                style={{
                  padding: '9px 14px',
                  backgroundColor: '#1e293b',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  width: isMobile ? '100%' : 'auto'
                }}
              >
                <Save size={15} /> Save Worksheet
              </button>
            </div>
          </div>

          {/* Form Filter Inputs */}
          <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: isMobile ? '100%' : 'auto' }}>
              <label style={{ fontSize: '0.78rem', fontWeight: '600', color: '#64748b' }}>Period From</label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%' }}>
                <Calendar size={15} color="#94a3b8" style={{ position: 'absolute', left: '10px' }} />
                <input 
                  type="date" 
                  value={fromDate} 
                  onChange={e => setFromDate(e.target.value)} 
                  style={{ padding: '8px 10px 8px 32px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem', color: '#334155', width: '100%', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: isMobile ? '100%' : 'auto' }}>
              <label style={{ fontSize: '0.78rem', fontWeight: '600', color: '#64748b' }}>Period To</label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%' }}>
                <Calendar size={15} color="#94a3b8" style={{ position: 'absolute', left: '10px' }} />
                <input 
                  type="date" 
                  value={toDate} 
                  onChange={e => setToDate(e.target.value)} 
                  style={{ padding: '8px 10px 8px 32px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem', color: '#334155', width: '100%', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: isMobile ? '100%' : '120px', maxWidth: '140px' }}>
              <label style={{ fontSize: '0.78rem', fontWeight: '600', color: '#64748b' }}>Ex. Rate (LRD/USD)</label>
              <input 
                type="number" 
                value={customExchangeRate} 
                onChange={e => setCustomExchangeRate(e.target.value)} 
                style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem', color: '#334155', width: '100%', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%', maxWidth: isMobile ? 'none' : '260px' }}>
              <label style={{ fontSize: '0.78rem', fontWeight: '600', color: '#64748b' }}>Filter Job Titles</label>
              <Select
                isMulti
                options={jobTitleOptions}
                value={selectedTitles}
                onChange={setSelectedTitles}
                placeholder="All job titles..."
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

            <div style={{ display: 'flex', gap: '8px', width: isMobile ? '100%' : 'auto', marginTop: '10px', flexWrap: 'wrap' }}>
              <button 
                type="button"
                onClick={handlePullEmployees}
                style={{
                  padding: '9px 16px',
                  backgroundColor: '#1e293b',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '0.85rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'background 0.15s ease',
                  height: '38px',
                  flex: isMobile ? 1 : 'none'
                }}
                onMouseOver={e => e.currentTarget.style.backgroundColor = '#0f172a'}
                onMouseOut={e => e.currentTarget.style.backgroundColor = '#1e293b'}
              >
                <Users size={16} /> Pull Active Employees
              </button>

              {payrollRows.length > 0 && (
                <>
                  <button 
                    type="button"
                    onClick={() => setShowReportModal(true)}
                    style={{
                      padding: '9px 16px',
                      backgroundColor: '#1e3a8a',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '0.85rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      transition: 'background 0.15s ease',
                      height: '38px',
                      flex: isMobile ? 1 : 'none'
                    }}
                    onMouseOver={e => e.currentTarget.style.backgroundColor = '#172554'}
                    onMouseOut={e => e.currentTarget.style.backgroundColor = '#1e3a8a'}
                  >
                    <FileText size={16} /> Generate Report
                  </button>

                  <button 
                    type="button"
                    onClick={handleExportCSV}
                    style={{
                      padding: '9px 16px',
                      backgroundColor: '#16a34a',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '0.85rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      transition: 'background 0.15s ease',
                      height: '38px',
                      flex: isMobile ? 1 : 'none'
                    }}
                    onMouseOver={e => e.currentTarget.style.backgroundColor = '#15803d'}
                    onMouseOut={e => e.currentTarget.style.backgroundColor = '#16a34a'}
                  >
                    <FileText size={16} /> Export CSV
                  </button>
                </>
              )}
            </div>
          </div>

          <div style={{ background: '#f8fafc', border: '1px dashed #cbd5e1', padding: '12px', borderRadius: '6px', marginBottom: '20px', fontSize: '0.78rem', color: '#64748b' }}>
            <strong>Interactive Grid Logging:</strong> Click any status pill in the grid to cycle: <strong>1</strong> (Work day) &rarr; <strong>0</strong> (Non-work day) &rarr; <strong>X</strong> (Absent). Sundays default to off (<strong>0</strong>), and Saturdays default to work days (<strong>1</strong>).
          </div>

          {/* Worksheet Grid Sheet */}
          {pulledEmployees.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', border: '1px dashed #cbd5e1', borderRadius: '8px', color: '#64748b' }}>
              <DollarSign size={36} color="#94a3b8" style={{ margin: '0 auto 10px auto' }} />
              <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: '500' }}>Worksheet is empty.</p>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.78rem' }}>Set dates and click <strong>Pull Active Employees</strong> to load roster.</p>
            </div>
          ) : filteredPulledEmployees.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', border: '1px dashed #cbd5e1', borderRadius: '8px', color: '#64748b' }}>
              <Filter size={36} color="#94a3b8" style={{ margin: '0 auto 10px auto' }} />
              <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: '500' }}>No active pulled employees match the filter criteria.</p>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.78rem' }}>Adjust the <strong>Filter Job Titles</strong> picker to display employees.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', minWidth: '1100px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '700', color: '#475569', position: 'sticky', left: 0, background: '#f8fafc', zIndex: 10, boxShadow: '2px 0 5px rgba(0,0,0,0.05)' }}>Employee Name</th>
                    {!isMobile && <th style={{ padding: '12px 12px', textAlign: 'left', fontWeight: '700', color: '#475569' }}>Job Title</th>}
                    {!isMobile && <th style={{ padding: '12px 12px', textAlign: 'left', fontWeight: '700', color: '#475569' }}>Pay Rate</th>}
                    
                    {dateRange.map(dateStr => {
                      const parts = dateStr.split('-');
                      const label = `${parts[1]}/${parts[2]}`;
                      const dayName = new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short' });
                      return (
                        <th key={dateStr} style={{ padding: '8px', textAlign: 'center', fontWeight: '700', color: '#475569', minWidth: '42px', borderLeft: '1px solid #f1f5f9' }} title={dateStr}>
                          <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase' }}>{dayName}</div>
                          <div>{label}</div>
                        </th>
                      );
                    })}

                    <th style={{ padding: '12px 12px', textAlign: 'center', fontWeight: '700', color: '#475569', borderLeft: '2px solid #cbd5e1' }}>Worked</th>
                    <th style={{ padding: '12px 12px', textAlign: 'center', fontWeight: '700', color: '#475569' }}>Off Days</th>
                    <th style={{ padding: '12px 12px', textAlign: 'center', fontWeight: '700', color: '#475569' }}>Absent</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '700', color: '#475569', background: '#f8fafc', position: 'sticky', right: 0, zIndex: 10, boxShadow: '-2px 0 5px rgba(0,0,0,0.05)' }}>Payroll Total</th>
                  </tr>
                </thead>
                <tbody>
                  {payrollRows.map((row, rIdx) => {
                    const emp = row.employee;
                    const empAttendance = attendance[emp.id] || {};
                    
                    return (
                      <tr 
                        key={emp.id} 
                        style={{ 
                          borderBottom: '1px solid #e2e8f0', 
                          background: rIdx % 2 === 0 ? 'white' : '#f8fafc',
                          transition: 'background 0.15s ease'
                        }}
                        onMouseOver={e => e.currentTarget.style.background = '#f1f5f9'}
                        onMouseOut={e => e.currentTarget.style.background = rIdx % 2 === 0 ? 'white' : '#f8fafc'}
                      >
                        <td style={{ 
                          padding: '12px 16px', 
                          fontWeight: '600', 
                          color: '#1e293b', 
                          position: 'sticky', 
                          left: 0, 
                          background: rIdx % 2 === 0 ? 'white' : '#f8fafc', 
                          zIndex: 5,
                          boxShadow: '2px 0 5px rgba(0,0,0,0.05)'
                        }}>
                          <div>{emp.lastName}, {emp.firstName}</div>
                          {isMobile && (
                            <div style={{ fontSize: '0.65rem', color: '#64748b', marginTop: '3px', fontWeight: '400' }}>
                              {emp.jobTitle} • {row.rateDisplay}
                            </div>
                          )}
                        </td>
                        
                        {!isMobile && (
                          <td style={{ padding: '12px 12px', color: '#475569' }}>
                            <span style={{ 
                              fontSize: '0.72rem', 
                              background: '#e2e8f0', 
                              color: '#475569', 
                              padding: '2px 6px', 
                              borderRadius: '4px',
                              fontWeight: '600'
                            }}>
                              {emp.jobTitle}
                            </span>
                          </td>
                        )}

                        {!isMobile && (
                          <td style={{ padding: '12px 12px', color: '#475569', fontWeight: '500' }}>
                            {row.rateDisplay}
                          </td>
                        )}

                        {dateRange.map(dateStr => {
                          const status = empAttendance[dateStr] || '0';
                          let cellContent = '0';
                          let bgColor = '#f1f5f9';
                          let textColor = '#64748b';
                          let fontWeight = '500';

                          if (status === '1') {
                            cellContent = '1';
                            bgColor = '#dcfce7';
                            textColor = '#15803d';
                            fontWeight = '800';
                          } else if (status === 'X') {
                            cellContent = 'X';
                            bgColor = '#fee2e2';
                            textColor = '#b91c1c';
                            fontWeight = '900';
                          }

                          return (
                            <td 
                              key={dateStr}
                              onClick={() => handleCycleStatus(emp.id, dateStr)}
                              style={{ 
                                padding: '6px', 
                                textAlign: 'center', 
                                cursor: 'pointer',
                                borderLeft: '1px solid #f1f5f9',
                                userSelect: 'none',
                                transition: 'all 0.1s ease'
                              }}
                            >
                              <div style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '6px',
                                background: bgColor,
                                color: textColor,
                                fontWeight: fontWeight,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                margin: '0 auto',
                                border: status === 'X' ? '1px solid #fecaca' : 'none',
                                fontSize: status === 'X' ? '0.85rem' : '0.75rem',
                                boxShadow: status !== '0' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'
                              }}>
                                {status === 'X' ? (
                                  <X size={13} strokeWidth={3} color="#b91c1c" />
                                ) : (
                                  cellContent
                                )}
                              </div>
                            </td>
                          );
                        })}

                        <td style={{ padding: '12px 12px', textAlign: 'center', fontWeight: '700', color: '#15803d', borderLeft: '2px solid #cbd5e1' }}>
                          {row.daysWorked}d
                        </td>
                        <td style={{ padding: '12px 12px', textAlign: 'center', fontWeight: '700', color: '#4b5563' }}>
                          {row.daysOff}d
                        </td>
                        <td style={{ padding: '12px 12px', textAlign: 'center', fontWeight: '700', color: '#b91c1c' }}>
                          {row.daysAbsent}d
                        </td>

                        <td style={{ 
                          padding: '12px 16px', 
                          textAlign: 'right', 
                          fontWeight: '700', 
                          color: row.currency === 'USD' ? '#0f172a' : '#1e3a8a',
                          background: rIdx % 2 === 0 ? 'white' : '#f8fafc',
                          position: 'sticky', 
                          right: 0, 
                          zIndex: 5,
                          boxShadow: '-2px 0 5px rgba(0,0,0,0.05)'
                        }}>
                          {row.currency === 'USD' ? (
                            <span>${row.calculatedTotal.toFixed(2)} <span style={{ fontSize: '0.65rem', color: '#64748b' }}>USD</span></span>
                          ) : (
                            <span>{row.calculatedTotal.toLocaleString()} <span style={{ fontSize: '0.65rem', color: '#1e3a8a' }}>LD</span></span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Combined Summary Band */}
          {payrollRows.length > 0 && (
            <div style={{ 
              marginTop: '20px', 
              padding: '16px', 
              background: '#f8fafc', 
              borderRadius: '8px', 
              border: '1px solid #e2e8f0', 
              display: 'flex', 
              justifyContent: 'space-between', 
              flexDirection: isMobile ? 'column' : 'row', 
              gap: '16px' 
            }}>
              <div style={{ display: 'flex', gap: isMobile ? '16px' : '24px', flexWrap: 'wrap', flexDirection: isMobile ? 'column' : 'row' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>Workers Pulled</span>
                  <span style={{ fontSize: '1.1rem', fontWeight: '800', color: '#1e293b' }}>{summaryTotals.totalEmployees} employees</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>Worksheets Subtotals</span>
                  <div style={{ fontSize: '0.85rem', fontWeight: '700', color: '#475569' }}>
                    <div>USD Payees: ${summaryTotals.usdTotal.toFixed(2)} USD</div>
                    <div>LD Payees: {summaryTotals.lrdTotal.toLocaleString()} LD</div>
                  </div>
                </div>
              </div>

              <div style={{ 
                display: 'flex', 
                gap: isMobile ? '16px' : '24px', 
                flexWrap: 'wrap', 
                flexDirection: isMobile ? 'column' : 'row',
                borderLeft: isMobile ? 'none' : '1px solid #cbd5e1', 
                borderTop: isMobile ? '1px solid #cbd5e1' : 'none',
                paddingLeft: isMobile ? '0' : '24px',
                paddingTop: isMobile ? '16px' : '0'
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    Combined Total (USD) <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>@ {customExchangeRate} LRD</span>
                  </span>
                  <span style={{ fontSize: '1.25rem', fontWeight: '900', color: '#16a34a' }}>
                    ${summaryTotals.combinedUSD.toFixed(2)} USD
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>
                    Combined Total (LRD)
                  </span>
                  <span style={{ fontSize: '1.25rem', fontWeight: '900', color: '#1e3a8a' }}>
                    {summaryTotals.combinedLRD.toLocaleString(undefined, {maximumFractionDigits: 0})} LRD
                  </span>
                </div>
              </div>
            </div>
          )}

        </div>
      )}

      {/* Report Modal */}
      {showReportModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
        }} onClick={() => setShowReportModal(false)}>
          
          <div style={{
            background: 'white',
            borderRadius: '10px',
            width: '95%',
            maxWidth: '1000px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            overflow: 'hidden'
          }} onClick={e => e.stopPropagation()}>
            
            {/* Modal Toolbar */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 20px',
              borderBottom: '1px solid #e2e8f0',
              background: '#f8fafc'
            }}>
              <h3 style={{ margin: 0, color: '#1e293b', fontSize: '1rem', fontWeight: '700' }}>Generate Payroll Report</h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={handleExportCSV} className="btn" style={{ background: '#e2e8f0', color: '#334155', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', padding: '6px 12px' }}>
                  Export to CSV
                </button>
                <button onClick={handleExportPNG} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', padding: '6px 12px', background: '#1e293b', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                  Export to PNG
                </button>
                <button onClick={() => setShowReportModal(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}>
                  <X size={18} color="#64748b" />
                </button>
              </div>
            </div>

            {/* Modal Body (Scrollable container for report capture) */}
            <div style={{ overflowY: 'auto', flex: 1, padding: '20px', background: '#f1f5f9' }}>
              <div id="payroll-report-container" style={{
                background: 'white',
                color: '#1e293b',
                fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                padding: '24px',
                borderRadius: '6px',
                border: '1px solid #e2e8f0',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px'
              }}>
                {/* Letterhead Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', borderBottom: '3px solid var(--color-primary-dark, #1b5e20)', paddingBottom: '12px' }}>
                  {logo ? (
                    <img src={logo} alt="Company Logo" style={{ maxHeight: '90px', maxWidth: '240px', objectFit: 'contain' }} />
                  ) : (
                    <NmkLogo size={90} />
                  )}
                  <div style={{ flex: 1 }}>
                    <h1 style={{ margin: 0, color: 'var(--color-primary-dark, #1b5e20)', fontSize: '1.25rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Payroll & Attendance Log
                    </h1>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px', fontWeight: 500 }}>
                      NMK Farm, Kamigbo, Senjeh District, Bomi County, Liberia • Official Attendance Worksheet
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>
                    <div><strong>Pay Period:</strong> {fromDate} to {toDate}</div>
                    <div><strong>Exchange Rate:</strong> $1.00 USD = {customExchangeRate} LRD</div>
                    <div><strong>Generated:</strong> {new Date().toLocaleDateString()}</div>
                  </div>
                </div>

                {/* Report Grid Table (styled like the data entry matrix) */}
                <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', minWidth: '950px' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                        <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: '700', color: '#475569', background: '#f8fafc' }}>Employee Name</th>
                        <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: '700', color: '#475569' }}>Job Title</th>
                        <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: '700', color: '#475569' }}>Pay Rate</th>
                        
                        {dateRange.map(dateStr => {
                          const parts = dateStr.split('-');
                          const label = `${parts[1]}/${parts[2]}`;
                          const dayName = new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short' });
                          return (
                            <th key={dateStr} style={{ padding: '4px', textAlign: 'center', fontWeight: '700', color: '#475569', minWidth: '32px', borderLeft: '1px solid #f1f5f9' }}>
                              <div style={{ fontSize: '0.6rem', color: '#94a3b8', textTransform: 'uppercase' }}>{dayName}</div>
                              <div>{label}</div>
                            </th>
                          );
                        })}

                        <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: '700', color: '#475569', borderLeft: '2px solid #cbd5e1' }}>Worked</th>
                        <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: '700', color: '#475569' }}>Off</th>
                        <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: '700', color: '#475569' }}>Absent</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '700', color: '#475569' }}>Payroll Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payrollRows.map((row, rIdx) => {
                        const emp = row.employee;
                        const empAttendance = attendance[emp.id] || {};
                        
                        return (
                          <tr 
                            key={emp.id} 
                            style={{ 
                              borderBottom: '1px solid #e2e8f0', 
                              background: rIdx % 2 === 0 ? 'white' : '#f8fafc'
                            }}
                          >
                            <td style={{ padding: '8px 10px', fontWeight: '600', color: '#1e293b' }}>
                              {emp.lastName}, {emp.firstName}
                            </td>
                            <td style={{ padding: '8px 10px', color: '#475569' }}>
                              {emp.jobTitle}
                            </td>
                            <td style={{ padding: '8px 10px', color: '#475569' }}>
                              {row.rateDisplay}
                            </td>

                            {dateRange.map(dateStr => {
                              const status = empAttendance[dateStr] || '0';
                              let cellContent = '0';
                              let textColor = '#64748b';
                              let fontWeight = '500';

                              if (status === '1') {
                                cellContent = '1';
                                textColor = '#15803d';
                                fontWeight = '700';
                              } else if (status === 'X') {
                                cellContent = 'X';
                                textColor = '#b91c1c';
                                fontWeight = '800';
                              }

                              return (
                                <td 
                                  key={dateStr}
                                  style={{ 
                                    padding: '4px', 
                                    textAlign: 'center', 
                                    borderLeft: '1px solid #f1f5f9',
                                    color: textColor,
                                    fontWeight: fontWeight
                                  }}
                                >
                                  {cellContent}
                                </td>
                              );
                            })}

                            <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: '700', color: '#15803d', borderLeft: '2px solid #cbd5e1' }}>
                              {row.daysWorked}d
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: '700', color: '#4b5563' }}>
                              {row.daysOff}d
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: '700', color: '#b91c1c' }}>
                              {row.daysAbsent}d
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '700', color: '#1e293b' }}>
                              {row.currency === 'USD' ? `$${row.calculatedTotal.toFixed(2)}` : `${row.calculatedTotal.toLocaleString()} LRD`}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Subtotals & Combined Totals Segment */}
                <div style={{ 
                  padding: '16px', 
                  background: '#f8fafc', 
                  borderRadius: '6px', 
                  border: '1px solid #e2e8f0', 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  gap: '16px' 
                }}>
                  <div style={{ display: 'flex', gap: '32px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>Workers Logged</span>
                      <span style={{ fontSize: '1rem', fontWeight: '800', color: '#1e293b' }}>{summaryTotals.totalEmployees} employees</span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>Worksheet Subtotals</span>
                      <div style={{ fontSize: '0.8rem', fontWeight: '700', color: '#475569' }}>
                        <div>USD: ${summaryTotals.usdTotal.toFixed(2)}</div>
                        <div>LRD: {summaryTotals.lrdTotal.toLocaleString()} LRD</div>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '32px', borderLeft: '1px solid #cbd5e1', paddingLeft: '32px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>
                        Combined Payroll (USD)
                      </span>
                      <span style={{ fontSize: '1.2rem', fontWeight: '900', color: '#16a34a' }}>
                        ${summaryTotals.combinedUSD.toFixed(2)} USD
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>
                        Combined Payroll (LRD)
                      </span>
                      <span style={{ fontSize: '1.2rem', fontWeight: '900', color: '#1e3a8a' }}>
                        {summaryTotals.combinedLRD.toLocaleString(undefined, {maximumFractionDigits: 0})} LRD
                      </span>
                    </div>
                  </div>
                </div>

                {/* Footer terms */}
                <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '12px', fontSize: '0.65rem', color: '#94a3b8', textAlign: 'center' }}>
                  This report is an official computer-generated document of NMK Farm, Kamigbo, Senjeh District, Bomi County, Liberia. All entries sync back to database log registries.
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
