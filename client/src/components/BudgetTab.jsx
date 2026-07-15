import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { queueAction } from '../store/syncSlice';
import { addBudget, deleteBudget, addBudgetItem, deleteBudgetItem } from '../store/budgetSlice';
import { addTransaction } from '../store/financialsSlice';
import { addExpenseCategory, saveSettings } from '../store/settingsSlice';
import { FileText, Plus, Trash2, Edit2, Calculator, Check, X, ArrowRightCircle, Filter } from 'lucide-react';
import CrudTable from './CrudTable';
import NmkLogo from './NmkLogo';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import Select from 'react-select';


const INIT_BUDGET = { name: '', description: '', exchangeRate: 150, sendingService: '', referenceNumber: '', recipient: '' };
const INIT_ITEM = { category: '', description: '', amount: '', currency: 'USD', status: 'Pending Review' };

export default function BudgetTab() {
  const dispatch = useDispatch();
  const budgets = useSelector(state => state.budgets?.list) || [];
  const assignments = useSelector(state => state.assignments?.list) || [];
  const employeesList = useSelector(state => state.employees?.list) || [];
  const expenseCategories = useSelector(state => state.settings?.expenseCategories) || [];
  const currentUser = useSelector(state => state.auth?.currentUser);
  const hasApprovalPermission = currentUser?.role === 'Admin' || currentUser?.canApprove;
  const logo = useSelector(state => state.settings?.logo);

  const historicalRate = React.useMemo(() => {
    if (!budgets.length) return 150;
    // Sort by ID descending (which contains timestamp)
    const sorted = [...budgets].sort((a,b) => (b.id || '').localeCompare(a.id || ''));
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
          setLiveRate(data.rates.LRD.toFixed(2));
        }
      })
      .catch(err => console.warn('Could not fetch live exchange rate (offline mode active):', err));
    return () => { mounted = false; };
  }, []);

  const activeRate = liveRate ? parseFloat(liveRate) : historicalRate;

  const [activeBudgetId, setActiveBudgetId] = useState(null);
  const [budgetForm, setBudgetForm] = useState(INIT_BUDGET);
  const [itemForm, setItemForm] = useState(INIT_ITEM);
  const [editingItemId, setEditingItemId] = useState(null);

  const [isNmkBudget, setIsNmkBudget] = useState(false);
  const [budgetFromDate, setBudgetFromDate] = useState('');
  const [budgetToDate, setBudgetToDate] = useState('');

  const [pendingLedgerExpenses, setPendingLedgerExpenses] = useState([]);
  const [showExpenseReview, setShowExpenseReview] = useState(false);
  const [selectedExpensesToSubmit, setSelectedExpensesToSubmit] = useState({});

  const [filterCategory, setFilterCategory] = useState('All');
  const [filterStatuses, setFilterStatuses] = useState([]);
  const [showReportModal, setShowReportModal] = useState(false);

  const activeBudget = budgets.find(b => b.id === activeBudgetId);

  useEffect(() => {
    setFilterCategory('All');
    setFilterStatuses([]);
  }, [activeBudgetId]);

  const filteredBudgetItems = React.useMemo(() => {
    if (!activeBudget?.items) return [];
    return activeBudget.items.filter(item => {
      const matchCat = filterCategory === 'All' || item.category === filterCategory;
      const matchStatus = filterStatuses.length === 0 || filterStatuses.some(s => {
        const itemStatus = item.status || 'Pending Review';
        if (s === 'Approved & Dispensed') {
          return itemStatus === 'Approved & Dispensed' || itemStatus === 'Dispensed';
        }
        return itemStatus === s;
      });
      return matchCat && matchStatus;
    });
  }, [activeBudget?.items, filterCategory, filterStatuses]);

  const groupedItems = React.useMemo(() => {
    const groups = {};
    filteredBudgetItems.forEach(item => {
      const cat = item.category || 'Uncategorized';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    });
    return groups;
  }, [filteredBudgetItems]);

  const getCategorySubtotal = (items) => {
    const rate = parseFloat(activeBudget?.exchangeRate) || activeRate || 150;
    let approvedUsd = 0;
    let approvedLrd = 0;
    let dispensedUsd = 0;
    let dispensedLrd = 0;
    
    items.forEach(i => {
      const amt = parseFloat(i.amount) || 0;
      let usdVal = 0;
      let lrdVal = 0;
      if (i.currency === 'USD') {
        usdVal = amt;
        lrdVal = amt * rate;
      } else {
        lrdVal = amt;
        usdVal = amt / rate;
      }
      
      if (i.status === 'Approved') {
        approvedUsd += usdVal;
        approvedLrd += lrdVal;
      } else if (i.status === 'Dispensed' || i.status === 'Approved & Dispensed') {
        dispensedUsd += usdVal;
        dispensedLrd += lrdVal;
      }
    });
    
    const sumUsd = approvedUsd + dispensedUsd;
    const sumLrd = approvedLrd + dispensedLrd;
    return { 
      usd: sumUsd.toFixed(2), 
      lrd: sumLrd.toFixed(2),
      approvedUsd: approvedUsd.toFixed(2),
      approvedLrd: approvedLrd.toFixed(2),
      dispensedUsd: dispensedUsd.toFixed(2),
      dispensedLrd: dispensedLrd.toFixed(2)
    };
  };

  const getReportTotals = () => {
    const rate = parseFloat(activeBudget?.exchangeRate) || activeRate || 150;
    let approvedUsd = 0;
    let approvedLrd = 0;
    let dispensedUsd = 0;
    let dispensedLrd = 0;
    
    filteredBudgetItems.forEach(i => {
      const amt = parseFloat(i.amount) || 0;
      let usdVal = 0;
      let lrdVal = 0;
      if (i.currency === 'USD') {
        usdVal = amt;
        lrdVal = amt * rate;
      } else {
        lrdVal = amt;
        usdVal = amt / rate;
      }
      
      if (i.status === 'Approved') {
        approvedUsd += usdVal;
        approvedLrd += lrdVal;
      } else if (i.status === 'Dispensed' || i.status === 'Approved & Dispensed') {
        dispensedUsd += usdVal;
        dispensedLrd += lrdVal;
      }
    });
    
    const totalApprovedUsd = approvedUsd + dispensedUsd;
    const totalApprovedLrd = approvedLrd + dispensedLrd;
    
    return {
      approved: { usd: totalApprovedUsd, lrd: totalApprovedLrd },
      dispensed: { usd: dispensedUsd, lrd: dispensedLrd },
      net: { usd: totalApprovedUsd - dispensedUsd, lrd: totalApprovedLrd - dispensedLrd }
    };
  };

  const handleExportPNG = () => {
    const element = document.getElementById('budget-report-container');
    if (!element) return;
    
    const originalStyle = element.getAttribute('style') || '';
    
    // Force desktop styling and size
    element.style.width = '800px';
    element.style.minWidth = '800px';
    element.style.maxWidth = '800px';
    
    html2canvas(element, {
      backgroundColor: '#ffffff',
      scale: 2,
      useCORS: true,
      logging: false,
      windowWidth: 1024
    }).then(canvas => {
      element.setAttribute('style', originalStyle);
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `${activeBudget.name.replace(/\s+/g, '_')}_Report.png`;
      link.href = dataUrl;
      link.click();
    }).catch(err => {
      element.setAttribute('style', originalStyle);
      console.error('Failed to export PNG', err);
      alert('Error generating PNG. Please try again.');
    });
  };

  const handleExportPDF = () => {
    const element = document.getElementById('budget-report-container');
    if (!element) return;
    
    const originalStyle = element.getAttribute('style') || '';
    
    // Force desktop styling and size
    element.style.width = '800px';
    element.style.minWidth = '800px';
    element.style.maxWidth = '800px';
    
    html2canvas(element, {
      backgroundColor: '#ffffff',
      scale: 2,
      useCORS: true,
      logging: false,
      windowWidth: 1024
    }).then(canvas => {
      element.setAttribute('style', originalStyle);
      
      const imgData = canvas.toDataURL('image/png');
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const orientation = imgWidth > imgHeight ? 'l' : 'p';
      
      const pdf = new jsPDF({
        orientation: orientation,
        unit: 'mm',
        format: 'a4'
      });
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const ratio = imgHeight / imgWidth;
      const width = pdfWidth;
      const height = pdfWidth * ratio;
      
      pdf.addImage(imgData, 'PNG', 0, 0, width, height);
      pdf.save(`${activeBudget.name.replace(/\s+/g, '_')}_Report.pdf`);
    }).catch(err => {
      element.setAttribute('style', originalStyle);
      console.error('Failed to export PDF', err);
      alert('Error generating PDF. Please try again.');
    });
  };

  const handleExportCSV = () => {
    if (!filteredBudgetItems.length) return alert("No items to export.");
    
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Category,Description,Amount,Currency,Approval Status,Converted USD,Converted LRD\r\n";
    
    const rate = parseFloat(activeBudget?.exchangeRate) || activeRate || 150;
    
    Object.keys(groupedItems).forEach(category => {
      csvContent += `"[CATEGORY: ${category.toUpperCase().replace(/"/g, '""')}]",,,,,\r\n`;
      
      groupedItems[category].forEach(item => {
        const amt = parseFloat(item.amount) || 0;
        let convertedUSD = 0;
        let convertedLRD = 0;
        if (item.currency === 'USD') {
          convertedUSD = amt;
          convertedLRD = amt * rate;
        } else {
          convertedLRD = amt;
          convertedUSD = amt / rate;
        }
        
        const row = [
          category.toUpperCase(),
          item.description,
          item.amount,
          item.currency,
          item.status === 'Dispensed' ? 'Approved & Dispensed' : (item.status || 'Pending Review'),
          convertedUSD.toFixed(2),
          convertedLRD.toFixed(2)
        ].map(val => {
          const stringVal = String(val);
          if (stringVal.includes(',') || stringVal.includes('"') || stringVal.includes('\n')) {
            return `"${stringVal.replace(/"/g, '""')}"`;
          }
          return stringVal;
        }).join(",");
        
        csvContent += row + "\r\n";
      });
      
      const subtotal = getCategorySubtotal(groupedItems[category]);
      csvContent += `Subtotal (${category.toUpperCase().replace(/"/g, '""')}),,,,$${subtotal.usd} USD,L$${subtotal.lrd}\r\n`;
      csvContent += ",,,,,\r\n";
    });
    
    const totals = getReportTotals();
    csvContent += `Total Approved Items,,,,,$${totals.approved.usd.toFixed(2)} USD,L$${totals.approved.lrd.toFixed(2)}\r\n`;
    csvContent += `Total Approved & Dispensed,,,,,-$${totals.dispensed.usd.toFixed(2)} USD,-L$${totals.dispensed.lrd.toFixed(2)}\r\n`;
    csvContent += `Actually Sent Amount,,,,,$${totals.net.usd.toFixed(2)} USD,L$${totals.net.lrd.toFixed(2)}\r\n`;
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${activeBudget.name.replace(/\s+/g, '_')}_Report.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getInitBudget = React.useCallback(() => ({ ...INIT_BUDGET, exchangeRate: activeRate }), [activeRate]);

  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (!isInitialized && activeRate) {
      setBudgetForm(prev => ({ ...prev, exchangeRate: activeRate }));
      setIsInitialized(true);
    }
  }, [activeRate, isInitialized]);

  // One-time data fix: ensure budget categories exist in settings
  useEffect(() => {
    const defaultBudgetCats = ['Equipment Leasing/Repair', 'Logistics & Transport', 'Materials & Seeds', 'Miscellaneous', 'Operating Expenses', 'Payroll'];
    let changed = false;
    defaultBudgetCats.forEach(cat => {
      if (!expenseCategories.includes(cat)) {
        dispatch(addExpenseCategory(cat));
        changed = true;
      }
    });
    if (changed) {
      dispatch(saveSettings());
    }
  }, [expenseCategories, dispatch]);

  const handleCreateBudget = (e) => {
    e.preventDefault();
        if (!budgetForm.name) return alert("Budget Name required.");
    const newRate = parseFloat(budgetForm.exchangeRate) || 1;

    const newBudget = {
      id: `b_${Date.now()}`,
      name: budgetForm.name,
      description: budgetForm.description,
      exchangeRate: newRate,
      sendingService: budgetForm.sendingService || '',
      referenceNumber: budgetForm.referenceNumber || '',
      recipient: budgetForm.recipient || '',
      items: []
    };

    dispatch(addBudget(newBudget));
    dispatch(queueAction({ type: 'budgets/upsertBudget', payload: newBudget, meta: { id: Date.now() } }));

    setBudgetForm(getInitBudget());
    setActiveBudgetId(newBudget.id);
  };

  const handleUpdateBudgetProperty = (key, value) => {
    if (!activeBudget) return;
    const updated = { ...activeBudget, [key]: value };
    dispatch(addBudget(updated));
    dispatch(queueAction({ type: 'core/updateNode', payload: { id: activeBudget.id, properties: { [key]: value } }, meta: { id: Date.now() } }));
  };

  const handleUpdateExchangeRate = (e) => {
    const val = parseFloat(e.target.value);
    if (!activeBudget || isNaN(val)) return;
    handleUpdateBudgetProperty('exchangeRate', val);
  };

  const handleSaveItem = (e) => {
    e.preventDefault();
        if (!activeBudget) return alert("Select a budget first.");
    if (!itemForm.description || !itemForm.amount) return alert("Fill out the required item data.");

    const finalItem = {
      ...itemForm,
      id: editingItemId || `bli_${Date.now()}`,
      amount: parseFloat(itemForm.amount) || 0
    };

    dispatch(addBudgetItem({ budgetId: activeBudget.id, item: finalItem }));

    // Graph sync: We sync the item creation and linkage
    dispatch(queueAction({
      type: 'budgets/upsertBudgetItem',
      payload: { budgetId: activeBudget.id, item: finalItem },
      meta: { id: Date.now() }
    }));

    setItemForm(INIT_ITEM);
    setEditingItemId(null);
  };

  const handleGeneratePayroll = () => {
    if (!activeBudget) return;
    if (!budgetFromDate || !budgetToDate) return alert("Select From and To dates.");

    const rangeAssignments = assignments.filter(a =>
      a.assignmentDate >= budgetFromDate && a.assignmentDate <= budgetToDate
    );

    const dailyWorkerDays = {}; // employeeId -> Set of dates
    rangeAssignments.forEach(a => {
      if (a.workerIds) {
        a.workerIds.forEach(id => {
          if (!dailyWorkerDays[id]) dailyWorkerDays[id] = new Set();
          dailyWorkerDays[id].add(a.assignmentDate);
        });
      }
    });

    let totalDailyLD = 0;
    Object.keys(dailyWorkerDays).forEach(empId => {
      const emp = employeesList.find(e => e.id === empId);
      if (emp && emp.type === 'Daily') {
        const daysWorked = dailyWorkerDays[empId].size;
        const rate = parseFloat(emp.dailyRateLD) || 0;
        totalDailyLD += (daysWorked * rate);
      }
    });

    const exRate = parseFloat(activeBudget.exchangeRate) || 1;
    const totalDailyUSD = exRate > 0 ? (totalDailyLD / exRate) : 0;

    const newItems = [];

    if (totalDailyUSD > 0) {
      newItems.push({
        id: `bli_${Date.now()}_daily`,
        category: 'Payroll',
        description: 'Labor Pay (Daily Farm Workers)',
        amount: parseFloat(totalDailyUSD.toFixed(2)),
        currency: 'USD',
        status: 'Pending Review'
      });
    }

    const nonDailyWorkers = employeesList.filter(e => e.type !== 'Daily' && !e.isTerminated);
    const nonDailyByTitle = {};
    nonDailyWorkers.forEach(emp => {
      const title = emp.jobTitle || 'Uncategorized Staff';
      // Group security guards into one bucket as specified
      const groupedTitle = title.toLowerCase().includes('security') ? 'NMK Security' : title;
      if (!nonDailyByTitle[groupedTitle]) nonDailyByTitle[groupedTitle] = 0;
      nonDailyByTitle[groupedTitle] += (parseFloat(emp.twoWeekPayUSD) || 0);
    });

    Object.keys(nonDailyByTitle).forEach((title, idx) => {
      if (nonDailyByTitle[title] > 0) {
        newItems.push({
          id: `bli_${Date.now()}_nd_${idx}`,
          category: 'Payroll',
          description: title,
          amount: parseFloat(nonDailyByTitle[title].toFixed(2)),
          currency: 'USD',
          status: 'Pending Review'
        });
      }
    });

    if (newItems.length === 0) {
      alert("No payroll data calculated for this period.");
      return;
    }

    newItems.forEach((item, index) => {
      const finalItem = { ...item, id: `${item.id}_${index}` };
      dispatch(addBudgetItem({ budgetId: activeBudget.id, item: finalItem }));
      dispatch(queueAction({
        type: 'budgets/upsertBudgetItem',
        payload: { budgetId: activeBudget.id, item: finalItem },
        meta: { id: Date.now() + index }
      }));
    });

    alert(`Successfully generated and inserted ${newItems.length} payroll budget item(s).`);
  };

  const handleGenerateExpenses = () => {
    if (!activeBudget) return;
    const approvedUnlinkedItems = activeBudget.items.filter(i => i.status === 'Approved' && !i.linkedTxId);
    
    if (approvedUnlinkedItems.length === 0) {
      alert("No approved budget items are pending for Ledger generation.");
      return;
    }

    const proposedTxs = approvedUnlinkedItems.map(item => ({
      ...item,
      proposedTxId: `t_${Date.now()}_${item.id}`
    }));

    const initialSelections = {};
    proposedTxs.forEach(tx => { initialSelections[tx.id] = true; });

    setPendingLedgerExpenses(proposedTxs);
    setSelectedExpensesToSubmit(initialSelections);
    setShowExpenseReview(true);
  };

  const handleSubmitExpensesToLedger = () => {
    const itemsToSubmit = pendingLedgerExpenses.filter(i => selectedExpensesToSubmit[i.id]);
    if (itemsToSubmit.length === 0) return alert("Select at least one item to submit to the ledger.");

    const todayStr = new Date().toISOString().split('T')[0];

    itemsToSubmit.forEach(item => {
      // 1. Create Transaction
      const txPayload = {
        id: item.proposedTxId,
        txType: 'Expense',
        category: item.category || 'Operating Expenses',
        amount: item.currency === 'USD' ? item.amount : '',
        amountLd: item.currency === 'LRD' ? item.amount : '',
        exchangeRate: activeBudget.exchangeRate || activeRate || 150,
        vendor: `Budgeted: ${activeBudget.name}`,
        notes: item.description || '',
        date: todayStr,
        assetId: ''
      };

      dispatch(addTransaction(txPayload));
      dispatch(queueAction({ type: 'financials/addTransaction', payload: txPayload, meta: { id: Date.now() + Math.random() } }));

      // 2. Update Budget Item with linkedTxId
      const updatedItem = { ...activeBudget.items.find(i => i.id === item.id), linkedTxId: item.proposedTxId };
      dispatch(addBudgetItem({ budgetId: activeBudget.id, item: updatedItem }));
      dispatch(queueAction({
        type: 'budgets/upsertBudgetItem',
        payload: { budgetId: activeBudget.id, item: updatedItem },
        meta: { id: Date.now() + Math.random() }
      }));
    });

    setPendingLedgerExpenses([]);
    setShowExpenseReview(false);
    setSelectedExpensesToSubmit({});
    alert(`Successfully posted ${itemsToSubmit.length} transaction(s) to the Finance Ledger.`);
  };

  const calculateTotals = () => {
    if (!activeBudget || !activeBudget.items) return { totalUSD: 0, totalLRD: 0 };
    const rate = parseFloat(activeBudget.exchangeRate) || activeRate || 150;

    let usd = 0;
    let lrd = 0;

    activeBudget.items.forEach(i => {
      if (i.status !== 'Approved') return;
      const amt = parseFloat(i.amount) || 0;
      if (i.currency === 'USD') {
        usd += amt;
        lrd += (amt * rate);
      } else {
        lrd += amt;
        usd += (amt / rate);
      }
    });

    return { totalUSD: usd.toFixed(2), totalLRD: lrd.toFixed(2) };
  };

  const { totalUSD, totalLRD } = calculateTotals();

  const itemCols = [
    { key: 'category', header: 'Category' },
    { key: 'description', header: 'Description' },
    { key: 'amount', header: 'Entered Amount', render: r => `${r.currency === 'USD' ? '$' : 'L$'}${parseFloat(r.amount).toLocaleString()}` },
    {
      key: 'converted',
      header: 'Converted',
      render: r => {
        const amt = parseFloat(r.amount) || 0;
        const rate = parseFloat(activeBudget?.exchangeRate) || activeRate || 150;
        if (r.currency === 'USD') return `L$${(amt * rate).toLocaleString()}`;
        return `$${(amt / rate).toFixed(2)}`;
      }
    },
    {
      key: 'status',
      header: 'Approval Status',
      render: r => {
        const getStatusColor = (status) => {
          switch (status) {
            case 'Approved':
              return { bg: '#e8f5e9', fg: '#2e7d32', border: '#c8e6c9' };
            case 'Rejected':
              return { bg: '#ffebee', fg: '#c62828', border: '#ffcdd2' };
            case 'Dispensed':
            case 'Approved & Dispensed':
              return { bg: '#e8eaf6', fg: '#1a237e', border: '#c5cae9' };
            default: // Pending Review
              return { bg: '#fff3e0', fg: '#ef6c00', border: '#ffe0b2' };
          }
        };

        const colors = getStatusColor(r.status || 'Pending Review');

        if (hasApprovalPermission) {
          return (
            <select
              value={r.status === 'Dispensed' ? 'Approved & Dispensed' : (r.status || 'Pending Review')}
              onClick={e => e.stopPropagation()}
              onChange={e => {
                e.stopPropagation();
                const newStatus = e.target.value;
                const updatedItem = { ...r, status: newStatus };
                dispatch(addBudgetItem({ budgetId: activeBudget.id, item: updatedItem }));
                dispatch(queueAction({
                  type: 'budgets/upsertBudgetItem',
                  payload: { budgetId: activeBudget.id, item: updatedItem },
                  meta: { id: Date.now() }
                }));
              }}
              style={{
                padding: '4px 8px',
                fontSize: '0.85rem',
                borderRadius: '4px',
                border: `1px solid ${colors.border}`,
                background: colors.bg,
                color: colors.fg,
                fontWeight: 600,
                cursor: 'pointer',
                outline: 'none'
              }}
            >
              <option value="Approved" style={{ background: '#fff', color: '#2e7d32' }}>Approved</option>
              <option value="Pending Review" style={{ background: '#fff', color: '#ef6c00' }}>Pending Review</option>
              <option value="Rejected" style={{ background: '#fff', color: '#c62828' }}>Rejected</option>
              <option value="Approved & Dispensed" style={{ background: '#fff', color: '#1a237e' }}>Approved & Dispensed</option>
            </select>
          );
        }

        return (
          <span style={{
            display: 'inline-block',
            padding: '4px 8px',
            borderRadius: '4px',
            fontSize: '0.85rem',
            fontWeight: 600,
            background: colors.bg,
            color: colors.fg,
            border: `1px solid ${colors.border}`
          }}>
            {r.status === 'Dispensed' ? 'Approved & Dispensed' : (r.status || 'Pending Review')}
          </span>
        );
      }
    }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* 1. Global Budget Selector */}
      <div className="card" style={{ marginBottom: 0 }}>
        <h2>Budget Management Portfolios</h2>
        <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: 10, marginTop: 15 }}>
          {budgets.map(b => (
            <button
              key={b.id}
              onClick={() => setActiveBudgetId(b.id)}
              className={`btn ${activeBudgetId === b.id ? 'btn-primary' : ''}`}
              style={{ padding: '8px 16px', whiteSpace: 'nowrap', borderRadius: 20 }}
            >
              <FileText size={14} style={{ marginRight: 6, display: 'inline-block' }} />
              {b.name}
            </button>
          ))}
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid var(--color-border)', margin: '20px 0' }} />

        <h4>Create New Budget Pipeline</h4>
        <form onSubmit={handleCreateBudget} style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: 10 }}>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <input type="text" placeholder="e.g. Q3 Harvest Plan *" value={budgetForm.name} onChange={e => setBudgetForm({ ...budgetForm, name: e.target.value })} style={{ flex: 2, minWidth: 200 }} required />
            <input type="text" placeholder="Short Description..." value={budgetForm.description} onChange={e => setBudgetForm({ ...budgetForm, description: e.target.value })} style={{ flex: 3, minWidth: 200 }} />
            <input 
              type="number" 
              step="0.01"
              placeholder="Ex. Rate (L$ to 1 USD)" 
              value={budgetForm.exchangeRate} 
              onChange={e => setBudgetForm({ ...budgetForm, exchangeRate: e.target.value })} 
              style={{ width: 180 }} 
              title="Exchange Rate: L$ to 1 USD"
            />
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
            <input type="text" placeholder="Money Sending Service (e.g. Western Union, Mobile Money)" value={budgetForm.sendingService || ''} onChange={e => setBudgetForm({ ...budgetForm, sendingService: e.target.value })} style={{ flex: 1, minWidth: 200 }} />
            <input type="text" placeholder="Transaction Reference Number" value={budgetForm.referenceNumber || ''} onChange={e => setBudgetForm({ ...budgetForm, referenceNumber: e.target.value })} style={{ flex: 1, minWidth: 200 }} />
            <input type="text" placeholder="Sent To / Recipient" value={budgetForm.recipient || ''} onChange={e => setBudgetForm({ ...budgetForm, recipient: e.target.value })} style={{ flex: 1, minWidth: 200 }} />
            <button type="submit" className="btn btn-primary" style={{ padding: '10px 20px' }}>Initiate</button>
          </div>
        </form>
      </div>

      {/* 2. Active Budget Studio */}
      {activeBudget && (
        <div className="card" style={{ marginBottom: 0, borderTop: '4px solid var(--color-primary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 20 }}>
            <div style={{ flex: 1, minWidth: '300px' }}>
              <h2 style={{ color: 'var(--color-primary-dark)', display: 'flex', alignItems: 'center' }}>
                {activeBudget.name}
                <button onClick={() => {
                  if (window.confirm('Delete this entire budget permanently?')) {
                    dispatch(deleteBudget(activeBudget.id));
                    dispatch(queueAction({ type: 'core/deleteNode', payload: { id: activeBudget.id }, meta: { id: Date.now() } }));
                    setActiveBudgetId(null);
                  }
                }} style={{ border: 'none', background: 'transparent', color: '#d32f2f', marginLeft: 16, cursor: 'pointer' }}><Trash2 size={18} /></button>
              </h2>
              <p style={{ color: '#555', marginTop: 4, marginBottom: 12 }}>{activeBudget.description}</p>

              {/* Transaction Sending Tracking Fields */}
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', background: '#f8fafc', padding: '12px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', marginTop: '10px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, minWidth: '150px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>Money Sending Service</label>
                  <input 
                    type="text" 
                    placeholder="MTN, Western Union, Sendwave..." 
                    value={activeBudget.sendingService || ''} 
                    onChange={e => handleUpdateBudgetProperty('sendingService', e.target.value)} 
                    style={{ padding: '6px 10px', fontSize: '0.85rem', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, minWidth: '150px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>Reference Number</label>
                  <input 
                    type="text" 
                    placeholder="Transaction Reference ID" 
                    value={activeBudget.referenceNumber || ''} 
                    onChange={e => handleUpdateBudgetProperty('referenceNumber', e.target.value)} 
                    style={{ padding: '6px 10px', fontSize: '0.85rem', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, minWidth: '150px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>Sent To (Recipient)</label>
                  <input 
                    type="text" 
                    placeholder="Who it was sent to" 
                    value={activeBudget.recipient || ''} 
                    onChange={e => handleUpdateBudgetProperty('recipient', e.target.value)} 
                    style={{ padding: '6px 10px', fontSize: '0.85rem', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                  />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'stretch' }}>
              <div style={{ background: '#e8f5e9', padding: '10px 16px', borderRadius: 8, border: '1px solid #c8e6c9', textAlign: 'right', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div style={{ fontSize: '0.75rem', color: '#2e7d32', fontWeight: 600 }}>AGGREGATED LIABILITIES</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#1b5e20' }}>${totalUSD} USD</div>
                <div style={{ fontSize: '0.9rem', color: '#388e3c' }}>≈ L${totalLRD}</div>
              </div>

              <div style={{ background: '#f5f5f5', padding: '10px 16px', borderRadius: 8, border: '1px solid #e0e0e0', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div style={{ fontSize: '0.75rem', color: '#555', fontWeight: 600, marginBottom: 4 }}>EXCHANGE RATE</div>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span style={{ marginRight: 6, fontWeight: 'bold' }}>L$</span>
                  <input type="number" value={activeBudget.exchangeRate} onChange={handleUpdateExchangeRate} style={{ width: 120, padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem', color: '#334155' }} />
                  <span style={{ marginLeft: 6 }}>/ USD</span>
                </div>
              </div>

              <button 
                onClick={() => setShowReportModal(true)} 
                className="btn btn-primary"
                style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  justifyContent: 'center', 
                  alignItems: 'center', 
                  padding: '10px 16px', 
                  borderRadius: 8, 
                  background: 'var(--color-primary)', 
                  border: 'none',
                  color: 'white',
                  cursor: 'pointer',
                  gap: '4px',
                  fontWeight: 600,
                  fontSize: '0.95rem'
                }}
              >
                <FileText size={20} />
                <span>Budget Report</span>
              </button>
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--color-border)', margin: '20px 0' }} />

          {/* Payroll Generator Block */}
          <div style={{ background: '#f0f4c3', padding: 15, borderRadius: 8, marginBottom: 20, border: '1px solid #cddc39' }}>
            <label style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', cursor: 'pointer', color: '#558b2f' }}>
              <input type="checkbox" checked={isNmkBudget} onChange={e => setIsNmkBudget(e.target.checked)} style={{ marginRight: 8, width: 30, height: 30 }} />
              NMK 2-Week Budget Auto-Payroll
            </label>

            {isNmkBudget && (
              <div style={{ marginTop: 15, display: 'flex', gap: 15, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ color: '#558b2f' }}>From Date</label>
                  <input type="date" value={budgetFromDate} onChange={e => setBudgetFromDate(e.target.value)} style={{ border: '1px solid #cddc39' }} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ color: '#558b2f' }}>To Date</label>
                  <input type="date" value={budgetToDate} onChange={e => setBudgetToDate(e.target.value)} style={{ border: '1px solid #cddc39' }} />
                </div>
                <button
                  type="button"
                  onClick={handleGeneratePayroll}
                  className="btn btn-primary"
                  disabled={!budgetFromDate || !budgetToDate}
                  style={{ padding: '10px 16px', background: '#827717', color: 'white', border: 'none' }}
                >
                  <Calculator size={16} style={{ marginRight: 6, display: 'inline-block', verticalAlign: 'text-bottom' }} />
                  Generate Payroll Items
                </button>
              </div>
            )}
          </div>

          {/* Budget to Ledger Linkage - Moved right below Payroll */}
          <div style={{ marginTop: 20, marginBottom: 20, background: '#e3f2fd', padding: 20, borderRadius: 8, border: '1px solid #90caf9' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ color: '#1565c0', margin: 0 }}>Ledger Integration</h3>
                <p style={{ color: '#1976d2', fontSize: '0.9rem', marginTop: 5 }}>Generate official finance expenses from approved budget items.</p>
              </div>
              <button onClick={handleGenerateExpenses} className="btn btn-primary" style={{ background: '#1565c0', border: 'none' }}>
                <ArrowRightCircle size={18} style={{ marginRight: 6 }} /> Generate Ledger Items
              </button>
            </div>

            {showExpenseReview && pendingLedgerExpenses.length > 0 && (
              <div style={{ marginTop: 20, background: '#ffffff', padding: 15, borderRadius: 8, border: '1px solid #bbdefb' }}>
                <h4 style={{ marginBottom: 15, color: '#0d47a1' }}>Pending Review: Generated Ledger Items</h4>
                <div style={{ maxHeight: 300, overflowY: 'auto', overflowX: 'auto', width: '100%', marginBottom: 15 }}>
                  <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #e0e0e0', textAlign: 'left' }}>
                        <th style={{ padding: '8px 4px' }}>Approve</th>
                        <th style={{ padding: '8px 4px' }}>Category</th>
                        <th style={{ padding: '8px 4px' }}>Description</th>
                        <th style={{ padding: '8px 4px' }}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingLedgerExpenses.map(item => (
                        <tr key={item.id} style={{ borderBottom: '1px solid #eeeeee' }}>
                          <td style={{ padding: '8px 4px', textAlign: 'center' }}>
                            <input 
                              type="checkbox" 
                              checked={selectedExpensesToSubmit[item.id] || false} 
                              onChange={(e) => setSelectedExpensesToSubmit(prev => ({ ...prev, [item.id]: e.target.checked }))} 
                              style={{ width: 18, height: 18, cursor: 'pointer' }}
                            />
                          </td>
                          <td style={{ padding: '8px 4px' }}>{item.category}</td>
                          <td style={{ padding: '8px 4px' }}>{item.description}</td>
                          <td style={{ padding: '8px 4px', fontWeight: 'bold' }}>{item.currency === 'USD' ? '$' : 'L$'}{item.amount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                  <button onClick={() => setShowExpenseReview(false)} className="btn" style={{ background: '#f5f5f5', color: '#333' }}>Cancel</button>
                  <button onClick={handleSubmitExpensesToLedger} className="btn btn-primary" style={{ background: '#2e7d32', border: 'none' }}>
                    Approve to Generate Expenses
                  </button>
                </div>
              </div>
            )}
          </div>

          <h3 style={{ marginBottom: 15, display: 'flex', alignItems: 'center' }}>
            <Calculator size={18} style={{ marginRight: 8 }} /> {editingItemId ? 'Edit Line Item' : 'Add New Line Item'}
          </h3>
          <form onSubmit={handleSaveItem} className="form-grid" style={{ marginBottom: 30, background: '#fafafa', padding: 15, borderRadius: 8, border: '1px dashed #ccc' }}>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', gridColumn: '1 / -1', justifyContent: 'flex-end' }}>
              {editingItemId && (
                <button type="button" onClick={() => { setEditingItemId(null); setItemForm(INIT_ITEM); }} className="btn" style={{ background: '#efefef', color: '#333' }}>
                  Cancel
                </button>
              )}
              <button type="submit" className="btn btn-primary" style={{ padding: '10px 16px', display: 'flex', gap: 6 }}>
                {editingItemId ? <Check size={16} /> : <Plus size={16} />} {editingItemId ? 'Update' : 'Add Item'}
              </button>
            </div>
            <div className="form-group">
              <label>Category</label>
              <select value={itemForm.category} onChange={e => setItemForm({ ...itemForm, category: e.target.value })}>
                <option value="">Select...</option>
                {expenseCategories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Resource Description</label>
              <input type="text" value={itemForm.description} onChange={e => setItemForm({ ...itemForm, description: e.target.value })} placeholder="e.g. 50 bags of NPK fertilizer" />
            </div>
            <div className="form-group" style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 2 }}>
                <label>Nominal Amount</label>
                <input type="number" step="0.01" value={itemForm.amount} onChange={e => setItemForm({ ...itemForm, amount: e.target.value })} />
              </div>
              <div style={{ flex: 1 }}>
                <label>Currency</label>
                <select value={itemForm.currency} onChange={e => setItemForm({ ...itemForm, currency: e.target.value })}>
                  <option value="LRD">LRD</option>
                  <option value="USD">USD</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label>Approval Status</label>
              <select 
                value={itemForm.status === 'Dispensed' ? 'Approved & Dispensed' : itemForm.status} 
                disabled={!hasApprovalPermission}
                onChange={e => setItemForm({ ...itemForm, status: e.target.value })}
                style={{
                  background: !hasApprovalPermission ? '#f1f5f9' : '#fff',
                  cursor: !hasApprovalPermission ? 'not-allowed' : 'pointer'
                }}
              >
                <option value="Approved">Approved</option>
                <option value="Pending Review">Pending Review</option>
                <option value="Rejected">Rejected</option>
                <option value="Approved & Dispensed">Approved & Dispensed</option>
              </select>
            </div>
          </form>

          {/* Filters Bar */}
          <div style={{ 
            display: 'flex', 
            gap: '15px', 
            alignItems: 'center', 
            flexWrap: 'wrap', 
            background: '#f8fafc', 
            padding: '12px 20px', 
            borderRadius: '8px', 
            border: '1px solid #e2e8f0',
            marginBottom: '15px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontWeight: 600, fontSize: '0.9rem' }}>
              <Filter size={16} />
              <span>Filter Items:</span>
            </div>
            
            <div style={{ display: 'flex', gap: '15px', flex: 1, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 500 }}>Category:</span>
                <select 
                  value={filterCategory} 
                  onChange={e => setFilterCategory(e.target.value)}
                  style={{
                    padding: '6px 12px',
                    fontSize: '0.85rem',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    background: '#fff',
                    color: '#334155',
                    cursor: 'pointer',
                    outline: 'none'
                  }}
                >
                  <option value="All">All Categories</option>
                  {expenseCategories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: '220px' }}>
                <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 500 }}>Statuses:</span>
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <Select
                    isMulti
                    options={[
                      { value: 'Approved', label: 'Approved' },
                      { value: 'Pending Review', label: 'Pending Review' },
                      { value: 'Rejected', label: 'Rejected' },
                      { value: 'Approved & Dispensed', label: 'Approved & Dispensed' }
                    ]}
                    value={[
                      { value: 'Approved', label: 'Approved' },
                      { value: 'Pending Review', label: 'Pending Review' },
                      { value: 'Rejected', label: 'Rejected' },
                      { value: 'Approved & Dispensed', label: 'Approved & Dispensed' }
                    ].filter(opt => filterStatuses.includes(opt.value))}
                    onChange={selectedOptions => {
                      const values = selectedOptions ? selectedOptions.map(opt => opt.value) : [];
                      setFilterStatuses(values);
                    }}
                    placeholder="All Statuses"
                    menuPortalTarget={document.body}
                    styles={{
                      control: (base) => ({
                        ...base,
                        minHeight: '36px',
                        borderRadius: '6px',
                        borderColor: '#cbd5e1',
                        fontSize: '0.85rem',
                        boxShadow: 'none',
                        '&:hover': {
                          borderColor: '#a8b2c1'
                        }
                      }),
                      option: (base) => ({ ...base, fontSize: '0.85rem' }),
                      multiValue: (base) => ({ ...base, backgroundColor: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '4px' }),
                      multiValueLabel: (base) => ({ ...base, color: '#334155', fontWeight: 500, fontSize: '0.75rem' }),
                      multiValueRemove: (base) => ({ ...base, ':hover': { backgroundColor: '#e2e8f0', color: '#0f172a' } }),
                      menuPortal: (base) => ({ ...base, zIndex: 9999 })
                    }}
                  />
                </div>
              </div>
            </div>

            {(filterCategory !== 'All' || filterStatuses.length > 0) && (
              <button 
                type="button" 
                onClick={() => { setFilterCategory('All'); setFilterStatuses([]); }}
                className="btn"
                style={{
                  padding: '6px 12px',
                  fontSize: '0.85rem',
                  color: '#64748b',
                  background: '#f1f5f9',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                Clear Filters
              </button>
            )}
          </div>

          <CrudTable
            data={filteredBudgetItems}
            columns={itemCols}
            onEdit={(row) => { setItemForm(row); setEditingItemId(row.id); }}
            onDelete={(id) => {
              dispatch(deleteBudgetItem({ budgetId: activeBudget.id, itemId: id }));
              dispatch(queueAction({ type: 'core/deleteNode', payload: { id }, meta: { id: Date.now() } }));
            }}
            itemLabel="Budget Item"
            defaultSort={{ key: 'category', direction: 'asc' }}
          />
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
            width: '90%',
            maxWidth: '750px',
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
              <h3 style={{ margin: 0, color: '#1e293b', fontSize: '1rem' }}>Generate Budget Report</h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={handleExportCSV} className="btn" style={{ background: '#e2e8f0', color: '#334155', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', padding: '6px 12px' }}>
                  Export to CSV
                </button>
                <button onClick={handleExportPNG} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', padding: '6px 12px' }}>
                  Export to PNG
                </button>
                <button onClick={handleExportPDF} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', padding: '6px 12px', background: '#2563eb', borderColor: '#2563eb' }}>
                  Export to PDF
                </button>
                <button onClick={() => setShowReportModal(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}>
                  <X size={18} color="#64748b" />
                </button>
              </div>
            </div>

            {/* Modal Body (Scrollable container for report) */}
            <div style={{ overflowY: 'auto', flex: 1, padding: '20px' }}>
              <div id="budget-report-container" style={{
                background: 'white',
                color: '#1e293b',
                fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                padding: '16px',
                borderRadius: '6px',
                border: '1px solid #e2e8f0',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px'
              }}>
                {/* Letterhead Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', borderBottom: '3px solid var(--color-primary-dark, #1b5e20)', paddingBottom: '12px' }}>
                  {logo ? (
                    <img src={logo} alt="Company Logo" style={{ maxHeight: '90px', maxWidth: '240px', objectFit: 'contain' }} />
                  ) : (
                    <NmkLogo size={90} />
                  )}
                  <div style={{ flex: 1 }}>
                    <h1 style={{ margin: 0, color: 'var(--color-primary-dark, #1b5e20)', fontSize: '1rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      {activeBudget.name}
                    </h1>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px', fontWeight: 500 }}>
                      NMK Farm, Kamigbo, Senjeh District, Bomi County, Liberia • Official Budget Report
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>
                    <div><strong>Date:</strong> {new Date().toLocaleDateString()}</div>
                    <div><strong>Ex. Rate:</strong> L$ {activeBudget.exchangeRate} / USD</div>
                  </div>
                </div>

                {/* Transaction sending details if any */}
                {(activeBudget.sendingService || activeBudget.referenceNumber || activeBudget.recipient) && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '8px', background: '#f8fafc', padding: '10px 14px', borderRadius: '6px', fontSize: '0.75rem', color: '#475569', border: '1px dashed #cbd5e1' }}>
                    {activeBudget.sendingService && (
                      <div><strong>Sending Service:</strong> {activeBudget.sendingService}</div>
                    )}
                    {activeBudget.referenceNumber && (
                      <div><strong>Reference Number:</strong> {activeBudget.referenceNumber}</div>
                    )}
                    {activeBudget.recipient && (
                      <div><strong>Sent To:</strong> {activeBudget.recipient}</div>
                    )}
                  </div>
                )}

                {/* Filters info if any */}
                {(filterCategory !== 'All' || filterStatuses.length > 0) && (
                  <div style={{ background: '#f8fafc', padding: '8px 12px', borderRadius: '6px', fontSize: '0.75rem', color: '#64748b', border: '1px dashed #cbd5e1' }}>
                    <strong>Active Filters:</strong> {filterCategory !== 'All' && `Category: ${filterCategory}`} {filterStatuses.length > 0 && `${filterCategory !== 'All' ? ' • ' : ''}Status: ${filterStatuses.join(', ')}`}
                  </div>
                )}

                {/* Grouped items by category */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {Object.keys(groupedItems).length === 0 ? (
                    <div style={{ textAlign: 'center', color: '#64748b', fontStyle: 'italic', padding: '30px 0', fontSize: '0.85rem' }}>
                      No budget items match the active filters.
                    </div>
                  ) : (
                    Object.keys(groupedItems).map(category => {
                      const items = groupedItems[category];
                      const subtotal = getCategorySubtotal(items);
                      return (
                        <div key={category} style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
                          <h3 style={{ margin: '0 0 8px 0', color: 'var(--color-primary-dark, #1b5e20)', fontSize: '0.95rem', fontWeight: 700, borderBottom: '1px solid #e2e8f0', paddingBottom: '4px', textTransform: 'uppercase' }}>
                            {category}
                          </h3>
                          
                          {/* Indented line items */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingLeft: '16px' }}>
                            {items.map(item => {
                              const amt = parseFloat(item.amount) || 0;
                              const isUSD = item.currency === 'USD';
                              const rate = parseFloat(activeBudget?.exchangeRate) || activeRate || 150;
                              const usdVal = isUSD ? amt : amt / rate;
                              const lrdVal = isUSD ? amt * rate : amt;

                              const usdDisplayStr = `$${usdVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                              const lrdDisplayStr = `L$${Math.round(lrdVal).toLocaleString()}`;

                              const getBadgeStyles = (status) => {
                                switch (status) {
                                  case 'Approved':
                                    return { bg: '#e8f5e9', fg: '#2e7d32', label: 'Approved' };
                                  case 'Rejected':
                                    return { bg: '#ffebee', fg: '#c62828', label: 'Rejected' };
                                  case 'Dispensed':
                                  case 'Approved & Dispensed':
                                    return { bg: '#e8eaf6', fg: '#1a237e', label: 'Approved & Dispensed' };
                                  default:
                                    return { bg: '#fff3e0', fg: '#ef6c00', label: 'Pending Review' };
                                }
                              };
                              const badge = getBadgeStyles(item.status || 'Pending Review');

                              return (
                                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', padding: '2px 0' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                                    <span style={{
                                      fontSize: '0.7rem',
                                      fontWeight: 700,
                                      padding: '1px 5px',
                                      borderRadius: '4px',
                                      background: badge.bg,
                                      color: badge.fg,
                                      whiteSpace: 'nowrap'
                                    }}>
                                      {badge.label}
                                    </span>
                                    <span style={{ color: '#334155', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{item.description}</span>
                                  </div>
                                  <div style={{ display: 'flex', gap: '24px', alignItems: 'center', flexShrink: 0 }}>
                                    <div style={{ width: '110px', textAlign: 'right', fontWeight: 600, color: '#0f172a' }}>
                                      {usdDisplayStr}
                                    </div>
                                    <div style={{ width: '130px', textAlign: 'right', fontWeight: 600, color: '#64748b' }}>
                                      {lrdDisplayStr}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Subtotal row */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', fontSize: '0.8rem', fontWeight: 700, color: '#334155', borderTop: '1px dashed #e2e8f0', paddingTop: '4px' }}>
                            <span style={{ color: '#64748b', fontStyle: 'italic', paddingLeft: '16px' }}>
                              SUBTOTAL
                            </span>
                            <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
                              <div style={{ width: '110px', textAlign: 'right', color: 'var(--color-primary-dark, #1b5e20)' }}>
                                ${parseFloat(subtotal.usd).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </div>
                              <div style={{ width: '130px', textAlign: 'right', color: '#64748b' }}>
                                L${Math.round(parseFloat(subtotal.lrd)).toLocaleString()}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Grand Total Breakdown */}
                {Object.keys(groupedItems).length > 0 && (() => {
                  const totals = getReportTotals();
                  return (
                    <div style={{
                      marginTop: '8px',
                      background: '#f1f8e9',
                      border: '1px solid #d0e7b5',
                      borderRadius: '6px',
                      padding: '8px 16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: '#558b2f', fontWeight: 600 }}>
                        <span>GRAND TOTAL SUMMARY</span>
                        <div style={{ display: 'flex', gap: '24px' }}>
                          <div style={{ width: '110px', textAlign: 'right' }}>USD</div>
                          <div style={{ width: '130px', textAlign: 'right' }}>LRD</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: '#475569' }}>
                        <span>Total Approved Items:</span>
                        <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
                          <div style={{ width: '110px', textAlign: 'right' }}>
                            ${totals.approved.usd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                          <div style={{ width: '130px', textAlign: 'right' }}>
                            L${Math.round(totals.approved.lrd).toLocaleString()}
                          </div>
                        </div>
                      </div>
                      {totals.dispensed.usd > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: '#475569' }}>
                          <span>Total Approved & Dispensed (Subtracted):</span>
                          <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
                            <div style={{ width: '110px', textAlign: 'right' }}>
                              -${totals.dispensed.usd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                            <div style={{ width: '130px', textAlign: 'right' }}>
                              -L${Math.round(totals.dispensed.lrd).toLocaleString()}
                            </div>
                          </div>
                        </div>
                      )}
                      <hr style={{ border: 'none', borderTop: '1px dashed #c0dfa1', margin: '4px 0' }} />
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#33691e', textTransform: 'uppercase' }}>Actually Sent Amount</span>
                        <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
                          <div style={{ width: '110px', textAlign: 'right', fontSize: '0.9rem', fontWeight: 800, color: '#1b5e20' }}>
                            ${totals.net.usd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                          <div style={{ width: '130px', textAlign: 'right', fontSize: '0.85rem', fontWeight: 800, color: '#33691e' }}>
                            L${Math.round(totals.net.lrd).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
