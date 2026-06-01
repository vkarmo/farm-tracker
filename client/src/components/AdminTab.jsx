import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { fetchAllUsers, removeUserOffline, updateUserRole, impersonateUser } from '../store/authSlice';
import { queueAction } from '../store/syncSlice';
import { ShieldAlert, Trash2, Shield, User, Play, Eye } from 'lucide-react';
import CrudTable from './CrudTable';


export default function AdminTab() {
  const dispatch = useDispatch();
  const usersList = useSelector(state => state.auth?.usersList) || [];
  const currentUser = useSelector(state => state.auth?.currentUser);
  const [newEmail, setNewEmail] = useState('');

  // Force fetch users from Neo4j when Admin mounts (if online)
  useEffect(() => {
    if (navigator.onLine) {
      dispatch(fetchAllUsers());
    }
  }, [dispatch]);

  const columns = [
    {
      key: 'profilePic',
      header: 'Avatar',
      render: (r) => <img src={r.profile_pic || r.profilePic} alt="" width="32" height="32" style={{ borderRadius: '50%' }} />
    },
    { key: 'name', header: 'Display Name' },
    { key: 'email', header: 'Email Address' },
    {
      key: 'canApprove',
      header: 'Approve Assignments',
      render: (r) => (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={r.role === 'Admin' || !!r.canApprove}
            disabled={currentUser?.role === 'Admin Viewer' || r.role === 'Admin'}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => {
              const checked = e.target.checked;
              const updatedUser = { ...r, canApprove: checked };
              dispatch(queueAction({ type: 'users/upsertUser', payload: updatedUser, meta: { id: Date.now() } }));
              dispatch(updateUserRole({ email: r.email, canApprove: checked }));
            }}
            style={{
              cursor: currentUser?.role === 'Admin Viewer' || r.role === 'Admin' ? 'not-allowed' : 'pointer',
              width: '18px',
              height: '18px'
            }}
          />
        </div>
      )
    },
    {
      key: 'role',
      header: 'System Permissions',
      render: (r) => (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {r.role === 'Admin' && <><Shield size={14} color="#d32f2f" /> <strong style={{ color: '#d32f2f' }}>Admin</strong></>}
            {r.role === 'Admin Viewer' && <><Shield size={14} color="#757575" /> <strong>Admin Viewer</strong></>}
            {r.role === 'Staff' && <><User size={14} color="#1976d2" /> Staff</>}
            {r.role === 'Viewer' && <><User size={14} color="#757575" /> Viewer</>}
            {!['Admin', 'Admin Viewer', 'Staff', 'Viewer'].includes(r.role) && <><User size={14} color="#1976d2" /> {r.role || 'Staff'}</>}
          </div>
          {r.email !== currentUser?.email && (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <select 
                value={r.role || 'Staff'} 
                disabled={currentUser?.role === 'Admin Viewer'}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => {
                  const newRole = e.target.value;
                  if (window.confirm(`Are you sure you want to change ${r.name || r.email}'s role to ${newRole}?`)) {
                    dispatch(queueAction({ type: 'users/upsertUser', payload: { ...r, role: newRole }, meta: { id: Date.now() } }));
                    dispatch(updateUserRole({ email: r.email, role: newRole }));
                  }
                }}
                style={{ padding: '4px 8px', fontSize: '0.8rem', borderRadius: '4px', border: '1px solid #ccc', background: 'white', color: '#333', cursor: currentUser?.role === 'Admin Viewer' ? 'not-allowed' : 'pointer' }}
              >
                <option value="Admin">Admin</option>
                <option value="Admin Viewer">Admin Viewer</option>
                <option value="Staff">Staff</option>
                <option value="Viewer">Viewer</option>
              </select>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  dispatch(impersonateUser(r));
                }}
                className="btn"
                style={{ padding: '6px', background: '#e8f5e9', color: '#2e7d32', border: '1px solid #c8e6c9', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                title={`Simulate app as ${r.name || r.email}`}
              >
                <Eye size={16} />
              </button>
            </div>
          )}
        </div>
      )
    }
  ];

  if (currentUser?.role !== 'Admin' && currentUser?.role !== 'Admin Viewer') {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '50px 20px', color: '#666' }}>
        <ShieldAlert size={48} color="#d32f2f" style={{ marginBottom: 20 }} />
        <h2>Unauthorized</h2>
        <p>You do not have administrative privileges to view this module.</p>
      </div>
    );
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>System Users Framework</h2>
        <span style={{ fontSize: '0.9rem', color: '#666' }}>Total Authorized: {usersList.length}</span>
      </div>

      <p style={{ color: '#555', marginBottom: '20px', fontSize: '0.95rem' }}>
        Review and audit anyone authenticated to access offline payloads.
        As the Admin, you can permanently revoke their structural access tokens at any time.
      </p>

      {/* Simulator Section */}
      <div style={{ background: '#f9fbe7', border: '1px solid #d4e157', borderRadius: '8px', padding: '16px', marginBottom: '25px' }}>
        <h3 style={{ margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '6px', color: '#558b2f' }}>
          <Play size={18} fill="#558b2f" /> Simulation & Perspective Controls
        </h3>
        <p style={{ fontSize: '0.85rem', color: '#555', margin: '0 0 12px 0', lineHeight: '1.4' }}>
          Instantly simulate the application perspective of generic user types to inspect access restrictions, budgets, and edit modes:
        </p>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => dispatch(impersonateUser({ id: 'sim_viewer', name: 'Simulated Viewer', email: 'viewer@simulation.local', role: 'Viewer', allowedTabs: ['dashboard', 'map', 'field', 'crop'] }))}
            className="btn"
            style={{ background: 'white', border: '1px solid #ccc', padding: '6px 12px', fontSize: '0.85rem', cursor: 'pointer' }}
          >
            Simulate Generic Viewer
          </button>
          <button
            type="button"
            onClick={() => dispatch(impersonateUser({ id: 'sim_admin_viewer', name: 'Simulated Admin Viewer', email: 'admin_viewer@simulation.local', role: 'Admin Viewer' }))}
            className="btn"
            style={{ background: 'white', border: '1px solid #ccc', padding: '6px 12px', fontSize: '0.85rem', cursor: 'pointer' }}
          >
            Simulate Generic Admin Viewer
          </button>
          <button
            type="button"
            onClick={() => dispatch(impersonateUser({ id: 'sim_staff', name: 'Simulated Staff', email: 'staff@simulation.local', role: 'Staff' }))}
            className="btn"
            style={{ background: 'white', border: '1px solid #ccc', padding: '6px 12px', fontSize: '0.85rem', cursor: 'pointer' }}
          >
            Simulate Generic Staff
          </button>
        </div>
      </div>

      {currentUser?.role === 'Admin' && (
        <form onSubmit={(e) => {
          e.preventDefault();
          if (!newEmail.trim() || !newEmail.includes('@gmail.com')) return alert("Enter a valid Google Mail address.");
          const seedPayload = {
            id: `u_${Date.now()}`,
            name: newEmail.split('@')[0],
            email: newEmail.toLowerCase().trim(),
            role: 'Staff',
            profilePic: `https://api.dicebear.com/7.x/initials/svg?seed=${newEmail}`
          };
          dispatch(queueAction({ type: 'users/upsertUser', payload: seedPayload, meta: { id: Date.now() } }));
          // Also fast-update the local sync array
          dispatch({ type: 'auth/setUsersList', payload: [...usersList, seedPayload] });
          setNewEmail('');
        }} style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
          <input
            type="email"
            placeholder="New user gmail address (e.g., worker@gmail.com)"
            value={newEmail}
            onChange={e => setNewEmail(e.target.value)}
            style={{ flex: 2 }}
          />
          <button type="submit" style={{ whiteSpace: 'nowrap', flex: 1 }} className="btn btn-primary">Whitelist User</button>
        </form>
      )}

      <hr style={{ border: 'none', borderTop: '1px solid var(--color-border)', margin: '30px 0' }} />

      <CrudTable
        data={usersList}
        columns={columns}
        onEdit={null} // We don't edit users manually, Google OAuth determines metadata
        onDelete={currentUser?.role === 'Admin Viewer' ? null : (id) => {
          // Identify the exact user ID internally assigned
          const target = usersList.find(u => u.id === id);
          if (target?.email === currentUser.email) {
            alert('Security Block: You cannot delete your own Administrator account.');
            return;
          }
          if (window.confirm(`Permanently revoke database access for ${target?.email}?`)) {
            dispatch(removeUserOffline(target?.email));
            dispatch(queueAction({ type: 'core/deleteNode', payload: { id }, meta: { id: Date.now() } }));
          }
        }}
        itemLabel="User"
      />
    </div>
  );
}
