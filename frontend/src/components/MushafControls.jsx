import React from 'react';

const MushafControls = ({ mistakes, resetMistakes, toggleMushaf, showMushaf }) => {
  return (
    <div className="mushaf-controls">
      <div className="summary-section">
        <span>(:Summary)</span>
        <span>Mistakes: {mistakes}</span>
      </div>
      <div className="actions-section">
        <button onClick={resetMistakes}>Reset Mistakes</button>
        <button onClick={toggleMushaf}>
          {showMushaf ? 'Hide Mushaf Page' : 'Show Mushaf Page'}
        </button>
      </div>
    </div>
  );
};

export default MushafControls; 