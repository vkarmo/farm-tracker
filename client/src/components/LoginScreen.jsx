import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { login, fetchAllUsers } from '../store/authSlice';
import { queueAction } from '../store/syncSlice';
import { Tractor, ShieldCheck } from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode';
import NmkLogo from './NmkLogo';

export default function LoginScreen() {
  const dispatch = useDispatch();
  const [loading, setLoading] = useState(false);

  const usersList = useSelector(state => state.auth?.usersList) || [];
  const logo = useSelector(state => state.settings?.logo);

  // Fetch online users immediately upon attempting login if possible
  React.useEffect(() => {
    if (navigator.onLine) dispatch(fetchAllUsers());
  }, [dispatch]);

  const handleGoogleSuccess = (credentialResponse) => {
    setLoading(true);
    const decoded = jwtDecode(credentialResponse.credential);
    const email = decoded.email.toLowerCase();

    const isAdminRoot = email === 'vkarmo@gmail.com';
    const existingUser = usersList.find(u => u.email.toLowerCase() === email);

    if (!isAdminRoot && !existingUser) {
      setLoading(false);
      alert('Unauthorized access. This email is not actively whitelisted by the Admin.');
      return;
    }

    const userPayload = {
      id: existingUser ? existingUser.id : `u_${Date.now()}`,
      name: decoded.name || email.split('@')[0],
      email: email,
      role: isAdminRoot || (existingUser && existingUser.role === 'Admin') ? 'Admin' : 'Staff',
      profilePic: decoded.picture || `https://api.dicebear.com/7.x/initials/svg?seed=${email}`,
      allowedTabs: existingUser?.allowedTabs || null
    };

    dispatch(login(userPayload));
    if (!existingUser) {
      dispatch(queueAction({ type: 'users/upsertUser', payload: userPayload, meta: { id: Date.now() } }));
    }
  };

  const handleGoogleFailure = () => {
    alert("Google Authentication Failed");
  };

  return (
    <div style={{ height: '100vh', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)' }}>
      
      <div style={{ background: 'white', padding: '40px', borderRadius: '16px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', textAlign: 'center', maxWidth: '400px', width: '90%' }}>
        
        {logo ? (
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
            <img src={logo} alt="NMK Logo" style={{ maxWidth: '200px', maxHeight: '100px', objectFit: 'contain' }} />
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
            <NmkLogo size={70} color="var(--color-primary)" textColor="white" />
          </div>
        )}

        <h1 style={{ fontSize: '1.5rem', marginBottom: '10px', color: '#2e7d32' }}>Farm Tracker Pro</h1>
        <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '30px' }}>
          Restricted offline management cluster. Please authenticate to sync local telemetry.
        </p>

        {loading ? (
          <div style={{ padding: '12px' }}><span style={{ color: '#888' }}>Verifying Credentials...</span></div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={handleGoogleFailure}
              theme="outline"
              size="large"
            />
          </div>
        )}
        
        <div style={{ marginTop: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '0.8rem', color: '#9e9e9e' }}>
          <ShieldCheck size={14} /> End-to-End Encrypted Data Map
        </div>
      </div>

    </div>
  );
}
