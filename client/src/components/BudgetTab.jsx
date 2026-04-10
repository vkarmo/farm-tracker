import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { queueAction } from '../store/syncSlice';
import { addBudget, deleteBudget, addBudgetItem, deleteBudgetItem } from '../store/budgetSlice';
import { FileText, Plus, Trash2, Edit2, Calculator, Check, X } from 'lucide-react';
import CrudTable from './CrudTable';

const INIT_BUDGET = { name: '', description: '', exchangeRate: 150 };
const INIT_ITEM = { category: '', description: '', amount: '', currency: 'USD', status: 'Pending' };

export default function BudgetTab() {
  const dispatch = useDispatch();
  const budgets = useSelector(state => state.budgets.list) || [];
  
  const [activeBudgetId, setActiveBudgetId] = useState(null);
  const [budgetForm, setBudgetForm] = useState(INIT_BUDGET);
  const [itemForm, setItemForm] = useState(INIT_ITEM);
  const [editingItemId, setEditingItemId] = useState(null);

  const activeBudget = budgets.find(b => b.id === activeBudgetId);

  const handleCreateBudget = (e) => {
    e.preventDefault();
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
    
    setBudgetForm(INIT_BUDGET);
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
    { key: 'status', header: 'Approval Status', render: r => r.status === 'Approved' ? <strong style={{color:'#2e7d32'}}>Approved</strong> : r.status }
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
        
        <hr style={{border: 'none', borderTop: '1px solid var(--color-border)', margin: '20px 0'}} />
        
        <h4>Create New Budget Pipeline</h4>
        <form onSubmit={handleCreateBudget} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', flexWrap: 'wrap', marginTop: 10 }}>
          <input type="text" placeholder="e.g. Q3 Harvest Plan" value={budgetForm.name} onChange={e => setBudgetForm({...budgetForm, name: e.target.value})} style={{flex: 1, minWidth: 200}}/>
          <input type="text" placeholder="Short Description..." value={budgetForm.description} onChange={e => setBudgetForm({...budgetForm, description: e.target.value})} style={{flex: 1, minWidth: 200}}/>
          <div style={{ display: 'flex', alignItems: 'center', background: '#f5f5f5', padding: '0 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}>
            <span style={{ fontSize: '0.85rem', color: '#666', marginRight: 8, whiteSpace: 'nowrap' }}>L$ to 1 USD:</span>
            <input type="number" value={budgetForm.exchangeRate} onChange={e => setBudgetForm({...budgetForm, exchangeRate: e.target.value})} style={{ border: 'none', background: 'transparent', width: 70, padding: '10px 0' }}/>
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
                  if(window.confirm('Delete this entire budget permanently?')) {
                    dispatch(deleteBudget(activeBudget.id));
                    dispatch(queueAction({ type: 'core/deleteNode', payload: { id: activeBudget.id }, meta: { id: Date.now() } }));
                    setActiveBudgetId(null);
                  }
                }} style={{ border: 'none', background: 'transparent', color: '#d32f2f', marginLeft: 16, cursor: 'pointer' }}><Trash2 size={18}/></button>
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

          <hr style={{border: 'none', borderTop: '1px solid var(--color-border)', margin: '20px 0'}} />
          
          <h3 style={{ marginBottom: 15, display: 'flex', alignItems: 'center' }}>
            <Calculator size={18} style={{marginRight: 8}}/> {editingItemId ? 'Edit Line Item' : 'Add New Line Item'}
          </h3>
          <form onSubmit={handleSaveItem} className="form-grid" style={{ marginBottom: 30, background: '#fafafa', padding: 15, borderRadius: 8, border: '1px dashed #ccc' }}>
            <div className="form-group">
              <label>Category</label>
              <select value={itemForm.category} onChange={e => setItemForm({...itemForm, category: e.target.value})}>
                <option value="">Select...</option>
                <option value="Labor">Labor</option>
                <option value="Materials">Materials & Seeds</option>
                <option value="Logistics">Logistics & Transport</option>
                <option value="Equipment">Equipment Leasing/Repair</option>
                <option value="Operating Expenses">Operating Expenses</option>
                <option value="Miscellaneous">Miscellaneous</option>
              </select>
            </div>
            <div className="form-group">
              <label>Resource Description</label>
              <input type="text" value={itemForm.description} onChange={e => setItemForm({...itemForm, description: e.target.value})} placeholder="e.g. 50 bags of NPK fertilizer"/>
            </div>
            <div className="form-group" style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 2 }}>
                <label>Nominal Amount</label>
                <input type="number" step="0.01" value={itemForm.amount} onChange={e => setItemForm({...itemForm, amount: e.target.value})}/>
              </div>
              <div style={{ flex: 1 }}>
                <label>Currency</label>
                <select value={itemForm.currency} onChange={e => setItemForm({...itemForm, currency: e.target.value})}>
                  <option value="USD">USD</option>
                  <option value="LRD">LRD</option>
                </select>
              </div>
            </div>
            <div className="form-group" style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1 }}>
                 <label>Approval Status</label>
                 <select value={itemForm.status} onChange={e => setItemForm({...itemForm, status: e.target.value})}>
                   <option value="Pending">Pending Review</option>
                   <option value="Approved">Approved</option>
                   <option value="Rejected">Rejected</option>
                 </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 4 }}>
                <button type="submit" className="btn btn-primary" style={{ padding: '10px 16px', display: 'flex', gap: 6 }}>
                  {editingItemId ? <Check size={16}/> : <Plus size={16}/>} {editingItemId ? 'Update' : 'Add Item'}
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
          />
        </div>
      )}

    </div>
  );
}
