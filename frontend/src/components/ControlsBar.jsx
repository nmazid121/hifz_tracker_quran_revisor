import React from 'react';
import AudioRecorder from './AudioRecorder';

const ControlsBar = ({ page, minPage, maxPage, goToPage, input, handleInputChange, handleInputBlur, handleInputKeyDown }) => {
  return (
    <div className="controls-bar">
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
      <AudioRecorder />
    </div>
  );
};

export default ControlsBar; 