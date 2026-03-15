import { Context } from 'hono';
import { Env } from '../index';
import { OpenAlexService } from '../services/openalex';
import {
  calculateAuthorIQM,
  cacheIQMResult,
  getCachedIQM,
} from '../services/iqm';

export async function calculateIqm(c: Context<{ Bindings: Env }>) {
  const authorId = c.req.query('author_id');
  const forceRefresh = c.req.query('refresh') === 'true';

  if (!authorId) {
    return c.json({ error: 'Query parameter "author_id" is required' }, 400);
  }

  try {
    // Check cache first (unless force refresh requested)
    if (!forceRefresh) {
      const cached = await getCachedIQM(c.env.DB, authorId);
      if (cached) {
        return c.json({
          author: {
            id: cached.authorId,
            name: cached.hasRetractions ? `${cached.authorName}*` : cached.authorName,
            hasRetractions: cached.hasRetractions,
          },
          iqm: {
            hIndex: cached.hIndex,
            h: cached.iqmH,
            i10: cached.iqmI10,
            totalWeightedCitations: cached.totalWeightedCitations,
            paperCount: cached.paperCount,
            retractionCount: cached.retractionCount,
            deindexedCount: cached.deindexedCount,
          },
          papers: cached.papers,
          cached: true,
          calculatedAt: null,
        });
      }
    }

    // Fetch fresh data from OpenAlex
    const openAlex = new OpenAlexService(c.env.OPENALEX_API_KEY, c.env.CACHE);

    // First, search for the author to get their name
    const authors = await openAlex.searchAuthors(authorId, 1);
    let authorName = 'Unknown Author';

    // Try to find the author by ID in the search results
    // If not found, we'll use the ID as a fallback
    if (authors.length > 0) {
      authorName = authors[0].display_name;
    }

    // Fetch all works for this author
    const works = await openAlex.getAllAuthorWorks(authorId);

    if (works.length === 0) {
      return c.json({
        author: {
          id: authorId,
          name: authorName,
          hasRetractions: false,
        },
        iqm: {
          hIndex: 0,
          h: 0,
          i10: 0,
          totalWeightedCitations: 0,
          paperCount: 0,
          retractionCount: 0,
          deindexedCount: 0,
        },
        papers: [],
        cached: false,
        calculatedAt: new Date().toISOString(),
      });
    }

    // Get the author name from the first work where they appear
    for (const work of works) {
      for (const authorship of work.authorships) {
        if (!authorship.author.id) continue;
        const workAuthorId = authorship.author.id.replace('https://openalex.org/', '');
        if (workAuthorId === authorId || `https://openalex.org/${authorId}` === authorship.author.id) {
          authorName = authorship.author.display_name;
          break;
        }
      }
      if (authorName !== 'Unknown Author') break;
    }

    // Calculate IQM
    const result = await calculateAuthorIQM(c.env.DB, authorId, authorName, works);

    // Cache the result
    await cacheIQMResult(c.env.DB, result);

    return c.json({
      author: {
        id: result.authorId,
        name: result.hasRetractions ? `${result.authorName}*` : result.authorName,
        hasRetractions: result.hasRetractions,
      },
      iqm: {
        hIndex: result.hIndex,
        h: result.iqmH,
        i10: result.iqmI10,
        totalWeightedCitations: result.totalWeightedCitations,
        paperCount: result.paperCount,
        retractionCount: result.retractionCount,
        deindexedCount: result.deindexedCount,
      },
      papers: result.papers,
      cached: false,
      calculatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('IQM calculation error:', error);
    return c.json({
      error: 'Failed to calculate IQM',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
}
