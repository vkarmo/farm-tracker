import React, { useState, useMemo } from 'react';
import { useSelector } from 'react-redux';
import Select from 'react-select';
import { Send, User, Users, MessageSquare, AlertCircle, CheckCircle } from 'lucide-react';

export default function MessagingTab() {
  const currentUser = useSelector(state => state.auth?.currentUser);
  const employees = useSelector(state => state.employees?.list) || [];
  const activeFarmId = localStorage.getItem('activeFarmId') || 'default_farm';

  // Check access inside tab
  const isNmkFarm = activeFarmId === 'default_farm';
  const isSuperAdmin = currentUser?.email === 'vkarmo@gmail.com';

  const [selectedRecipients, setSelectedRecipients] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState(null);

  // Filter active employees with phone numbers
  const employeeOptions = useMemo(() => {
    return employees
      .filter(e => !e.isTerminated && e.phone)
      .map(e => ({
        value: e.id,
        label: `${e.firstName} ${e.lastName} (${e.phone})`,
        phone: e.phone
      }));
  }, [employees]);

  if (!isNmkFarm && !isSuperAdmin) {
    return <div className="card" style={{ padding: 40, textAlign: 'center' }}>Unauthorized Access</div>;
  }

  const handleSendMessage = async (e) => {
    e.preventDefault();

    const sanitizePhoneNumber = (phone) => {
      if (!phone) return '';
      return phone.replace(/[+\-()\s]/g, '');
    };

    const recipientNumbers = (selectedRecipients || [])
      .map(emp => sanitizePhoneNumber(emp.phone))
      .filter(num => num.length > 0);

    if (recipientNumbers.length === 0) {
      setStatus({ success: false, error: 'Please select at least one employee recipient with a valid phone number.' });
      return;
    }

    if (!messageText.trim()) {
      setStatus({ success: false, error: 'Message content is required.' });
      return;
    }

    setSending(true);
    setStatus(null);

    try {
      const response = await fetch('/api/sms/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: recipientNumbers,
          message: messageText,
          farmId: activeFarmId,
          email: currentUser?.email
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setStatus({ success: true, message: data.message || 'Message sent successfully!' });
        setMessageText('');
        setSelectedRecipients([]);
      } else {
        setStatus({ success: false, error: data.error || 'Failed to send message.' });
      }
    } catch (err) {
      setStatus({ success: false, error: err.message || 'An error occurred while sending message.' });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="card" style={{ maxWidth: '600px', margin: '0 auto', padding: '24px', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', borderBottom: '1px solid #eee', paddingBottom: '15px' }}>
        <MessageSquare size={24} color="#2e7d32" />
        <h2 style={{ margin: 0, fontSize: '1.4rem', color: '#333' }}>Broadcast SMS Message</h2>
      </div>

      <form onSubmit={handleSendMessage} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* From Field */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontWeight: '600', color: '#555', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem' }}>
            <User size={16} /> From
          </label>
          <input
            type="text"
            value={currentUser ? `${currentUser.name} (${currentUser.email})` : 'Not Authenticated'}
            disabled
            style={{
              padding: '10px',
              borderRadius: '6px',
              border: '1px solid #ccc',
              background: '#f5f5f5',
              color: '#666',
              fontSize: '0.95rem',
              cursor: 'not-allowed'
            }}
          />
        </div>

        {/* Recipients Field */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontWeight: '600', color: '#555', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem' }}>
            <Users size={16} /> Recipients
          </label>
          <Select
            isMulti
            options={employeeOptions}
            value={selectedRecipients}
            onChange={setSelectedRecipients}
            placeholder="Search and select employees..."
            styles={{
              control: (base, state) => ({
                ...base,
                borderColor: state.isFocused ? '#2e7d32' : '#ccc',
                boxShadow: state.isFocused ? '0 0 0 1px #2e7d32' : null,
                '&:hover': {
                  borderColor: state.isFocused ? '#2e7d32' : '#999',
                },
                minHeight: '40px',
                borderRadius: '6px',
                background: '#fff',
              }),
              multiValue: (base) => ({
                ...base,
                backgroundColor: '#e8f5e9',
                borderRadius: '4px',
              }),
              multiValueLabel: (base) => ({
                ...base,
                color: '#2e7d32',
                fontWeight: '500',
              }),
              multiValueRemove: (base) => ({
                ...base,
                color: '#2e7d32',
                ':hover': {
                  backgroundColor: '#c8e6c9',
                  color: '#1b5e20',
                },
              }),
              option: (base, state) => ({
                ...base,
                backgroundColor: state.isSelected
                  ? '#2e7d32'
                  : state.isFocused
                  ? '#e8f5e9'
                  : 'transparent',
                color: state.isSelected
                  ? '#fff'
                  : state.isFocused
                  ? '#2e7d32'
                  : '#333',
                ':active': {
                  backgroundColor: '#c8e6c9',
                },
              }),
            }}
          />
        </div>

        {/* Message Field */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontWeight: '600', color: '#555', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem' }}>
            <MessageSquare size={16} /> Message
          </label>
          <textarea
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            placeholder="Type your message here..."
            required
            rows={4}
            style={{
              padding: '10px',
              borderRadius: '6px',
              border: '1px solid #ccc',
              fontSize: '0.95rem',
              resize: 'vertical',
              lineHeight: '1.4'
            }}
          />
        </div>

        {/* Send Button */}
        <button
          type="submit"
          className="btn btn-primary"
          disabled={sending || (selectedRecipients || []).length === 0 || !messageText.trim()}
          style={{
            background: '#2e7d32',
            color: 'white',
            padding: '12px 20px',
            borderRadius: '6px',
            border: 'none',
            fontWeight: 600,
            fontSize: '1rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            marginTop: '10px',
            opacity: (sending || (selectedRecipients || []).length === 0 || !messageText.trim()) ? 0.6 : 1,
            pointerEvents: (sending || (selectedRecipients || []).length === 0 || !messageText.trim()) ? 'none' : 'auto'
          }}
        >
          <Send size={18} />
          {sending ? 'Sending Broadcast...' : 'Send Broadcast'}
        </button>

        {/* Status Alerts */}
        {status && (
          <div
            style={{
              marginTop: '15px',
              padding: '12px 16px',
              borderRadius: '6px',
              border: `1px solid ${status.success ? '#c5e1a5' : '#ffcdd2'}`,
              background: status.success ? '#f1f8e9' : '#ffebee',
              color: status.success ? '#33691e' : '#c62828',
              fontSize: '0.9rem',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px'
            }}
          >
            {status.success ? <CheckCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} /> : <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />}
            <div>{status.success ? status.message : status.error}</div>
          </div>
        )}

      </form>
    </div>
  );
}
