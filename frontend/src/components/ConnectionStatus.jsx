import React, { useState, useEffect } from 'react';

const ConnectionStatus = () => {
  const [status, setStatus] = useState('checking');
  const [lastCheck, setLastCheck] = useState(null);

  useEffect(() => {
    let intervalId;
    
    const checkConnection = async () => {
      try {
        const response = await fetch('/api/quran/test', { 
          method: 'GET',
          cache: 'no-cache' 
        });
        
        if (response.ok) {
          setStatus('connected');
        } else {
          setStatus('error');
        }
      } catch (error) {
        setStatus('disconnected');
      }
      
      setLastCheck(new Date());
    };

    // Check immediately
    checkConnection();
    
    // Then check every 30 seconds
    intervalId = setInterval(checkConnection, 30000);

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, []);

  const getStatusInfo = () => {
    switch (status) {
      case 'connected':
        return {
          icon: '🟢',
          text: 'Connected',
          color: '#28a745',
          description: 'Backend server is running normally'
        };
      case 'disconnected':
        return {
          icon: '🔴',
          text: 'Connection Lost',
          color: '#dc3545',
          description: 'Backend server may be restarting. The app will auto-retry.'
        };
      case 'error':
        return {
          icon: '🟡',
          text: 'Server Error',
          color: '#ffc107',
          description: 'Backend responded with an error'
        };
      default:
        return {
          icon: '⚪',
          text: 'Checking...',
          color: '#6c757d',
          description: 'Checking connection status'
        };
    }
  };

  const statusInfo = getStatusInfo();

  // Only show if there's an issue or during initial check
  if (status === 'connected' && lastCheck) {
    return null;
  }

  return (
    <div style={{
      position: 'fixed',
      top: '10px',
      right: '10px',
      background: 'rgba(0, 0, 0, 0.8)',
      color: 'white',
      padding: '8px 12px',
      borderRadius: '6px',
      fontSize: '14px',
      fontFamily: 'monospace',
      zIndex: 1000,
      minWidth: '200px',
      border: `2px solid ${statusInfo.color}`
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span>{statusInfo.icon}</span>
        <span style={{ fontWeight: 'bold' }}>{statusInfo.text}</span>
      </div>
      <div style={{ 
        fontSize: '12px', 
        marginTop: '4px', 
        opacity: 0.8,
        lineHeight: '1.2'
      }}>
        {statusInfo.description}
      </div>
      {lastCheck && (
        <div style={{ 
          fontSize: '11px', 
          marginTop: '4px', 
          opacity: 0.6 
        }}>
          Last check: {lastCheck.toLocaleTimeString()}
        </div>
      )}
    </div>
  );
};

export default ConnectionStatus; 