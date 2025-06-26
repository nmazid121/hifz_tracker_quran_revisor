import React, { useState } from 'react';

const RecitationRating = ({ 
  pageNumber, 
  mistakeCount = 0, 
  onSubmit, 
  isSubmitting = false 
}) => {
  const [rating, setRating] = useState('');
  const [notes, setNotes] = useState('');
  const [showSummary, setShowSummary] = useState(false);
  const [errors, setErrors] = useState({});

  const ratings = [
    { value: 'Perfect', color: '#22c55e', description: 'Flawless recitation with no mistakes' },
    { value: 'Good', color: '#3b82f6', description: 'Minor mistakes that don\'t affect meaning' },
    { value: 'Okay', color: '#f59e0b', description: 'Some mistakes but generally acceptable' },
    { value: 'Bad', color: '#ef4444', description: 'Many mistakes, needs significant improvement' },
    { value: 'Rememorize', color: '#8b5cf6', description: 'Requires complete re-memorization' }
  ];

  const validateForm = () => {
    const newErrors = {};
    
    if (!rating) {
      newErrors.rating = 'Please select a rating';
    }
    
    if (notes.length > 500) {
      newErrors.notes = 'Notes must be 500 characters or less';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setShowSummary(true);
  };

  const confirmSubmission = () => {
    if (onSubmit) {
      onSubmit({ rating, notes });
    }
  };

  const cancelSubmission = () => {
    setShowSummary(false);
  };

  if (showSummary) {
    return (
      <div className="recitation-summary">
        <h3>Session Summary</h3>
        <div className="summary-content">
          <div className="summary-item">
            <label>Page:</label>
            <span>{pageNumber}</span>
          </div>
          <div className="summary-item">
            <label>Mistakes:</label>
            <span>{mistakeCount}</span>
          </div>
          <div className="summary-item">
            <label>Rating:</label>
            <span 
              className="rating-display"
              style={{ 
                color: ratings.find(r => r.value === rating)?.color,
                fontWeight: 'bold'
              }}
            >
              {rating}
            </span>
          </div>
          {notes && (
            <div className="summary-item">
              <label>Notes:</label>
              <p className="notes-preview">{notes}</p>
            </div>
          )}
        </div>
        
        <div className="summary-actions">
          <button 
            onClick={confirmSubmission} 
            className="btn-primary"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Submitting...' : 'Confirm & Submit'}
          </button>
          <button onClick={cancelSubmission} className="btn-secondary">
            Back to Edit
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="recitation-rating">
      <h3>Rate Your Recitation</h3>
      
      <form onSubmit={handleSubmit}>
        <div className="rating-section">
          <label>How was your recitation?</label>
          <div className="rating-options">
            {ratings.map((ratingOption) => (
              <div 
                key={ratingOption.value}
                className={`rating-option ${rating === ratingOption.value ? 'selected' : ''}`}
                onClick={() => setRating(ratingOption.value)}
                style={{ borderColor: rating === ratingOption.value ? ratingOption.color : '#ccc' }}
              >
                <div className="rating-value" style={{ color: ratingOption.color }}>
                  {ratingOption.value}
                </div>
                <div className="rating-description">
                  {ratingOption.description}
                </div>
              </div>
            ))}
          </div>
          {errors.rating && <div className="error-message">{errors.rating}</div>}
        </div>

        <div className="notes-section">
          <label htmlFor="notes">Notes (optional)</label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add any notes about your recitation, areas to focus on, or observations..."
            rows={4}
            maxLength={500}
          />
          <div className="character-count">
            {notes.length}/500 characters
          </div>
          {errors.notes && <div className="error-message">{errors.notes}</div>}
        </div>

        <button type="submit" className="btn-primary">
          Review & Submit
        </button>
      </form>
    </div>
  );
};

export default RecitationRating;