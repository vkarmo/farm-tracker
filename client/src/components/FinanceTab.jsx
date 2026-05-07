import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { queueAction } from '../store/syncSlice';
import { addTransaction, deleteTransaction } from '../store/financialsSlice';
import { DollarSign, X } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, PieChart, Pie, Cell } from 'recharts';
import CrudTable from './CrudTable';

let isSubmitting = false;

const INIT_TX = { assetId: '', txType: 'Expense', category: '', amount: '', amountLd: '', exchangeRate: '', vendor: '', notes: '', date: new Date().toISOString().split('T')[0] };

export default function FinanceTab() {
  const dispatch = useDispatch();
  const transactions = useSelector(state => state.financials.transactions) || [];
  
  const fields = useSelector(state => state.fields.data) || [];
  const crops = useSelector(state => state.assets.crops) || [];
  const livestock = useSelector(state => state.assets.livestock) || [];
  const harvests = useSelector(state => state.assets.harvests) || [];
  
  const expenseCategories = useSelector(state => state.settings?.expenseCategories) || ['Equipment Maintenance', 'Fertilizer', 'Fuel', 'Labor', 'Seed'];
  const incomeCategories = useSelector(state => state.settings?.incomeCategories) || ['Crop Sale', 'Livestock Sale', 'Subsidy'];

  const historicalRate = React.useMemo(() => {
    if (!transactions.length) return '';
    const sorted = [...transactions].sort((a,b) => new Date(b.date) - new Date(a.date));
    const recentWithRate = sorted.find(t => t.exchangeRate && String(t.exchangeRate).trim() !== '');
    return recentWithRate ? recentWithRate.exchangeRate : '';
  }, [transactions]);

  const [liveRate, setLiveRate] = useState(null);

  React.useEffect(() => {
    let mounted = true;
    fetch('https://open.er-api.com/v6/latest/USD')
      .then(res => res.json())
      .then(data => {
        if (mounted && data?.rates?.LRD) {
          setLiveRate(data.rates.LRD.toFixed(2));
        }
      })
      .catch(err => console.warn("Failed to fetch live exchange rate (offline mode active):", err));
    return () => { mounted = false; };
  }, []);

  const activeRate = liveRate || historicalRate;
  const getInitTx = React.useCallback(() => ({ ...INIT_TX, exchangeRate: activeRate }), [activeRate]);

  const [txData, setTxData] = useState(INIT_TX);
  const [editingId, setEditingId] = useState(null);
  const [activeView, setActiveView] = useState('transactions');
  const [isInitialized, setIsInitialized] = useState(false);

  React.useEffect(() => {
    if (!isInitialized && activeRate && !editingId) {
      setTxData(prev => ({ ...prev, exchangeRate: activeRate }));
      setIsInitialized(true);
    }
  }, [activeRate, isInitialized, editingId]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    isSubmitting = true;
    setTimeout(() => { isSubmitting = false; }, 1000);
        if (isSubmitting) return;
    isSubmitting = true;
    setTimeout(() => { isSubmitting = false; }, 1000);
        const parsedUsd = parseFloat(txData.amount);
    const parsedLd = parseFloat(txData.amountLd);
    if ((!txData.amount || isNaN(parsedUsd) || parsedUsd < 0) && (!txData.amountLd || isNaN(parsedLd) || parsedLd < 0)) {
      return alert("Validation Error: A valid positive Amount (USD or LD) is required.");
    }
    if (!txData.category) return alert("Validation Error: Please select a transaction category.");

    if (editingId) {
      const updatedTx = { ...txData, id: editingId };
      dispatch(addTransaction(updatedTx));
      dispatch(queueAction({ type: 'core/updateNode', payload: { id: editingId, properties: updatedTx }, meta: { id: Date.now() } }));
    } else {
      const newTx = { id: `t_${Date.now()}`, ...txData };
      dispatch(addTransaction(newTx));
      dispatch(queueAction({ type: 'financials/addTransaction', payload: newTx, meta: { id: Date.now() } }));
    }
    
    setTxData(getInitTx());
    setEditingId(null);
  };

  const getAssetName = (assetId) => {
    if (!assetId) return '-';
    const crop = crops.find(c => c.id === assetId);
    if (crop) return `Crop: ${crop.name}`;
    const field = fields.find(f => f.id === assetId);
    if (field) return `Field: ${field.name}`;
    const harvest = harvests.find(h => h.id === assetId);
    if (harvest) {
      const parentCrop = crops.find(c => c.id === harvest.cropId);
      const cropName = parentCrop ? `${parentCrop.name} ${parentCrop.variety ? `(${parentCrop.variety})` : ''}` : 'Unknown Crop';
      return `Harvest: ${cropName} - ${harvest.amount} ${harvest.unit} (${harvest.date})`;
    }
    const animal = livestock.find(l => l.id === assetId);
    if (animal) return `Livestock: ${animal.type} - ${animal.tagNumber}`;
    return 'Unknown Asset';
  };

  const columns = [
    { key: 'date', header: 'Date' },
    { key: 'txType', header: 'Type' },
    { key: 'category', header: 'Category' },
    { key: 'assetId', header: 'Description', render: (r) => getAssetName(r.assetId) },
    { 
      key: 'amount', 
      header: 'Amount',
      render: (r) => (
        <strong style={{color: r.txType === 'Sale' ? 'green' : 'red'}}>
          {r.amount && `$${parseFloat(r.amount).toFixed(2)}`}
          {r.amount && r.amountLd && ' / '}
          {r.amountLd && `LD$${parseFloat(r.amountLd).toFixed(2)}`}
        </strong>
      )
    }
  ];

  // Process data for Recharts
  const monthlyData = transactions.reduce((acc, curr) => {
    const month = curr.date ? curr.date.substring(0, 7) : 'Unknown';
    if (!acc[month]) acc[month] = { name: month, Sales: 0, Expenses: 0 };
    if (curr.txType === 'Sale') acc[month].Sales += parseFloat(curr.amount);
    if (curr.txType === 'Expense') acc[month].Expenses += parseFloat(curr.amount);
    return acc;
  }, {});
  const barData = Object.values(monthlyData).sort((a,b) => (a.name || '').localeCompare(b.name || ''));

  const pieDataRaw = transactions.reduce((acc, curr) => {
    if (curr.txType === 'Sale') acc.Sales += parseFloat(curr.amount);
    if (curr.txType === 'Expense') acc.Expenses += parseFloat(curr.amount);
    return acc;
  }, { Sales: 0, Expenses: 0 });
  const pieData = [
    { name: 'Sales / Revenue', value: pieDataRaw.Sales },
    { name: 'Expenses', value: pieDataRaw.Expenses }
  ];
  const COLORS = ['#2e7d32', '#d32f2f'];

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>{editingId ? 'Edit Ledger Record' : 'Update Ledger'}</h2>
        {editingId && (
          <button onClick={() => { setEditingId(null); setTxData(getInitTx()); }} className="btn" style={{ background: '#f5f5f5', color: '#333' }}>
            <X size={14} style={{ marginRight: 4 }} /> Cancel Edit
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit}>
        <div className="form-grid" style={{marginBottom: '15px'}}>
          <div className="form-group form-grid-full">
            <div style={{display: 'flex', gap: '10px', background: '#f5f5f5', padding: '4px', borderRadius: '8px'}}>
            <select value={txData.assetId} onChange={e => setTxData({...txData, assetId: e.target.value})}>
              <option value="">General ledger...</option>
              <optgroup label="Harvest Pulls">
                {[...harvests].sort((a,b) => (a.date || '').localeCompare(b.date || '')).map(h => {
                  const crop = crops.find(c => c.id === h.cropId);
                  const cropLabel = crop ? `${crop.name} ${crop.variety ? `(${crop.variety})` : ''}` : 'Unknown';
                  return <option key={h.id} value={h.id}>{cropLabel} - {h.amount} {h.unit} ({h.date})</option>;
                })}
              </optgroup>
              <optgroup label="Livestock">
                {[...livestock].sort((a,b) => (a.type || '').localeCompare(b.type || '')).map(l => <option key={l.id} value={l.id}>Animal Type: {l.type} - Tag: {l.tagNumber}</option>)}
              </optgroup>
              <optgroup label="Fields">
                {[...fields].sort((a,b) => (a.name || '').localeCompare(b.name || '')).map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </optgroup>
              <optgroup label="Crops">
                {[...crops].sort((a,b) => (a.name || '').localeCompare(b.name || '')).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </optgroup>
            </select>
            </div>
          </div>
          <div className="form-group">
            <label>Transaction Date</label>
            <input type="date" value={txData.date} onChange={e => setTxData({...txData, date: e.target.value})} />
          </div>
          <div className="form-group">
            <label>Transaction Type</label>
            <select value={txData.txType} onChange={e => {
              const newType = e.target.value;
              const newCategory = '';
              setTxData({...txData, txType: newType, category: newCategory});
            }}>
              <option value="Expense">Expense</option>
              <option value="Sale">Sale</option>
            </select>
          </div>
          <div className="form-group">
            <label>Category</label>
            <select value={txData.category} onChange={e => setTxData({...txData, category: e.target.value})}>
              <option value="">Select a category...</option>
              {txData.txType === 'Expense' ? (
                expenseCategories.map(c => <option key={c} value={c}>{c}</option>)
              ) : (
                incomeCategories.map(c => <option key={c} value={c}>{c}</option>)
              )}
            </select>
          </div>
          <div className="form-group">
            <label>Exchange Rate (USD to LD)</label>
            <input type="number" step="0.01" value={txData.exchangeRate || ''} onChange={e => {
              const val = e.target.value;
              let newLd = txData.amountLd;
              if (val && txData.amount) newLd = (parseFloat(txData.amount) * parseFloat(val)).toFixed(2);
              setTxData({...txData, exchangeRate: val, amountLd: newLd});
            }} placeholder="e.g. 195.50"/>
          </div>
          <div className="form-group">
            <label>Amount (USD)</label>
            <input type="number" step="0.01" value={txData.amount} onChange={e => {
              const val = e.target.value;
              let newLd = txData.amountLd;
              if (val && txData.exchangeRate) newLd = (parseFloat(val) * parseFloat(txData.exchangeRate)).toFixed(2);
              setTxData({...txData, amount: val, amountLd: newLd});
            }} placeholder="250.00"/>
          </div>
          <div className="form-group">
            <label>Amount (LD)</label>
            <input type="number" step="0.01" value={txData.amountLd || ''} onChange={e => {
              const val = e.target.value;
              let newUsd = txData.amount;
              if (val && txData.exchangeRate) newUsd = (parseFloat(val) / parseFloat(txData.exchangeRate)).toFixed(2);
              setTxData({...txData, amountLd: val, amount: newUsd});
            }} placeholder="e.g. 48875.00"/>
          </div>
          <div className="form-group">
            <label>Vendor / Buyer</label>
            <input type="text" value={txData.vendor} onChange={e => setTxData({...txData, vendor: e.target.value})} placeholder="John Deere, Local Co-op..."/>
          </div>
        <div className="form-group form-grid-full">
          <label>Notes / Memo</label>
            <textarea rows="2" value={txData.notes} onChange={e => setTxData({...txData, notes: e.target.value})}></textarea>
          </div>
        </div>
        <button type="submit" className="btn btn-primary" style={{marginTop: 10}}>
          <DollarSign size={16} style={{marginRight: 6}}/> 
          {editingId ? 'Update Ledger Entry' : txData.txType === 'Sale' ? 'Save Sale in Ledger' : 'Save Expense in Ledger'}
        </button>
      </form>

      <hr style={{border: 'none', borderTop: '1px solid var(--color-border)', margin: '30px 0'}} />

      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', justifyContent: 'center' }}>
        <button onClick={() => setActiveView('transactions')} className={`btn ${activeView === 'transactions' ? 'btn-primary' : ''}`} style={{ borderRadius: '20px', padding: '8px 20px', background: activeView === 'transactions' ? '#2e7d32' : '#f0f0f0', color: activeView === 'transactions' ? 'white' : '#333', border: 'none' }}>Active Transactions</button>
        <button onClick={() => setActiveView('analytics')} className={`btn ${activeView === 'analytics' ? 'btn-primary' : ''}`} style={{ borderRadius: '20px', padding: '8px 20px', background: activeView === 'analytics' ? '#2e7d32' : '#f0f0f0', color: activeView === 'analytics' ? 'white' : '#333', border: 'none' }}>Financial Analytics</button>
      </div>

      {activeView === 'analytics' && transactions.length > 0 && (
        <div style={{ marginBottom: '30px' }}>
          <h3 style={{ marginBottom: '15px', color: '#444' }}>Financial Analytics</h3>
          <div className="form-grid">
            <div className="card" style={{ padding: '10px', boxShadow: 'none', background: '#fafafa' }}>
              <h4 style={{textAlign: 'center', marginBottom: 10, fontSize: '0.9rem'}}>Monthly Revenue vs Expenses</h4>
              <div style={{ width: '100%', height: 250 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{fontSize: 12}} />
                    <YAxis tick={{fontSize: 12}} />
                    <Tooltip cursor={{fill: '#f5f5f5'}} />
                    <Legend wrapperStyle={{fontSize: 12}} />
                    <Bar dataKey="Sales" fill="#2e7d32" />
                    <Bar dataKey="Expenses" fill="#d32f2f" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card" style={{ padding: '10px', boxShadow: 'none', background: '#fafafa' }}>
              <h4 style={{textAlign: 'center', marginBottom: 10, fontSize: '0.9rem'}}>Total Aggregate Flow</h4>
              <div style={{ width: '100%', height: 250 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={80} paddingAngle={5} dataKey="value" label={({name, percent}) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeView === 'transactions' && (
        <CrudTable 
          data={transactions} 
          columns={columns} 
          onEdit={(row) => { setTxData(row); setEditingId(row.id); }} 
          onDelete={(id) => {
            dispatch(deleteTransaction(id));
            dispatch(queueAction({ type: 'core/deleteNode', payload: { id }, meta: { id: Date.now() } }));
          }} 
          itemLabel="Transaction" 
          defaultSort={{ key: 'date', direction: 'desc' }}
        />
      )}
    </div>
  );
}
