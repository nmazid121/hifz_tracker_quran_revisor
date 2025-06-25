import React from 'react';
import AudioRecorder from './AudioRecorder';

const ControlsBar = ({ 
  page, 
  minPage, 
  maxPage, 
  goToPage, 
  input, 
  handleInputChange, 
  handleInputBlur, 
  handleInputKeyDown,
  mistakes,
  resetMistakes,
  toggleMushaf,
  showMushaf
}) => {
  return (
    <div className="controls-bar">
      <div className="left-section">
        <span>(:Summary)</span>
        <span>Mistakes: {mistakes}</span>
        <button onClick={resetMistakes}>Reset Mistakes</button>
        <button onClick={toggleMushaf}>
          {showMushaf ? 'Hide Mushaf Page' : 'Reveal Mushaf Page'}
        </button>
      </div>
      
      <div className="center-section">
        <div className="page-nav">
          <button onClick={() => goToPage(page - 1)} disabled={page <= minPage}>
            {'<<'}
          </button>
          <input
            type="number"
            min={minPage}
            max={maxPage}
            value={input}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            onKeyDown={handleInputKeyDown}
          />
          <button onClick={() => goToPage(page + 1)} disabled={page >= maxPage}>
            {'>>'}
          </button>
        </div>
      </div>
      
      <div className="right-section">
        <AudioRecorder />
      </div>
    </div>
  );
};

export default ControlsBar; 