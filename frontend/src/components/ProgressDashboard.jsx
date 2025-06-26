import React, { useState, useEffect, useMemo, useCallback } from 'react';
import sessionSubmissionService from '../services/SessionSubmissionService';

const ProgressDashboard = ({ onClose }) => {
  const [recitations, setRecitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingCell, setEditingCell] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [selectedRows, setSelectedRows] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortConfig, setSortConfig] = useState({ key: 'recitation_date', direction: 'desc' });
  const [filters, setFilters] = useState({
    rating: '',
    surah_name: '',
    page_number: '',
    date_from: '',
    date_to: ''
  });

  const ratings = ['Perfect', 'Good', 'Okay', 'Bad', 'Rememorize'];
  const ratingColors = {
    'Perfect': '#22c55e',
    'Good': '#3b82f6',
    'Okay': '#f59e0b',
    'Bad': '#ef4444',
    'Rememorize': '#8b5cf6'
  };

  // Load data - stabilized with useCallback
  const loadRecitations = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const result = await sessionSubmissionService.fetchRecitations(filters);
      setRecitations(result.recitations || []);
    } catch (error) {
      console.error('Error loading recitations:', error);
      setError('Failed to load recitations: ' + error.message);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadRecitations();
  }, [loadRecitations]);

  // Sorting
  const sortedData = useMemo(() => {
    if (!sortConfig.key) return recitations;

    return [...recitations].sort((a, b) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];

      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [recitations, sortConfig]);

  // Pagination
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return sortedData.slice(startIndex, startIndex + pageSize);
  }, [sortedData, currentPage, pageSize]);

  const totalPages = Math.ceil(sortedData.length / pageSize);

  const handleSort = useCallback((key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  }, []);

  const handleFilterChange = useCallback((key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  }, []);

  const handleEdit = useCallback((rowId, column, currentValue) => {
    setEditingCell({ rowId, column });
    setEditValue(currentValue || '');
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editingCell) return;

    try {
      const { rowId, column } = editingCell;
      const updateData = {};
      
      if (column === 'fixed_it_date') {
        updateData.fixed_it_date = editValue ? new Date(editValue).toISOString() : null;
      } else if (column === 'notes') {
        updateData.notes = editValue;
      } else if (column === 'prev_rating') {
        updateData.prev_rating = editValue;
      }

      await sessionSubmissionService.updateRecitation(rowId, updateData);
      
      // Update local state
      setRecitations(prev => prev.map(rec => 
        rec.id === rowId ? { ...rec, [column]: editValue } : rec
      ));
      
      setEditingCell(null);
      setEditValue('');
    } catch (error) {
      setError('Failed to update recitation: ' + error.message);
    }
  }, [editingCell, editValue]);

  const handleCancelEdit = useCallback(() => {
    setEditingCell(null);
    setEditValue('');
  }, []);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter') {
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  }, [handleSaveEdit, handleCancelEdit]);

  const toggleRowSelection = useCallback((id) => {
    setSelectedRows(prev => 
      prev.includes(id) 
        ? prev.filter(rowId => rowId !== id)
        : [...prev, id]
    );
  }, []);

  const selectAllRows = useCallback(() => {
    const allIds = paginatedData.map(rec => rec.id);
    setSelectedRows(prev => 
      prev.length === allIds.length ? [] : allIds
    );
  }, [paginatedData]);

  const formatDate = useCallback((dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString();
  }, []);

  const getSortIcon = useCallback((key) => {
    if (sortConfig.key !== key) return '↕️';
    return sortConfig.direction === 'asc' ? '↑' : '↓';
  }, [sortConfig]);

  const renderEditableCell = (record, column, value) => {
    const isEditing = editingCell?.rowId === record.id && editingCell?.column === column;
    
    if (isEditing) {
      if (column === 'fixed_it_date') {
        return (
          <input
            type="date"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleSaveEdit}
            onKeyDown={handleKeyDown}
            autoFocus
            className="edit-input"
          />
        );
      } else if (column === 'prev_rating') {
        return (
          <select
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleSaveEdit}
            onKeyDown={handleKeyDown}
            autoFocus
            className="edit-select"
          >
            <option value="">None</option>
            {ratings.map(rating => (
              <option key={rating} value={rating}>{rating}</option>
            ))}
          </select>
        );
      } else {
        return (
          <textarea
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleSaveEdit}
            onKeyDown={handleKeyDown}
            autoFocus
            className="edit-textarea"
            rows={2}
          />
        );
      }
    }
    
    return (
      <div 
        className="editable-cell"
        onClick={() => handleEdit(record.id, column, value)}
        title="Click to edit"
      >
        {column === 'prev_rating' && value ? (
          <span style={{ color: ratingColors[value] }}>{value}</span>
        ) : value ? (
          column === 'fixed_it_date' ? formatDate(value) : value
        ) : (
          <span className="empty-cell">Click to add</span>
        )}
      </div>
    );
  };

  if (loading) return <div className="dashboard-loading">Loading recitations...</div>;

  return (
    <div className="progress-dashboard">
      <div className="dashboard-header">
        <h2>Recitation Progress Dashboard</h2>
        <button onClick={onClose} className="btn-secondary">Close Dashboard</button>
      </div>

      {error && <div className="error-message">{error}</div>}

      {/* Filters */}
      <div className="dashboard-filters">
        <div className="filter-group">
          <label>Rating:</label>
          <select 
            value={filters.rating} 
            onChange={(e) => handleFilterChange('rating', e.target.value)}
          >
            <option value="">All Ratings</option>
            {ratings.map(rating => (
              <option key={rating} value={rating}>{rating}</option>
            ))}
          </select>
        </div>
        
        <div className="filter-group">
          <label>Page Number:</label>
          <input
            type="number"
            value={filters.page_number}
            onChange={(e) => handleFilterChange('page_number', e.target.value)}
            placeholder="Filter by page"
          />
        </div>
        
        <div className="filter-group">
          <label>Surah:</label>
          <input
            type="text"
            value={filters.surah_name}
            onChange={(e) => handleFilterChange('surah_name', e.target.value)}
            placeholder="Filter by surah"
          />
        </div>
        
        <div className="filter-group">
          <label>From Date:</label>
          <input
            type="date"
            value={filters.date_from}
            onChange={(e) => handleFilterChange('date_from', e.target.value)}
          />
        </div>
        
        <div className="filter-group">
          <label>To Date:</label>
          <input
            type="date"
            value={filters.date_to}
            onChange={(e) => handleFilterChange('date_to', e.target.value)}
          />
        </div>
        
        <button 
          onClick={() => {
            setFilters({
              rating: '',
              surah_name: '',
              page_number: '',
              date_from: '',
              date_to: ''
            });
          }}
          className="btn-secondary"
        >
          Clear Filters
        </button>
      </div>

      {/* Table */}
      <div className="dashboard-table-container">
        <table className="dashboard-table">
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  checked={selectedRows.length === paginatedData.length && paginatedData.length > 0}
                  onChange={selectAllRows}
                />
              </th>
              <th onClick={() => handleSort('page_number')} className="sortable">
                Page {getSortIcon('page_number')}
              </th>
              <th onClick={() => handleSort('juz')} className="sortable">
                Juz {getSortIcon('juz')}
              </th>
              <th onClick={() => handleSort('surah_name')} className="sortable">
                Surah {getSortIcon('surah_name')}
              </th>
              <th onClick={() => handleSort('recitation_date')} className="sortable">
                Last Revision {getSortIcon('recitation_date')}
              </th>
              <th onClick={() => handleSort('rating')} className="sortable">
                Rating {getSortIcon('rating')}
              </th>
              <th>Fixed Date</th>
              <th>Prev Rating</th>
              <th>Notes</th>
              <th>Mistakes</th>
            </tr>
          </thead>
          <tbody>
            {paginatedData.map(record => (
              <tr key={record.id} className={selectedRows.includes(record.id) ? 'selected' : ''}>
                <td>
                  <input
                    type="checkbox"
                    checked={selectedRows.includes(record.id)}
                    onChange={() => toggleRowSelection(record.id)}
                  />
                </td>
                <td>{record.page_number}</td>
                <td>{record.juz}</td>
                <td>{record.surah_name}</td>
                <td>{formatDate(record.recitation_date)}</td>
                <td>
                  <span 
                    className="rating-badge"
                    style={{ backgroundColor: ratingColors[record.rating] }}
                  >
                    {record.rating}
                  </span>
                </td>
                <td>{renderEditableCell(record, 'fixed_it_date', record.fixed_it_date)}</td>
                <td>{renderEditableCell(record, 'prev_rating', record.prev_rating)}</td>
                <td>{renderEditableCell(record, 'notes', record.notes)}</td>
                <td>
                  {record.manual_mistakes ? 
                    `${Array.isArray(record.manual_mistakes) ? record.manual_mistakes.length : 0} mistakes` 
                    : '0 mistakes'
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="dashboard-pagination">
        <div className="pagination-info">
          Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, sortedData.length)} of {sortedData.length} entries
        </div>
        
        <div className="pagination-controls">
          <button 
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
          >
            Previous
          </button>
          
          <span className="page-numbers">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const page = Math.max(1, currentPage - 2) + i;
              if (page <= totalPages) {
                return (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={currentPage === page ? 'active' : ''}
                  >
                    {page}
                  </button>
                );
              }
              return null;
            })}
          </span>
          
          <button 
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
          >
            Next
          </button>
        </div>
        
        <div className="page-size-controls">
          <label>Show:</label>
          <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
          <span>per page</span>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedRows.length > 0 && (
        <div className="bulk-actions">
          <span>{selectedRows.length} row(s) selected</span>
          <button 
            onClick={() => {
              // TODO: Implement bulk delete
              console.log('Bulk delete:', selectedRows);
            }}
            className="btn-danger"
          >
            Delete Selected
          </button>
        </div>
      )}
    </div>
  );
};

export default ProgressDashboard;