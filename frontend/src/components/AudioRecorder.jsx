import React, { useState, useRef, useEffect } from 'react';

const AudioRecorder = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [error, setError] = useState(null);
  const [hasPermission, setHasPermission] = useState(false);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioRef = useRef(null);
  const timerRef = useRef(null);
  const streamRef = useRef(null);

  const MAX_RECORDING_TIME = 5 * 60; // 5 minutes in seconds

  // Check for MediaRecorder support
  useEffect(() => {
    if (!navigator.mediaDevices || !window.MediaRecorder) {
      setError('Audio recording is not supported in this browser');
      return;
    }
  }, []);

  // Request microphone permission
  const requestPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      setHasPermission(true);
      setError(null);
    } catch (err) {
      setError('Microphone permission denied');
      setHasPermission(false);
    }
  };

  // Start recording
  const startRecording = async () => {
    if (!hasPermission) {
      await requestPermission();
      if (!hasPermission) return;
    }

    try {
      audioChunksRef.current = [];
      setRecordingTime(0);
      setError(null);

      const stream = streamRef.current || await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
      });

      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        setIsRecording(false);
        
        // Stop all tracks to release microphone
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
      };

      mediaRecorder.start();
      setIsRecording(true);

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          if (prev >= MAX_RECORDING_TIME) {
            stopRecording();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);

    } catch (err) {
      setError('Failed to start recording: ' + err.message);
    }
  };

  // Stop recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      clearInterval(timerRef.current);
    }
  };

  // Play audio
  const playAudio = () => {
    if (audioRef.current) {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  // Pause audio
  const pauseAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };

  // Handle audio ended
  const handleAudioEnded = () => {
    setIsPlaying(false);
  };

  // Format time display
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Download audio
  const downloadAudio = () => {
    if (audioBlob) {
      const url = URL.createObjectURL(audioBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `recitation_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.webm`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
      clearInterval(timerRef.current);
    };
  }, [audioUrl]);

  return (
    <div className="audio-recorder">
      <h3>Audio Recorder</h3>
      
      {error && (
        <div className="error-message" style={{ color: 'red', marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      <div className="recording-controls" style={{ marginBottom: '1rem' }}>
        {!isRecording ? (
          <button 
            onClick={startRecording}
            disabled={!hasPermission && error}
            style={{
              backgroundColor: '#4CAF50',
              color: 'white',
              padding: '10px 20px',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            {hasPermission ? 'Start Recording' : 'Request Permission'}
          </button>
        ) : (
          <button 
            onClick={stopRecording}
            style={{
              backgroundColor: '#f44336',
              color: 'white',
              padding: '10px 20px',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Stop Recording
          </button>
        )}
        
        {isRecording && (
          <span style={{ marginLeft: '1rem', color: '#f44336' }}>
            Recording: {formatTime(recordingTime)} / {formatTime(MAX_RECORDING_TIME)}
          </span>
        )}
      </div>

      {audioBlob && (
        <div className="playback-controls" style={{ marginBottom: '1rem' }}>
          <audio
            ref={audioRef}
            src={audioUrl}
            onEnded={handleAudioEnded}
            style={{ display: 'none' }}
          />
          
          <button 
            onClick={isPlaying ? pauseAudio : playAudio}
            style={{
              backgroundColor: '#2196F3',
              color: 'white',
              padding: '8px 16px',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              marginRight: '8px'
            }}
          >
            {isPlaying ? 'Pause' : 'Play'}
          </button>
          
          <button 
            onClick={downloadAudio}
            style={{
              backgroundColor: '#FF9800',
              color: 'white',
              padding: '8px 16px',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Download
          </button>
          
          <span style={{ marginLeft: '1rem', fontSize: '0.9em', color: '#666' }}>
            Duration: {formatTime(Math.floor(audioBlob.size / 1000))} | 
            Size: {(audioBlob.size / 1024 / 1024).toFixed(2)} MB
          </span>
        </div>
      )}

      <div className="recording-info" style={{ fontSize: '0.9em', color: '#666' }}>
        <p>• Maximum recording time: 5 minutes</p>
        <p>• Audio is stored locally and not uploaded</p>
        <p>• Use the download button to save your recording</p>
      </div>
    </div>
  );
};

export default AudioRecorder; 