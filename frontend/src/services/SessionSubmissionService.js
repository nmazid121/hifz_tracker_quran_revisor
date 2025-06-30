// SessionSubmissionService.js
// Handles data collection, validation, and submission for recitation sessions

class SessionSubmissionService {
  constructor() {
    this.apiBaseUrl = '/api';
    this.offlineQueue = [];
    this.isOnline = navigator.onLine;
    
    // Listen for online/offline events
    window.addEventListener('online', this.handleOnline.bind(this));
    window.addEventListener('offline', this.handleOffline.bind(this));
    
    // Load offline queue from localStorage
    this.loadOfflineQueue();
  }

  // Data collection and validation
  collectSessionData({
    pageNumber,
    mistakes = [],
    rating,
    notes = '',
    audioBlob = null
  }) {
    const sessionData = {
      page_number: parseInt(pageNumber),
      surah_name: this.extractSurahName(pageNumber), // We'll need to implement this
      juz: this.calculateJuz(pageNumber), // We'll need to implement this
      rating,
      manual_mistakes: mistakes,
      notes: notes.trim(),
      recitation_date: new Date().toISOString(),
      audio_recorded: !!audioBlob
    };

    return sessionData;
  }

  validateSessionData(sessionData) {
    const errors = [];
    
    if (!sessionData.page_number || sessionData.page_number < 1 || sessionData.page_number > 604) {
      errors.push('Invalid page number');
    }
    
    if (!sessionData.rating) {
      errors.push('Rating is required');
    }
    
    const validRatings = ['Perfect', 'Good', 'Okay', 'Bad', 'Rememorize'];
    if (sessionData.rating && !validRatings.includes(sessionData.rating)) {
      errors.push('Invalid rating value');
    }
    
    if (sessionData.notes && sessionData.notes.length > 500) {
      errors.push('Notes must be 500 characters or less');
    }
    
    if (!Array.isArray(sessionData.manual_mistakes)) {
      errors.push('Mistakes must be an array');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Submit session data
  async submitSession(sessionData) {
    const validation = this.validateSessionData(sessionData);
    
    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    if (!this.isOnline) {
      return this.queueForOfflineSubmission(sessionData);
    }

    const maxRetries = 3;
    let retryCount = 0;
    
    const attemptSubmit = async () => {
      try {
        const response = await fetch(`${this.apiBaseUrl}/recitations`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(sessionData)
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        const result = await response.json();
        return {
          success: true,
          data: result,
          message: 'Session submitted successfully'
        };
      } catch (error) {
        // If it's a connection error and we haven't exceeded max retries, try again
        if ((error.name === 'TypeError' || error.message.includes('fetch') || error.message.includes('ECONNREFUSED')) && retryCount < maxRetries) {
          retryCount++;
          console.log(`Submission failed, retrying... (${retryCount}/${maxRetries})`);
          
          // Wait before retrying (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
          return attemptSubmit();
        }
        
        // If all retries failed or it's not a connection error, queue for offline
        if (error.name === 'TypeError' || error.message.includes('fetch') || error.message.includes('ECONNREFUSED')) {
          return this.queueForOfflineSubmission(sessionData);
        }
        throw error;
      }
    };
    
    return attemptSubmit();
  }

  // Offline support
  queueForOfflineSubmission(sessionData) {
    const queueItem = {
      id: Date.now().toString(),
      data: sessionData,
      timestamp: new Date().toISOString(),
      retryCount: 0
    };

    this.offlineQueue.push(queueItem);
    this.saveOfflineQueue();

    return {
      success: true,
      queued: true,
      message: 'Session queued for submission when online'
    };
  }

  async processOfflineQueue() {
    if (!this.isOnline || this.offlineQueue.length === 0) {
      return;
    }

    const results = [];
    const failedItems = [];

    for (const item of this.offlineQueue) {
      try {
        const result = await this.submitSession(item.data);
        if (result.success && !result.queued) {
          results.push({ id: item.id, success: true });
        } else {
          failedItems.push(item);
        }
      } catch (error) {
        item.retryCount = (item.retryCount || 0) + 1;
        if (item.retryCount < 3) {
          failedItems.push(item);
        } else {
          results.push({ id: item.id, success: false, error: error.message });
        }
      }
    }

    this.offlineQueue = failedItems;
    this.saveOfflineQueue();

    return results;
  }

  // Offline queue management
  saveOfflineQueue() {
    try {
      localStorage.setItem('recitation_offline_queue', JSON.stringify(this.offlineQueue));
    } catch (error) {
      console.warn('Failed to save offline queue:', error);
    }
  }

  loadOfflineQueue() {
    try {
      const saved = localStorage.getItem('recitation_offline_queue');
      if (saved) {
        this.offlineQueue = JSON.parse(saved);
      }
    } catch (error) {
      console.warn('Failed to load offline queue:', error);
      this.offlineQueue = [];
    }
  }

  getQueuedSubmissions() {
    return this.offlineQueue.map(item => ({
      id: item.id,
      pageNumber: item.data.page_number,
      rating: item.data.rating,
      timestamp: item.timestamp,
      retryCount: item.retryCount || 0
    }));
  }

  removeFromQueue(id) {
    this.offlineQueue = this.offlineQueue.filter(item => item.id !== id);
    this.saveOfflineQueue();
  }

  // Network status handlers
  handleOnline() {
    this.isOnline = true;
    this.processOfflineQueue().catch(console.error);
  }

  handleOffline() {
    this.isOnline = false;
  }

  // Helper functions for Quran data
  extractSurahName(pageNumber) {
    // This would typically come from the QUL database
    // For now, we'll use a simplified mapping
    const surahMapping = this.getSimplifiedSurahMapping();
    
    for (const surah of surahMapping) {
      if (pageNumber >= surah.startPage && pageNumber <= surah.endPage) {
        return surah.name;
      }
    }
    
    return 'Unknown';
  }

  calculateJuz(pageNumber) {
    // Approximate juz calculation (each juz is roughly 20 pages)
    return Math.ceil(pageNumber / 20);
  }

  getSimplifiedSurahMapping() {
    // Simplified mapping - in a real app, this would come from the database
    return [
      { name: 'Al-Fatiha', startPage: 1, endPage: 1 },
      { name: 'Al-Baqarah', startPage: 2, endPage: 49 },
      { name: 'Ali Imran', startPage: 50, endPage: 76 },
      { name: 'An-Nisa', startPage: 77, endPage: 106 },
      { name: 'Al-Maidah', startPage: 106, endPage: 128 },
      // Add more mappings as needed
      { name: 'Generic', startPage: 129, endPage: 604 }
    ];
  }

  // API methods for fetching data
  async fetchRecitations(filters = {}) {
    try {
      const queryParams = new URLSearchParams();
      
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          queryParams.append(key, value);
        }
      });

      const url = `${this.apiBaseUrl}/recitations${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to fetch recitations:', error);
      throw error;
    }
  }

  async fetchRecitation(id) {
    try {
      const response = await fetch(`${this.apiBaseUrl}/recitations/${id}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to fetch recitation:', error);
      throw error;
    }
  }

  async updateRecitation(id, updateData) {
    try {
      const response = await fetch(`${this.apiBaseUrl}/recitations/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to update recitation:', error);
      throw error;
    }
  }

  async deleteRecitation(id) {
    try {
      const response = await fetch(`${this.apiBaseUrl}/recitations/${id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to delete recitation:', error);
      throw error;
    }
  }

  async fetchStats() {
    try {
      const response = await fetch(`${this.apiBaseUrl}/recitations/stats`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to fetch stats:', error);
      throw error;
    }
  }
}

// Create and export a singleton instance
const sessionSubmissionService = new SessionSubmissionService();
export default sessionSubmissionService;