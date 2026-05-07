import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { queueAction } from '../store/syncSlice';
import { addBudget, deleteBudget, addBudgetItem, deleteBudgetItem } from '../store/budgetSlice';
import { addTransaction } from '../store/financialsSlice';
import { FileText, Plus, Trash2, Edit2, Calculator, Check, X, ArrowRightCircle } from 'lucide-react';
import CrudTable from './CrudTable';

let isSubmitting = false;

const INIT_BUDGET = { name: '', description: '', exchangeRate: 150 };
const INIT_ITEM = { category: '', description: '', amount: '', currency: 'USD', status: 'Pending Review' };

export default function BudgetTab() {
  const dispatch = useDispatch();
  const budgets = useSelector(state => state.budgets?.list) || [];
  const assignments = useSelector(state => state.assignments?.list) || [];
  const employeesList = useSelector(state => state.employees?.list) || [];

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

  const activeBudget = budgets.find(b => b.id === activeBudgetId);

  const historicalRate = React.useMemo(() => {
    if (!budgets.length) return 150;
    // Sort by ID descending (which contains timestamp)
    const sorted = [...budgets].sort((a,b) => (b.id || '').localeCompare(a.id || ''));
    const recentWithRate = sorted.find(b => b.exchangeRate && String(b.exchangeRate).trim() !== '');
    return recentWithRate ? recentWithRate.exchangeRate : 150;
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

  const activeRate = liveRate || historicalRate;
  const getInitBudget = React.useCallback(() => ({ ...INIT_BUDGET, exchangeRate: activeRate }), [activeRate]);

  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (!isInitialized && activeRate) {
      setBudgetForm(prev => ({ ...prev, exchangeRate: activeRate }));
      setIsInitialized(true);
    }
  }, [activeRate, isInitialized]);

  const handleCreateBudget = (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    isSubmitting = true;
    setTimeout(() => { isSubmitting = false; }, 1000);
        if (!budgetForm.name) return alert("Budget Name required.");
    const newRate = parseFloat(budgetForm.exchangeRate) || 1;

    const newBudget = {
      id: `b_${Date.now()}`,
      name: budgetForm.name,
      description: budgetForm.description,
      exchangeRate: newRate,
      items: []
    };

    dispatch(addBudget(newBudget));
    dispatch(queueAction({ type: 'budgets/upsertBudget', payload: newBudget, meta: { id: Date.now() } }));

    setBudgetForm(getInitBudget());
    setActiveBudgetId(newBudget.id);
  };

  const handleUpdateExchangeRate = (e) => {
    const val = parseFloat(e.target.value);
    if (!activeBudget || isNaN(val)) return;
    const updated = { ...activeBudget, exchangeRate: val };
    dispatch(addBudget(updated));
    dispatch(queueAction({ type: 'core/updateNode', payload: { id: activeBudget.id, properties: { exchangeRate: val } }, meta: { id: Date.now() } }));
  };

  const handleSaveItem = (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    isSubmitting = true;
    setTimeout(() => { isSubmitting = false; }, 1000);
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
        category: 'Labor',
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
          category: 'Labor',
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
    const unlinkedItems = activeBudget.items.filter(i => !i.linkedTxId);
    
    if (unlinkedItems.length === 0) {
      alert("No budget items are pending for Ledger generation.");
      return;
    }

    const proposedTxs = unlinkedItems.map(item => ({
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
        exchangeRate: activeBudget.exchangeRate || 150,
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
    const rate = parseFloat(activeBudget.exchangeRate) || 1;

    let usd = 0;
    let lrd = 0;

    activeBudget.items.forEach(i => {
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
        const rate = activeBudget?.exchangeRate || 1;
        if (r.currency === 'USD') return `L$${(amt * rate).toLocaleString()}`;
        return `$${(amt / rate).toFixed(2)}`;
      }
    },
    { key: 'status', header: 'Approval Status', render: r => r.status === 'Approved' ? <strong style={{ color: '#2e7d32' }}>Approved</strong> : r.status }
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
        <form onSubmit={handleCreateBudget} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', flexWrap: 'wrap', marginTop: 10 }}>
          <input type="text" placeholder="e.g. Q3 Harvest Plan" value={budgetForm.name} onChange={e => setBudgetForm({ ...budgetForm, name: e.target.value })} style={{ flex: 1, minWidth: 200 }} />
          <input type="text" placeholder="Short Description..." value={budgetForm.description} onChange={e => setBudgetForm({ ...budgetForm, description: e.target.value })} style={{ flex: 1, minWidth: 200 }} />
          <div style={{ display: 'flex', alignItems: 'center', background: '#f5f5f5', padding: '0 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}>
            <span style={{ fontSize: '0.85rem', color: '#666', marginRight: 8, whiteSpace: 'nowrap' }}>L$ to 1 USD:</span>
            <input type="number" value={budgetForm.exchangeRate} onChange={e => setBudgetForm({ ...budgetForm, exchangeRate: e.target.value })} style={{ border: 'none', background: 'transparent', width: 70, padding: '10px 0' }} />
          </div>
          <button type="submit" className="btn btn-primary" style={{ padding: '10px 20px' }}>Initiate</button>
        </form>
      </div>

      {/* 2. Active Budget Studio */}
      {activeBudget && (
        <div className="card" style={{ marginBottom: 0, borderTop: '4px solid var(--color-primary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 20 }}>
            <div>
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
              <p style={{ color: '#555', marginTop: 4 }}>{activeBudget.description}</p>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ background: '#e8f5e9', padding: '10px 16px', borderRadius: 8, border: '1px solid #c8e6c9', textAlign: 'right' }}>
                <div style={{ fontSize: '0.75rem', color: '#2e7d32', fontWeight: 600 }}>AGGREGATED LIABILITIES</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#1b5e20' }}>${totalUSD} USD</div>
                <div style={{ fontSize: '0.9rem', color: '#388e3c' }}>≈ L${totalLRD}</div>
              </div>

              <div style={{ background: '#f5f5f5', padding: '10px 16px', borderRadius: 8, border: '1px solid #e0e0e0', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div style={{ fontSize: '0.75rem', color: '#555', fontWeight: 600, marginBottom: 4 }}>EXCHANGE RATE</div>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span style={{ marginRight: 6, fontWeight: 'bold' }}>L$</span>
                  <input type="number" value={activeBudget.exchangeRate} onChange={handleUpdateExchangeRate} style={{ width: 80, padding: 4 }} />
                  <span style={{ marginLeft: 6 }}>/ USD</span>
                </div>
              </div>
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
                <div style={{ maxHeight: 300, overflowY: 'auto', marginBottom: 15 }}>
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
            <div className="form-group">
              <label>Category</label>
              <select value={itemForm.category} onChange={e => setItemForm({ ...itemForm, category: e.target.value })}>
                <option value="">Select...</option>
                <option value="Equipment">Equipment Leasing/Repair</option>
                <option value="Labor">Labor</option>
                <option value="Logistics">Logistics & Transport</option>
                <option value="Materials">Materials & Seeds</option>
                <option value="Miscellaneous">Miscellaneous</option>
                <option value="Operating Expenses">Operating Expenses</option>
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
            <div className="form-group" style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <label>Approval Status</label>
                <select value={itemForm.status} onChange={e => setItemForm({ ...itemForm, status: e.target.value })}>
                  <option value="Approved">Approved</option>
                  <option value="Pending Review">Pending Review</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 4 }}>
                <button type="submit" className="btn btn-primary" style={{ padding: '10px 16px', display: 'flex', gap: 6 }}>
                  {editingItemId ? <Check size={16} /> : <Plus size={16} />} {editingItemId ? 'Update' : 'Add Item'}
                </button>
                {editingItemId && (
                  <button type="button" onClick={() => { setEditingItemId(null); setItemForm(INIT_ITEM); }} className="btn" style={{ marginLeft: 8, background: '#efefef', color: '#333' }}>
                    Cancel
                  </button>
                )}
              </div>
            </div>
          </form>

          <CrudTable
            data={activeBudget.items || []}
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

    </div>
  );
}
