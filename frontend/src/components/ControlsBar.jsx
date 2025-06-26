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
  showMushaf,
  showRating,
  showDashboard,
  onShowRating,
  onHideRating,
  onShowDashboard,
  onHideDashboard
}) => {
  return (
    <div className="controls-bar">
      <div className="left-section">
        {showDashboard ? (
          <button onClick={onHideDashboard}>
            ← Back to Mushaf
          </button>
        ) : showRating ? (
          <button onClick={onHideRating}>
            ← Back to Mushaf
          </button>
        ) : (
          <>
            <button onClick={onShowRating}>
              Submit Session
            </button>
            <button onClick={onShowDashboard}>
              Dashboard
            </button>
            <span>Mistakes: {mistakes}</span>
            <button onClick={resetMistakes}>Reset Mistakes</button>
            <button onClick={toggleMushaf}>
              {showMushaf ? 'Hide Mushaf Page' : 'Reveal Mushaf Page'}
            </button>
          </>
        )}
      </div>
      
      <div className="center-section">
        {!showDashboard && (
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
            <span>Page {page} of {maxPage}</span>
            <button onClick={() => goToPage(page + 1)} disabled={page >= maxPage}>
              {'>>'}
            </button>
          </div>
        )}
        {showDashboard && (
          <span>Recitation Progress Dashboard</span>
        )}
      </div>
      
      <div className="right-section">
        {!showDashboard && <AudioRecorder />}
      </div>
    </div>
  );
};

export default ControlsBar; 