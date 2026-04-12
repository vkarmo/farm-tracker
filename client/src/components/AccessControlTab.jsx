import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { updateUserAccess } from '../store/authSlice';
import { ShieldAlert } from 'lucide-react';

const AVAILABLE_TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'map', label: 'Map' },
  { id: 'field', label: 'Fields' },
  { id: 'nursery', label: 'Nursery' },
  { id: 'crop', label: 'Crops' },
  { id: 'harvest', label: 'Harvests' },
  { id: 'livestock', label: 'Livestock' },
  { id: 'activity', label: 'Activities' },
  { id: 'deadline', label: 'Deadlines' },
  { id: 'incident', label: 'Incidents' },
  { id: 'finance', label: 'Financials' },
  { id: 'budget', label: 'Budgets' }
];

export default function AccessControlTab() {
  const dispatch = useDispatch();
  const usersList = useSelector(state => state.auth?.usersList) || [];
  const currentUser = useSelector(state => state.auth?.currentUser);

  if (currentUser?.role !== 'Admin') {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '50px 20px', color: '#666' }}>
        <ShieldAlert size={48} color="#d32f2f" style={{ marginBottom: 20 }} />
        <h2>Unauthorized</h2>
        <p>You do not have administrative privileges to view this module.</p>
      </div>
    );
  }

  const handleToggleTab = (email, currentAllowed, tabId) => {
    let newTabs = currentAllowed || AVAILABLE_TABS.map(t => t.id); // Default to all if null
    if (newTabs.includes(tabId)) {
      newTabs = newTabs.filter(id => id !== tabId);
    } else {
      newTabs = [...newTabs, tabId];
    }
    dispatch(updateUserAccess({ email, allowedTabs: newTabs }));
  };

  const handleEnableAll = (email) => {
    dispatch(updateUserAccess({ email, allowedTabs: AVAILABLE_TABS.map(t => t.id) }));
  };

  const handleDisableAll = (email) => {
    dispatch(updateUserAccess({ email, allowedTabs: [] }));
  };

  const staffUsers = usersList.filter(u => u.role !== 'Admin');

  return (
    <div className="card">
      <h2>Module Access Gateway</h2>
      <p style={{ color: '#555', marginBottom: '20px' }}>
        Selectively enable or disable specific operational tabs for your staff. Root administrators naturally bypass these limits. By default, users inherit access to all tabs until customized.
      </p>

      {staffUsers.length === 0 ? (
        <p style={{fontStyle: 'italic', color: '#888'}}>No non-admin staff accounts registered offline yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {staffUsers.map(user => {
            const userAllowed = user.allowedTabs || AVAILABLE_TABS.map(t => t.id);
            return (
              <div key={user.email} style={{ border: '1px solid #efefef', borderRadius: 8, padding: 15, background: '#fafafa' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, flexWrap: 'wrap', gap: 10 }}>
                  <h3 style={{ margin: 0, display:'flex', alignItems: 'center', gap: 8 }}>
                    <img src={user.profilePic || user.profile_pic} alt="" width="24" height="24" style={{borderRadius: '50%'}} />
                    {user.name} <span style={{ fontSize: '0.8rem', color: '#888', fontWeight: 'normal' }}>({user.email})</span>
                  </h3>
                  <div>
                    <button onClick={() => handleEnableAll(user.email)} className="btn" style={{ fontSize: '0.75rem', padding: '4px 8px', marginRight: 6 }}>Enable All</button>
                    <button onClick={() => handleDisableAll(user.email)} className="btn" style={{ fontSize: '0.75rem', padding: '4px 8px' }}>Disable All</button>
                  </div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  {AVAILABLE_TABS.map(tab => {
                    const isAllowed = userAllowed.includes(tab.id);
                    return (
                      <label key={tab.id} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', padding: '6px 12px', background: isAllowed ? '#e8f5e9' : '#ffebee', border: `1px solid ${isAllowed ? '#c8e6c9' : '#ffcdd2'}`, borderRadius: 20, fontSize: '0.85rem', transition: 'all 0.2s' }}>
                        <input 
                          type="checkbox" 
                          checked={isAllowed} 
                          onChange={() => handleToggleTab(user.email, userAllowed, tab.id)} 
                          style={{ margin: 0 }}
                        />
                        {tab.label}
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
