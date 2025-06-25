import React, { useState } from 'react';
import MushafPage from './components/MushafPage';
import ControlsBar from './components/ControlsBar';
import MushafControls from './components/MushafControls';
import './App.css';

const MIN_PAGE = 1;
const MAX_PAGE = 604; // Indopak 15-line Mushaf typically has 604 pages

function App() {
  const [page, setPage] = useState(1);
  const [input, setInput] = useState('1');
  const [mistakes, setMistakes] = useState(0);
  const [showMushaf, setShowMushaf] = useState(true);

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

  const resetMistakes = () => {
    setMistakes(0);
  };

  const toggleMushaf = () => {
    setShowMushaf(prev => !prev);
  };

  return (
    <div className="App">
      <MushafControls
        mistakes={mistakes}
        resetMistakes={resetMistakes}
        toggleMushaf={toggleMushaf}
        showMushaf={showMushaf}
      />
      {showMushaf && <MushafPage pageNumber={page} />}
      <ControlsBar
        page={page}
        minPage={MIN_PAGE}
        maxPage={MAX_PAGE}
        goToPage={goToPage}
        input={input}
        handleInputChange={handleInputChange}
        handleInputBlur={handleInputBlur}
        handleInputKeyDown={handleInputKeyDown}
      />
    </div>
  );
}

export default App;
