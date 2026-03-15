// IQM (Integrity-Weighted Quotient Metric) Calculation Engine

import { OpenAlexWork, OpenAlexAuthorship } from './openalex';

export interface PaperIQM {
  id: string;
  title: string;
  year: number;
  doi?: string;
  citations: number;
  position: 'first' | 'middle' | 'last';
  authorsCount: number;
  weight: number;
  weightedCitations: number;
  isRetracted: boolean;
  journalDeindexed: boolean;
  journalName?: string;
}

export interface AuthorIQM {
  authorId: string;
  authorName: string;
  hasRetractions: boolean;
  // Traditional h-index (for comparison)
  hIndex: number;
  // IQM-h: h papers with at least h weighted citations (comparable to h-index)
  iqmH: number;
  // IQM-i10: papers with at least 10 weighted citations (comparable to i10-index)
  iqmI10: number;
  // Total weighted citations (for reference)
  totalWeightedCitations: number;
  paperCount: number;
  retractionCount: number;
  deindexedCount: number;
  papers: PaperIQM[];
}

/**
 * Calculate the weight for an author position
 *
 * Weighting scheme (academic convention):
 * - Single author: 100%
 * - Two authors: first 20%, last 80%
 * - Three+ authors: first 20%, last 20%, middle split 60%
 */
export function calculateWeight(
  position: 'first' | 'middle' | 'last',
  totalAuthors: number
): number {
  if (totalAuthors === 1) {
    return 1.0;
  }

  if (totalAuthors === 2) {
    return position === 'first' ? 0.2 : 0.8;
  }

  // Three or more authors
  switch (position) {
    case 'first':
      return 0.2;
    case 'last':
      return 0.2;
    case 'middle':
      // Middle authors split 60% equally
      const middleCount = totalAuthors - 2;
      return 0.6 / middleCount;
  }
}

/**
 * Find the target author's position in a paper
 */
export function findAuthorPosition(
  authorships: OpenAlexAuthorship[],
  targetAuthorId: string
): { position: 'first' | 'middle' | 'last'; found: boolean } {
  const normalizedTargetId = targetAuthorId.replace('https://openalex.org/', '');

  for (const authorship of authorships) {
    if (!authorship.author.id) continue;
    const authorId = authorship.author.id.replace('https://openalex.org/', '');
    if (authorId === normalizedTargetId) {
      return { position: authorship.author_position, found: true };
    }
  }

  return { position: 'middle', found: false };
}

/**
 * Calculate traditional h-index (using raw citations)
 * A researcher has h-index of h if they have h papers with at least h citations each
 */
export function calculateHIndex(papers: PaperIQM[]): number {
  // Sort papers by raw citations (highest first)
  const sortedByCitations = [...papers].sort((a, b) => b.citations - a.citations);

  let h = 0;
  for (let i = 0; i < sortedByCitations.length; i++) {
    // Paper at index i has rank (i + 1)
    // If citations >= rank, this paper contributes to h-index
    if (sortedByCitations[i].citations >= i + 1) {
      h = i + 1;
    } else {
      break;
    }
  }
  return h;
}

/**
 * Calculate IQM-h index (h-index using weighted citations)
 * A researcher has IQM-h of h if they have h papers with at least h weighted citations each
 */
export function calculateIqmH(papers: PaperIQM[]): number {
  // Papers should already be sorted by weightedCitations descending
  let h = 0;
  for (let i = 0; i < papers.length; i++) {
    // Paper at index i has rank (i + 1)
    // If weighted citations >= rank, this paper contributes to h-index
    if (papers[i].weightedCitations >= i + 1) {
      h = i + 1;
    } else {
      break;
    }
  }
  return h;
}

/**
 * Calculate IQM-i10 (count of papers with at least 10 weighted citations)
 */
export function calculateIqmI10(papers: PaperIQM[]): number {
  return papers.filter(p => p.weightedCitations >= 10).length;
}

/**
 * Check if a journal ISSN is in the de-indexed list
 */
export async function isJournalDeindexed(
  db: D1Database,
  issns: string[] | undefined
): Promise<boolean> {
  if (!issns || issns.length === 0) {
    return false;
  }

  const placeholders = issns.map(() => '?').join(',');
  const result = await db
    .prepare(`SELECT COUNT(*) as count FROM deindexed_journals WHERE issn IN (${placeholders})`)
    .bind(...issns)
    .first<{ count: number }>();

  return (result?.count ?? 0) > 0;
}

/**
 * Calculate IQM for an author based on their works
 */
export async function calculateAuthorIQM(
  db: D1Database,
  authorId: string,
  authorName: string,
  works: OpenAlexWork[]
): Promise<AuthorIQM> {
  const papers: PaperIQM[] = [];
  let totalIqm = 0;
  let retractionCount = 0;
  let deindexedCount = 0;

  for (const work of works) {
    // Find author's position in this paper
    const { position, found } = findAuthorPosition(work.authorships, authorId);

    if (!found) {
      // Author not found in this paper's authorships - skip
      continue;
    }

    const totalAuthors = work.authorships.length;
    const weight = calculateWeight(position, totalAuthors);

    // Check if journal is de-indexed
    const issns = work.primary_location?.source?.issn;
    const journalDeindexed = await isJournalDeindexed(db, issns);

    // Calculate weighted citations
    let weightedCitations = 0;

    if (journalDeindexed) {
      // De-indexed journal = 0 citations
      weightedCitations = 0;
      deindexedCount++;
    } else {
      weightedCitations = work.cited_by_count * weight;
    }

    if (work.is_retracted) {
      retractionCount++;
    }

    totalIqm += weightedCitations;

    papers.push({
      id: work.id,
      title: work.title,
      year: work.publication_year,
      doi: work.doi?.replace('https://doi.org/', ''),
      citations: work.cited_by_count,
      position,
      authorsCount: totalAuthors,
      weight: Math.round(weight * 100) / 100,
      weightedCitations: Math.round(weightedCitations * 100) / 100,
      isRetracted: work.is_retracted,
      journalDeindexed,
      journalName: work.primary_location?.source?.display_name,
    });
  }

  // Sort papers by weighted citations (highest first)
  papers.sort((a, b) => b.weightedCitations - a.weightedCitations);

  // Calculate h-index style metrics
  const hIndex = calculateHIndex(papers);
  const iqmH = calculateIqmH(papers);
  const iqmI10 = calculateIqmI10(papers);

  return {
    authorId,
    authorName,
    hasRetractions: retractionCount > 0,
    hIndex,
    iqmH,
    iqmI10,
    totalWeightedCitations: Math.round(totalIqm * 100) / 100,
    paperCount: papers.length,
    retractionCount,
    deindexedCount,
    papers,
  };
}

/**
 * Cache an IQM calculation result to D1
 */
export async function cacheIQMResult(db: D1Database, result: AuthorIQM): Promise<void> {
  await db
    .prepare(`
      INSERT OR REPLACE INTO cached_iqm
      (author_id, author_name, h_index, iqm_h, iqm_i10, total_weighted_citations, paper_count, retraction_count, deindexed_count, calculated_at, papers_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .bind(
      result.authorId,
      result.authorName,
      result.hIndex,
      result.iqmH,
      result.iqmI10,
      result.totalWeightedCitations,
      result.paperCount,
      result.retractionCount,
      result.deindexedCount,
      new Date().toISOString(),
      JSON.stringify(result.papers)
    )
    .run();
}

/**
 * Get cached IQM result from D1
 */
export async function getCachedIQM(
  db: D1Database,
  authorId: string
): Promise<AuthorIQM | null> {
  const row = await db
    .prepare('SELECT * FROM cached_iqm WHERE author_id = ?')
    .bind(authorId)
    .first<{
      author_id: string;
      author_name: string;
      h_index: number;
      iqm_h: number;
      iqm_i10: number;
      total_weighted_citations: number;
      paper_count: number;
      retraction_count: number;
      deindexed_count: number;
      calculated_at: string;
      papers_json: string;
    }>();

  if (!row) {
    return null;
  }

  return {
    authorId: row.author_id,
    authorName: row.author_name,
    hasRetractions: row.retraction_count > 0,
    hIndex: row.h_index,
    iqmH: row.iqm_h,
    iqmI10: row.iqm_i10,
    totalWeightedCitations: row.total_weighted_citations,
    paperCount: row.paper_count,
    retractionCount: row.retraction_count,
    deindexedCount: row.deindexed_count,
    papers: JSON.parse(row.papers_json),
  };
}
