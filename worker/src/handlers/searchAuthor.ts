import { Context } from 'hono';
import { Env } from '../index';
import { OpenAlexService } from '../services/openalex';

export async function searchAuthor(c: Context<{ Bindings: Env }>) {
  const query = c.req.query('q');

  if (!query || query.trim().length < 2) {
    return c.json({ error: 'Query parameter "q" is required and must be at least 2 characters' }, 400);
  }

  try {
    const openAlex = new OpenAlexService(c.env.OPENALEX_API_KEY, c.env.CACHE);
    const authors = await openAlex.searchAuthors(query.trim(), 10);

    // Transform to our API format
    const results = authors.map((author) => ({
      id: author.id.replace('https://openalex.org/', ''),
      name: author.display_name,
      institution: author.last_known_institutions?.[0]?.display_name || null,
      country: author.last_known_institutions?.[0]?.country_code || null,
      worksCount: author.works_count,
      citedByCount: author.cited_by_count,
      orcid: author.orcid ? author.orcid.replace('https://orcid.org/', '') : null,
    }));

    return c.json({
      query,
      count: results.length,
      authors: results,
    });
  } catch (error) {
    console.error('Author search error:', error);
    return c.json({
      error: 'Failed to search authors',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
}
