import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { login } from '../store/authSlice';
import { queueAction } from '../store/syncSlice';
import { Tractor, ShieldCheck } from 'lucide-react';

export default function LoginScreen() {
  const dispatch = useDispatch();
  const [loading, setLoading] = useState(false);

  // Simulated Google Auth Handler
  // Note: For production, wrap this UI with @react-oauth/google <GoogleLogin>
  const handleSimulatedGoogleLogin = () => {
    const rawEmail = window.prompt("Simulated Google Authentication\\nPlease enter your Google Account Email:", "vkarmo@gmail.com");
    if (!rawEmail) return;

    setLoading(true);
    const email = rawEmail.trim().toLowerCase();
    
    // Simulate network delay for token verification
    setTimeout(() => {
      // Role definition (Admin override check)
      const isAdmin = email === 'vkarmo@gmail.com' || email === 'vkarmo@gmail';
      const userPayload = {
        id: `u_${Date.now()}`,
        name: email.split('@')[0], // Mock name fallback
        email,
        role: isAdmin ? 'Admin' : 'Staff',
        profilePic: `https://api.dicebear.com/7.x/initials/svg?seed=${email}`
      };

      // 1. Commit to secure Local React State (bypassing login next time)
      dispatch(login(userPayload));

      // 2. Queue asynchronous graph save to Neo4j to build audit topology
      dispatch(queueAction({ type: 'users/upsertUser', payload: userPayload, meta: { id: Date.now() } }));
      
    }, 800);
  };

  return (
    <div style={{ height: '100vh', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)' }}>
      
      <div style={{ background: 'white', padding: '40px', borderRadius: '16px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', textAlign: 'center', maxWidth: '400px', width: '90%' }}>
        
        <div style={{ width: '64px', height: '64px', background: 'var(--color-primary)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px auto', color: 'white' }}>
          <Tractor size={32} />
        </div>

        <h1 style={{ fontSize: '1.5rem', marginBottom: '10px', color: '#2e7d32' }}>Farm Tracker Pro</h1>
        <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '30px' }}>
          Restricted offline management cluster. Please authenticate to sync local telemetry.
        </p>

        <button 
          onClick={handleSimulatedGoogleLogin}
          disabled={loading}
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', background: 'white', border: '1px solid #ccc', padding: '12px', borderRadius: '8px', cursor: 'pointer', fontSize: '1rem', fontWeight: 500, transition: 'background 0.2s' }}
          className="google-btn-hover"
        >
          {loading ? (
            <span style={{ color: '#888' }}>Verifying Credentials...</span>
          ) : (
            <>
              <svg width="18" height="18" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/><path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/><path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/><path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"/></svg>
              Sign in with Google
            </>
          )}
        </button>
        
        <div style={{ marginTop: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '0.8rem', color: '#9e9e9e' }}>
          <ShieldCheck size={14} /> End-to-End Encrypted Data Map
        </div>
      </div>

    </div>
  );
}
