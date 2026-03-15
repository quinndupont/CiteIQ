// CiteIQ - Citation Intelligence Quotient

// API base URL
const API_BASE = 'https://iqm-api.isaac-q-dupont.workers.dev';
// For local development:
// const API_BASE = 'http://localhost:8787';

// State
let currentAuthorId = null;
let allPapersVisible = false;
const MAX_PAPERS_COLLAPSED = 10;

// DOM Elements
const searchForm = document.getElementById('search-form');
const authorInput = document.getElementById('author-input');
const searchBtn = document.getElementById('search-btn');
const authorResults = document.getElementById('author-results');
const authorList = document.getElementById('author-list');
const loadingSection = document.getElementById('loading');
const errorSection = document.getElementById('error');
const errorMessage = document.getElementById('error-message');
const resultsSection = document.getElementById('results');

// Event Listeners
searchForm.addEventListener('submit', handleSearch);
document.getElementById('toggle-papers').addEventListener('click', togglePapers);

async function handleSearch(e) {
  e.preventDefault();
  const query = authorInput.value.trim();

  if (query.length < 2) {
    showError('Please enter at least 2 characters');
    return;
  }

  hideAll();
  setLoading(true);

  try {
    const response = await fetch(`${API_BASE}/api/search-author?q=${encodeURIComponent(query)}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to search authors');
    }

    if (data.authors.length === 0) {
      showError('No authors found. Try a different search term.');
      return;
    }

    displayAuthorResults(data.authors);
  } catch (error) {
    showError(error.message);
  } finally {
    setLoading(false);
  }
}

function displayAuthorResults(authors) {
  authorList.innerHTML = '';

  authors.forEach(author => {
    const li = document.createElement('li');
    li.innerHTML = `
      <div class="author-name">${escapeHtml(author.name)}</div>
      <div class="author-meta">
        ${author.institution ? escapeHtml(author.institution) : 'Unknown institution'}
        ${author.country ? `(${author.country})` : ''}
        &bull; ${author.worksCount.toLocaleString()} papers
        &bull; ${author.citedByCount.toLocaleString()} citations
      </div>
    `;
    li.addEventListener('click', () => selectAuthor(author));
    authorList.appendChild(li);
  });

  authorResults.classList.remove('hidden');
}

async function selectAuthor(author) {
  currentAuthorId = author.id;
  authorResults.classList.add('hidden');
  authorInput.value = author.name;

  await calculateCiteIQ(author.id);
}

async function calculateCiteIQ(authorId, refresh = false) {
  hideAll();
  setLoading(true);

  try {
    let url = `${API_BASE}/api/calculate-iqm?author_id=${encodeURIComponent(authorId)}`;
    if (refresh) {
      url += '&refresh=true';
    }

    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to calculate CiteIQ');
    }

    displayResults(data);
  } catch (error) {
    showError(error.message);
  } finally {
    setLoading(false);
  }
}

function displayResults(data) {
  // Author name
  document.getElementById('author-name').textContent = data.author.name;

  // CiteIQ Scores (h-index style)
  document.getElementById('citeiq-h').textContent = data.iqm.h;
  document.getElementById('citeiq-i10').textContent = data.iqm.i10;
  document.getElementById('h-index').textContent = data.iqm.hIndex;

  // Stats
  document.getElementById('paper-count').textContent = data.iqm.paperCount;
  document.getElementById('total-weighted').textContent = Math.round(data.iqm.totalWeightedCitations).toLocaleString();
  document.getElementById('retraction-count').textContent = data.iqm.retractionCount;
  document.getElementById('deindexed-count').textContent = data.iqm.deindexedCount;

  // Show/hide warning cards based on counts
  document.getElementById('retraction-card').style.display =
    data.iqm.retractionCount > 0 ? 'block' : 'none';
  document.getElementById('deindexed-card').style.display =
    data.iqm.deindexedCount > 0 ? 'block' : 'none';

  // Papers table
  displayPapers(data.papers);

  // Cache status
  document.getElementById('cache-status').textContent = data.cached
    ? 'Showing cached results'
    : `Calculated at ${new Date(data.calculatedAt).toLocaleString()}`;

  resultsSection.classList.remove('hidden');
}

function displayPapers(papers) {
  const tbody = document.getElementById('papers-body');
  tbody.innerHTML = '';

  const toggleBtn = document.getElementById('toggle-papers');

  papers.forEach((paper, index) => {
    const tr = document.createElement('tr');

    // Add class for status
    if (paper.journalDeindexed) {
      tr.classList.add('deindexed');
    } else if (paper.isRetracted) {
      tr.classList.add('retracted');
    }

    // Hide rows beyond the limit if collapsed
    if (!allPapersVisible && index >= MAX_PAPERS_COLLAPSED) {
      tr.classList.add('hidden');
    }

    // Status badge
    let statusBadge = '<span class="status-badge ok">OK</span>';
    if (paper.journalDeindexed) {
      statusBadge = '<span class="status-badge deindexed">De-indexed</span>';
    } else if (paper.isRetracted) {
      statusBadge = '<span class="status-badge retracted">Retracted</span>';
    }

    tr.innerHTML = `
      <td class="paper-title" title="${escapeHtml(paper.title)}">${escapeHtml(paper.title)}</td>
      <td>${paper.year}</td>
      <td>${paper.citations.toLocaleString()}</td>
      <td>${capitalizeFirst(paper.position)}</td>
      <td>${(paper.weight * 100).toFixed(0)}%</td>
      <td><strong>${paper.weightedCitations.toLocaleString(undefined, { maximumFractionDigits: 1 })}</strong></td>
      <td>${statusBadge}</td>
    `;

    tbody.appendChild(tr);
  });

  // Update toggle button
  if (papers.length > MAX_PAPERS_COLLAPSED) {
    toggleBtn.textContent = allPapersVisible ? 'Show Less' : `Show All (${papers.length})`;
    toggleBtn.style.display = 'inline-block';
  } else {
    toggleBtn.style.display = 'none';
  }
}

function togglePapers() {
  allPapersVisible = !allPapersVisible;
  const rows = document.querySelectorAll('#papers-body tr');
  const toggleBtn = document.getElementById('toggle-papers');

  rows.forEach((row, index) => {
    if (index >= MAX_PAPERS_COLLAPSED) {
      row.classList.toggle('hidden', !allPapersVisible);
    }
  });

  toggleBtn.textContent = allPapersVisible ? 'Show Less' : `Show All (${rows.length})`;
}

function refreshCiteIQ() {
  if (currentAuthorId) {
    calculateCiteIQ(currentAuthorId, true);
  }
}

// Utility functions
function setLoading(isLoading) {
  loadingSection.classList.toggle('hidden', !isLoading);
  searchBtn.disabled = isLoading;
}

function showError(message) {
  errorMessage.textContent = message;
  errorSection.classList.remove('hidden');
}

function clearError() {
  errorSection.classList.add('hidden');
}

function hideAll() {
  authorResults.classList.add('hidden');
  errorSection.classList.add('hidden');
  resultsSection.classList.add('hidden');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function capitalizeFirst(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
