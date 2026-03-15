-- IQM Database Schema

-- Drop old table if exists (schema change)
DROP TABLE IF EXISTS cached_iqm;

-- Cached IQM calculations for authors
CREATE TABLE IF NOT EXISTS cached_iqm (
  author_id TEXT PRIMARY KEY,
  author_name TEXT NOT NULL,
  iqm_h INTEGER NOT NULL,
  iqm_i10 INTEGER NOT NULL,
  total_weighted_citations REAL NOT NULL,
  paper_count INTEGER NOT NULL,
  retraction_count INTEGER DEFAULT 0,
  deindexed_count INTEGER DEFAULT 0,
  calculated_at TEXT NOT NULL,
  papers_json TEXT NOT NULL
);

-- Index for faster lookups by name
CREATE INDEX IF NOT EXISTS idx_cached_iqm_name ON cached_iqm(author_name);

-- De-indexed journals list
CREATE TABLE IF NOT EXISTS deindexed_journals (
  issn TEXT PRIMARY KEY,
  journal_name TEXT NOT NULL,
  source TEXT NOT NULL,
  added_at TEXT NOT NULL
);

-- Index for journal name lookups (fuzzy matching)
CREATE INDEX IF NOT EXISTS idx_deindexed_name ON deindexed_journals(journal_name);
