import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { fetchAllUsers, removeUserOffline, updateUserRole } from '../store/authSlice';
import { queueAction } from '../store/syncSlice';
import { ShieldAlert, Trash2, Shield, User } from 'lucide-react';
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
