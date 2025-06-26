import React, { useEffect, useState, useCallback } from 'react';

const MushafPage = ({ pageNumber, onMistakesChange }) => {
  const [pageData, setPageData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [mistakes, setMistakes] = useState([]); // array of word IDs

  // Utility: count mistakes
  const mistakeCount = mistakes.length;
  // Utility: generate mistake summary (comma-separated word IDs)
  const mistakeSummary = mistakes.join(', ');

  // Stable callback for onMistakesChange
  const stableOnMistakesChange = useCallback((newMistakes) => {
    if (onMistakesChange) {
      onMistakesChange(newMistakes);
    }
  }, [onMistakesChange]);

  // Persist mistakes in sessionStorage per page
  useEffect(() => {
    if (pageData) {
      sessionStorage.setItem(`mistakes_page_${pageNumber}`, JSON.stringify(mistakes));
      stableOnMistakesChange(mistakes);
    }
  }, [mistakes, pageNumber, pageData, stableOnMistakesChange]);

  // Restore mistakes on page load - ONLY when pageNumber changes
  useEffect(() => {
    let isCancelled = false;
    
    const loadPageData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const response = await fetch(`/api/quran/page/${pageNumber}`);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!isCancelled) {
          setPageData(data);
          setLoading(false);
          const saved = sessionStorage.getItem(`mistakes_page_${pageNumber}`);
          const savedMistakes = saved ? JSON.parse(saved) : [];
          setMistakes(savedMistakes);
          setRevealed(false); // hide page on page change
          
          // Notify parent component about initial mistakes
          stableOnMistakesChange(savedMistakes);
        }
      } catch (err) {
        if (!isCancelled) {
          setError('Failed to load page data');
          setLoading(false);
        }
      }
    };

    loadPageData();

    return () => {
      isCancelled = true;
    };
  }, [pageNumber]); // Only depend on pageNumber

  const toggleReveal = useCallback(() => setRevealed((r) => !r), []);

  const toggleMistake = useCallback((wordId) => {
    setMistakes((prev) =>
      prev.includes(wordId)
        ? prev.filter((id) => id !== wordId)
        : [...prev, wordId]
    );
  }, []);

  const resetMistakes = useCallback(() => setMistakes([]), []);

  // Keyboard shortcuts: R to reveal/hide, M to reset mistakes
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'r' || e.key === 'R') {
        toggleReveal();
      } else if (e.key === 'm' || e.key === 'M') {
        resetMistakes();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleReveal, resetMistakes]);

  // Expose methods to parent component
  useEffect(() => {
    // This allows parent components to access these methods if needed
    window.mushafPageMethods = {
      getMistakes: () => mistakes,
      resetMistakes,
      toggleReveal,
      isRevealed: () => revealed
    };
    
    return () => {
      delete window.mushafPageMethods;
    };
  }, [mistakes, revealed, resetMistakes, toggleReveal]);

  if (loading) return <div>Loading...</div>;
  if (error) return <div style={{ color: 'red' }}>{error}</div>;
  if (!pageData || !pageData.pageData) return <div>No data found.</div>;

  return (
    <div className="mushaf-text">
      <div className="mushaf-page">
        <div className="mushaf-controls" style={{ marginBottom: '1rem' }}>
          <button onClick={toggleReveal}>
            {revealed ? 'Hide' : 'Reveal'} Mushaf Page
          </button>
          <button onClick={resetMistakes} style={{ marginLeft: 8 }}>
            Reset Mistakes
          </button>
          <span style={{ marginLeft: 16 }}>
            Mistakes: {mistakeCount}
          </span>
          <span style={{ marginLeft: 16, fontSize: '0.9em', color: '#888' }}>
            (Summary: {mistakeSummary})
          </span>
        </div>
        {pageData.pageData.map((line, idx) => {
          if (
            line.line_type === "ayah" &&
            line.first_word_id != null &&
            line.last_word_id != null
          ) {
            return (
              <div
                key={line.line_number}
                className={`mushaf-line ${line.is_centered ? 'centered' : ''} ${revealed ? 'revealed' : 'hidden'}`}
              >
                {line.line_type === 'surah_name' && (
                  <span className="surah-name">Surah {line.surah_number}</span>
                )}
                {line.line_type === 'basmallah' && <span className="basmallah">﷽</span>}
                {line.line_type === 'ayah' &&
                  Array.from(
                    { length: line.last_word_id - line.first_word_id + 1 },
                    (_, i) => {
                      const wordId = line.first_word_id + i;
                      const word = pageData.wordData[wordId];
                      const wordText = typeof word === "string" ? word : word?.text;
                      // Get ayah marker if this is the last word in the ayah
                      let ayahMarker = null;
                      if (wordId === line.last_word_id && line.ayah_number) {
                        // U+F501 is 0xF501, so add (ayah_number - 1) to 0xF501
                        const codepoint = 0xF500 + line.ayah_number;
                        ayahMarker = (
                          <span className="ayah-marker" style={{ margin: '0 0.3em', fontSize: '1.2em', fontFamily: 'IndopakNastaleeq, serif' }}>
                            {String.fromCharCode(codepoint)}
                          </span>
                        );
                      }
                      return wordText ? (
                        <span
                          key={wordId}
                          data-word-id={wordId}
                          className={`mushaf-word${mistakes.includes(wordId) ? ' mistake' : ''}`}
                          onClick={() => toggleMistake(wordId)}
                          style={{
                            userSelect: 'none',
                            textDecoration: mistakes.includes(wordId) ? 'underline wavy red' : 'none',
                            cursor: 'pointer',
                            opacity: revealed ? 1 : 0.2,
                            transition: 'opacity 0.4s',
                          }}
                        >
                          {wordText}
                          {ayahMarker}
                        </span>
                      ) : null;
                    }
                  )}
              </div>
            );
          } else if (line.line_type === "surah_name") {
            return (
              <div
                key={line.line_number}
                className={`mushaf-line ${line.is_centered ? 'centered' : ''} ${revealed ? 'revealed' : 'hidden'}`}
              >
                {line.line_type === 'surah_name' && (
                  <span className="surah-name">Surah {line.surah_number}</span>
                )}
              </div>
            );
          } else if (line.line_type === "basmallah") {
            return (
              <div
                key={line.line_number}
                className={`mushaf-line ${line.is_centered ? 'centered' : ''} ${revealed ? 'revealed' : 'hidden'}`}
              >
                {line.line_type === 'basmallah' && <span className="basmallah">﷽</span>}
              </div>
            );
          } else {
            return null;
          }
        })}
      </div>
    </div>
  );
};

export default MushafPage; 