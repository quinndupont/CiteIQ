// OpenAlex API Service
// Docs: https://docs.openalex.org/

const OPENALEX_BASE_URL = 'https://api.openalex.org';

export interface OpenAlexAuthor {
  id: string;
  display_name: string;
  works_count: number;
  cited_by_count: number;
  last_known_institutions: Array<{
    id: string;
    display_name: string;
    country_code: string;
  }>;
  orcid?: string;
}

export interface OpenAlexAuthorship {
  author_position: 'first' | 'middle' | 'last';
  author: {
    id: string;
    display_name: string;
    orcid?: string;
  };
  institutions: Array<{
    id: string;
    display_name: string;
  }>;
}

export interface OpenAlexWork {
  id: string;
  title: string;
  doi?: string;
  publication_date: string;
  publication_year: number;
  cited_by_count: number;
  is_retracted: boolean;
  authorships: OpenAlexAuthorship[];
  primary_location?: {
    source?: {
      id: string;
      display_name: string;
      issn?: string[];
      is_in_doaj: boolean;
    };
  };
}

interface OpenAlexResponse<T> {
  meta: {
    count: number;
    page: number;
    per_page: number;
  };
  results: T[];
}

export class OpenAlexService {
  private apiKey: string;
  private cache: KVNamespace;

  constructor(apiKey: string, cache: KVNamespace) {
    this.apiKey = apiKey;
    this.cache = cache;
  }

  private async fetchWithCache<T>(url: string, cacheKey: string, ttl: number = 3600): Promise<T> {
    // Check cache first
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Fetch from API
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'IQM-Calculator/1.0 (mailto:iqm@example.com)',
      },
    });

    if (!response.ok) {
      throw new Error(`OpenAlex API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as T;

    // Cache the result
    await this.cache.put(cacheKey, JSON.stringify(data), { expirationTtl: ttl });

    return data;
  }

  async searchAuthors(query: string, limit: number = 10): Promise<OpenAlexAuthor[]> {
    const url = `${OPENALEX_BASE_URL}/authors?search=${encodeURIComponent(query)}&per_page=${limit}&api_key=${this.apiKey}`;
    const cacheKey = `author_search:${query}:${limit}`;

    const response = await this.fetchWithCache<OpenAlexResponse<OpenAlexAuthor>>(url, cacheKey, 1800);
    return response.results;
  }

  async getAuthorWorks(authorId: string, page: number = 1, perPage: number = 100): Promise<{
    works: OpenAlexWork[];
    totalCount: number;
    hasMore: boolean;
  }> {
    // Extract just the ID if full URL is provided
    const id = authorId.replace('https://openalex.org/', '');

    const url = `${OPENALEX_BASE_URL}/works?filter=authorships.author.id:${id}&per_page=${perPage}&page=${page}&api_key=${this.apiKey}`;
    const cacheKey = `author_works:${id}:${page}:${perPage}`;

    const response = await this.fetchWithCache<OpenAlexResponse<OpenAlexWork>>(url, cacheKey, 3600);

    return {
      works: response.results,
      totalCount: response.meta.count,
      hasMore: response.meta.page * response.meta.per_page < response.meta.count,
    };
  }

  async getAllAuthorWorks(authorId: string): Promise<OpenAlexWork[]> {
    const allWorks: OpenAlexWork[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const { works, hasMore: more } = await this.getAuthorWorks(authorId, page, 100);
      allWorks.push(...works);
      hasMore = more;
      page++;

      // Safety limit to avoid excessive API calls
      if (page > 50) break;
    }

    return allWorks;
  }
}
