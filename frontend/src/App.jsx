import React, { useState } from 'react';
import MushafPage from './components/MushafPage';
import AudioRecorder from './components/AudioRecorder';
import './App.css';

const MIN_PAGE = 1;
const MAX_PAGE = 604; // Indopak 15-line Mushaf typically has 604 pages

function App() {
  const [page, setPage] = useState(1);
  const [input, setInput] = useState('1');

  const goToPage = (num) => {
    const n = Math.max(MIN_PAGE, Math.min(MAX_PAGE, Number(num)));
    setPage(n);
    setInput(String(n));
  };

  const handleInputChange = (e) => {
    setInput(e.target.value);
  };

  const handleInputBlur = () => {
    goToPage(input);
  };

  const handleInputKeyDown = (e) => {
    if (e.key === 'Enter') {
      goToPage(input);
    }
  };

  return (
    <div className="App">
      <h1>Hifz Tracker - Mushaf Viewer</h1>
      <div className="nav-controls">
        <button onClick={() => goToPage(page - 1)} disabled={page <= MIN_PAGE}>
          Previous Page
        </button>
        <input
          type="number"
          min={MIN_PAGE}
          max={MAX_PAGE}
          value={input}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          onKeyDown={handleInputKeyDown}
          style={{ width: 60, textAlign: 'center' }}
        />
        <button onClick={() => goToPage(page + 1)} disabled={page >= MAX_PAGE}>
          Next Page
        </button>
      </div>
      
      <div style={{ display: 'flex', gap: '2rem', marginTop: '2rem' }}>
        <div style={{ flex: 1 }}>
          <MushafPage pageNumber={page} />
        </div>
        <div style={{ flex: 0, minWidth: '300px' }}>
          <AudioRecorder />
        </div>
      </div>
    </div>
  );
}

export default App;
