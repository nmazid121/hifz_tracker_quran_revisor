import React, { useState, useRef, useCallback } from 'react';
import MushafPage from './components/MushafPage';
import ControlsBar from './components/ControlsBar';
import RecitationRating from './components/RecitationRating';
import ProgressDashboard from './components/ProgressDashboard';
import ConnectionStatus from './components/ConnectionStatus';
import sessionSubmissionService from './services/SessionSubmissionService';
import './App.css';

const MIN_PAGE = 1;
const MAX_PAGE = 604; // Indopak 15-line Mushaf typically has 604 pages

function App() {
  const [page, setPage] = useState(1);
  const [input, setInput] = useState('1');
  const [mistakes, setMistakes] = useState([]);
  const [showMushaf, setShowMushaf] = useState(true);
  const [showRating, setShowRating] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');
  const [submitMessageType, setSubmitMessageType] = useState(''); // 'success' or 'error'

  // Ref to access audio recorder data if needed
  const audioRecorderRef = useRef(null);

  const goToPage = useCallback((num) => {
    const n = Math.max(MIN_PAGE, Math.min(MAX_PAGE, Number(num)));
    setPage(n);
    setInput(String(n));
    setShowRating(false); // Hide rating when changing pages
    setShowDashboard(false); // Hide dashboard when changing pages
    setSubmitMessage('');
    setSubmitMessageType('');
  }, []);

  const handleInputChange = useCallback((e) => {
    setInput(e.target.value);
  }, []);

  const handleInputBlur = useCallback(() => {
    goToPage(input);
  }, [goToPage, input]);

  const handleInputKeyDown = useCallback((e) => {
    if (e.key === 'Enter') {
      goToPage(input);
    }
  }, [goToPage, input]);

  const resetMistakes = useCallback(() => {
    setMistakes([]);
    // Also reset mistakes in MushafPage component if available
    if (window.mushafPageMethods) {
      window.mushafPageMethods.resetMistakes();
    }
  }, []);

  const toggleMushaf = useCallback(() => {
    setShowMushaf(prev => !prev);
  }, []);

  // Stable callback for handling mistakes changes from MushafPage
  const handleMistakesChange = useCallback((newMistakes) => {
    setMistakes(newMistakes);
  }, []);

  const showRatingForm = useCallback(() => {
    setShowRating(true);
    setShowDashboard(false);
    setSubmitMessage('');
    setSubmitMessageType('');
  }, []);

  const hideRatingForm = useCallback(() => {
    setShowRating(false);
    setSubmitMessage('');
    setSubmitMessageType('');
  }, []);

  const showProgressDashboard = useCallback(() => {
    setShowDashboard(true);
    setShowRating(false);
    setShowMushaf(false);
    setSubmitMessage('');
    setSubmitMessageType('');
  }, []);

  const hideProgressDashboard = useCallback(() => {
    setShowDashboard(false);
    setShowMushaf(true);
    setSubmitMessage('');
    setSubmitMessageType('');
  }, []);

  const clearSubmitMessage = useCallback(() => {
    setSubmitMessage('');
    setSubmitMessageType('');
  }, []);

  const handleSessionSubmit = useCallback(async ({ rating, notes }) => {
    setIsSubmitting(true);
    setSubmitMessage('');
    setSubmitMessageType('');

    try {
      // Collect session data
      const sessionData = sessionSubmissionService.collectSessionData({
        pageNumber: page,
        mistakes: mistakes,
        rating: rating,
        notes: notes,
        audioBlob: null // TODO: Get audio blob from AudioRecorder if needed
      });

      // Submit session
      const result = await sessionSubmissionService.submitSession(sessionData);

      if (result.success) {
        setSubmitMessage(result.message);
        setSubmitMessageType('success');
        
        // Reset form after successful submission
        setTimeout(() => {
          resetMistakes();
          hideRatingForm();
        }, 2000);
      } else {
        setSubmitMessage('Failed to submit session');
        setSubmitMessageType('error');
      }
    } catch (error) {
      console.error('Submission error:', error);
      setSubmitMessage(error.message || 'Failed to submit session');
      setSubmitMessageType('error');
    } finally {
      setIsSubmitting(false);
    }
  }, [page, mistakes, resetMistakes, hideRatingForm]);

  return (
    <div className="App">
      {/* Connection Status Indicator */}
      <ConnectionStatus />
      
      {/* Submit Message Display */}
      {submitMessage && (
        <div className={`submit-message ${submitMessageType}`}>
          {submitMessage}
          <button onClick={clearSubmitMessage} className="close-message">×</button>
        </div>
      )}

      {/* Main Content */}
      {showMushaf && !showRating && !showDashboard && (
        <MushafPage 
          pageNumber={page} 
          onMistakesChange={handleMistakesChange}
        />
      )}

      {/* Rating Form */}
      {showRating && !showDashboard && (
        <RecitationRating
          pageNumber={page}
          mistakeCount={mistakes.length}
          onSubmit={handleSessionSubmit}
          isSubmitting={isSubmitting}
        />
      )}

      {/* Progress Dashboard */}
      {showDashboard && (
        <ProgressDashboard
          onClose={hideProgressDashboard}
        />
      )}

      {/* Controls Bar - always visible */}
      <ControlsBar
        page={page}
        minPage={MIN_PAGE}
        maxPage={MAX_PAGE}
        goToPage={goToPage}
        input={input}
        handleInputChange={handleInputChange}
        handleInputBlur={handleInputBlur}
        handleInputKeyDown={handleInputKeyDown}
        mistakes={mistakes.length}
        resetMistakes={resetMistakes}
        toggleMushaf={toggleMushaf}
        showMushaf={showMushaf}
        showRating={showRating}
        showDashboard={showDashboard}
        onShowRating={showRatingForm}
        onHideRating={hideRatingForm}
        onShowDashboard={showProgressDashboard}
        onHideDashboard={hideProgressDashboard}
      />
    </div>
  );
}

export default App;
