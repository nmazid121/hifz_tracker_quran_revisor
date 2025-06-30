import React, { useEffect, useState, useCallback } from 'react';

const MushafPage = ({ pageNumber, onMistakesChange }) => {
  const [pageData, setPageData] = useState(null);
  const [surahNames, setSurahNames] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [mistakes, setMistakes] = useState([]); // array of word IDs
  const [hoveredAyah, setHoveredAyah] = useState(null); // Track which ayah is being hovered

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

  // Load surah names once on component mount
  useEffect(() => {
    const loadSurahNames = async () => {
      try {
        const response = await fetch('/api/quran/surah-names');
        if (response.ok) {
          const names = await response.json();
          setSurahNames(names);
        }
      } catch (error) {
        console.error('Failed to load surah names:', error);
      }
    };
    
    loadSurahNames();
  }, []);

  // Restore mistakes on page load - ONLY when pageNumber changes
  useEffect(() => {
    let isCancelled = false;
    let retryCount = 0;
    const maxRetries = 3;
    
    const loadPageData = async () => {
      setLoading(true);
      setError(null);
      
      const attemptLoad = async () => {
        try {
          // Use the new QUL-compliant API endpoint
          const response = await fetch(`/api/quran/page-layout/${pageNumber}`);
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          
          const data = await response.json();
          
          if (!isCancelled) {
            setPageData(data);
            setLoading(false);
            const saved = sessionStorage.getItem(`mistakes_page_${pageNumber}`);
            const savedMistakes = saved ? JSON.parse(saved) : [];
            setMistakes(savedMistakes);
            setRevealed(false); // hide page on page change
            setHoveredAyah(null); // reset hover state
            
            // Notify parent component about initial mistakes
            stableOnMistakesChange(savedMistakes);
          }
        } catch (err) {
          if (!isCancelled) {
            // If it's a connection error and we haven't exceeded max retries, try again
            if ((err.message.includes('Failed to fetch') || err.message.includes('ECONNREFUSED')) && retryCount < maxRetries) {
              retryCount++;
              console.log(`Connection failed, retrying... (${retryCount}/${maxRetries})`);
              setError(`Connection issue, retrying... (${retryCount}/${maxRetries})`);
              
              // Wait before retrying (exponential backoff)
              setTimeout(attemptLoad, 1000 * retryCount);
              return;
            }
            
            setError(`Failed to load page data${retryCount > 0 ? ` after ${retryCount} retries` : ''}: ${err.message}`);
            setLoading(false);
          }
        }
      };
      
      attemptLoad();
    };

    loadPageData();

    return () => {
      isCancelled = true;
    };
  }, [pageNumber]); // Only depend on pageNumber

  const toggleReveal = useCallback(() => {
    setRevealed((r) => !r);
    setHoveredAyah(null); // Reset hover when toggling reveal
  }, []);

  const toggleMistake = useCallback((wordId) => {
    setMistakes((prev) =>
      prev.includes(wordId)
        ? prev.filter((id) => id !== wordId)
        : [...prev, wordId]
    );
  }, []);

  const resetMistakes = useCallback(() => setMistakes([]), []);

  // Handle ayah hover for preview in invisible mode
  const handleAyahMouseEnter = useCallback((lineNumber) => {
    if (!revealed) {
      setHoveredAyah(lineNumber);
    }
  }, [revealed]);

  const handleAyahMouseLeave = useCallback(() => {
    if (!revealed) {
      setHoveredAyah(null);
    }
  }, [revealed]);

  // Check if a word should be visible in invisible mode (first 2-3 words of ONLY the first ayah on the page)
  const isWordVisibleInInvisibleMode = useCallback((wordId, lineData, pageData) => {
    if (!lineData || lineData.line_type !== 'ayah' || !pageData) return false;
    
    // Find the first ayah line on the page
    const firstAyahLine = pageData.pageLayout.find(line => line.line_type === 'ayah');
    
    // Only show words from the very first ayah line
    if (!firstAyahLine || lineData.line_number !== firstAyahLine.line_number) {
      return false;
    }
    
    const firstWordId = lineData.first_word_id;
    const wordPosition = wordId - firstWordId;
    
    // Show first 3 words of only the first ayah
    return wordPosition < 3;
  }, []);

  // Get word visibility and opacity
  const getWordStyle = useCallback((wordId, lineData) => {
    if (revealed) {
      // Fully revealed mode
      return {
        opacity: 1,
        transition: 'opacity 0.4s',
      };
    } else {
      // Invisible mode
      const isVisible = isWordVisibleInInvisibleMode(wordId, lineData, pageData);
      const isHovered = hoveredAyah === lineData.line_number;
      
      let opacity = 0.05; // Very faint by default (even more invisible)
      
      if (isVisible) {
        opacity = 0.8; // First few words of first ayah are more visible
      } else if (isHovered) {
        opacity = 0.3; // Hovered ayah shows light preview
      }
      
      return {
        opacity,
        transition: 'opacity 0.3s ease',
      };
    }
  }, [revealed, hoveredAyah, isWordVisibleInInvisibleMode, pageData]);

  // Render line based on QUL specification
  const renderLine = useCallback((line) => {
    const lineClass = `mushaf-line ${line.is_centered ? 'centered' : ''}`;
    
    switch (line.line_type) {
      case 'surah_name':
        return (
          <div
            key={line.line_number}
            className={lineClass}
            style={{
              opacity: revealed ? 1 : 0.6,
              transition: 'opacity 0.4s',
            }}
          >
            <span className="surah-name">
              {surahNames[line.surah_number] || `Surah ${line.surah_number}`}
            </span>
          </div>
        );
        
      case 'basmallah':
        return (
          <div
            key={line.line_number}
            className={lineClass}
            style={{
              opacity: revealed ? 1 : 0.6,
              transition: 'opacity 0.4s',
            }}
          >
            <span className="basmallah">﷽</span>
          </div>
        );
        
      case 'ayah':
        if (line.first_word_id == null || line.last_word_id == null) {
          return null;
        }
        
        return (
          <div
            key={line.line_number}
            className={lineClass}
            onMouseEnter={() => handleAyahMouseEnter(line.line_number)}
            onMouseLeave={handleAyahMouseLeave}
            style={{
              cursor: !revealed ? 'pointer' : 'default',
            }}
          >
            {Array.from(
              { length: line.last_word_id - line.first_word_id + 1 },
              (_, i) => {
                const wordId = line.first_word_id + i;
                const wordText = pageData.wordData[wordId];
                
                if (!wordText) return null;
                
                // Check if this is the last word and needs an ayah marker
                let ayahMarker = null;
                if (wordId === line.last_word_id && line.ayah_number) {
                  // Create ayah marker using Unicode range for Quran ayah numbers
                  const codepoint = 0xF500 + line.ayah_number;
                  ayahMarker = (
                    <span 
                      className="ayah-marker" 
                      style={getWordStyle(wordId, line)}
                    >
                      {String.fromCharCode(codepoint)}
                    </span>
                  );
                }
                
                return (
                  <span
                    key={wordId}
                    data-word-id={wordId}
                    className={`mushaf-word${mistakes.includes(wordId) ? ' mistake' : ''}`}
                    onClick={() => toggleMistake(wordId)}
                    style={{
                      userSelect: 'none',
                      cursor: 'pointer',
                      ...getWordStyle(wordId, line),
                    }}
                  >
                    {wordText}
                    {ayahMarker}
                  </span>
                );
              }
            )}
          </div>
        );
        
      default:
        return null;
    }
  }, [revealed, surahNames, pageData, mistakes, getWordStyle, handleAyahMouseEnter, handleAyahMouseLeave, toggleMistake]);

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
  if (!pageData || !pageData.pageLayout) return <div>No data found.</div>;

  return (
    <div className="mushaf-text">
      <div className="mushaf-page">
        <div className="mushaf-controls">
          <button onClick={toggleReveal}>
            {revealed ? 'Hide' : 'Reveal'} Mushaf Page
          </button>
          <button onClick={resetMistakes}>
            Reset Mistakes
          </button>
          <span>
            Mistakes: {mistakeCount}
          </span>
          <span style={{ fontSize: '0.9em', color: '#888' }}>
            (Summary: {mistakeSummary})
          </span>
          {!revealed && (
            <span style={{ fontSize: '0.8em', color: '#666', fontStyle: 'italic' }}>
              Hover over lines for preview
            </span>
          )}
        </div>
        
        {pageData.pageLayout.map(renderLine)}
      </div>
    </div>
  );
};

export default MushafPage; 