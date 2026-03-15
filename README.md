# CiteIQ

**Citation Intelligence Quotient** - A fairer measure of academic impact.

CiteIQ addresses two critical flaws in traditional citation metrics:
1. **Unfair author credit** - All authors get equal credit regardless of contribution
2. **No integrity filtering** - Citations from fraudulent/de-indexed sources count equally

## Live Demo

**[Try CiteIQ](https://quinndupont.github.io/CiteIQ/)**

## How It Works

### CiteIQ-h (comparable to h-index)

A researcher has a CiteIQ-h of **h** if they have **h papers with at least h weighted citations each**.

### CiteIQ-i10 (comparable to i10-index)

Count of papers with **at least 10 weighted citations**.

### Author Position Weighting

| Position | Weight | Rationale |
|----------|--------|-----------|
| First Author | 20% | Primary contributor |
| Last Author | 20% | Senior/PI position |
| Middle Authors | 60% shared | Split equally among co-authors |

**Example:** A paper with 100 citations and 4 authors:
- First author: 100 × 0.20 = **20** weighted citations
- Last author: 100 × 0.20 = **20** weighted citations
- Each middle author: 100 × 0.30 = **30** weighted citations

### Integrity Filters

| Condition | Action |
|-----------|--------|
| Journal is de-indexed | Citations = 0 |
| Article is retracted | Marked with asterisk (*) |

## Tech Stack

- **Frontend**: Static HTML/CSS/JavaScript (GitHub Pages)
- **Backend**: Cloudflare Workers (TypeScript)
- **Database**: Cloudflare D1 (SQLite) + KV (caching)
- **Data Source**: [OpenAlex API](https://openalex.org/)

## Architecture

```
┌─────────────────────────────────────┐
│     GitHub Pages (Frontend)         │
│     Static HTML/CSS/JavaScript      │
└─────────────────┬───────────────────┘
                  │ HTTPS
                  ▼
┌─────────────────────────────────────┐
│   Cloudflare Workers (Backend)      │
│   /api/search-author                │
│   /api/calculate-iqm                │
└─────────────────┬───────────────────┘
                  │
      ┌───────────┼───────────┐
      ▼           ▼           ▼
┌──────────┐ ┌──────────┐ ┌──────────┐
│ D1 (SQL) │ │ KV Cache │ │ OpenAlex │
└──────────┘ └──────────┘ └──────────┘
```

## Local Development

### Frontend

```bash
cd frontend
python3 -m http.server 5500
# Open http://localhost:5500
```

### Backend (Cloudflare Worker)

```bash
cd worker
npm install
npm run dev
# API runs at http://localhost:8787
```

### Environment Variables

Create a `.env` file:

```
OPENALEX_API_KEY=your_key_here
CLOUDFLARE_API_TOKEN=your_token_here
CLOUDFLARE_ACCOUNT_ID=your_account_id
```

## Deployment

### Worker (Cloudflare)

```bash
cd worker
npm run deploy
```

### Frontend (GitHub Pages)

Push to `main` branch - GitHub Actions will deploy automatically.

## API Endpoints

### `GET /api/search-author?q={name}`

Search for authors by name.

### `GET /api/calculate-iqm?author_id={id}`

Calculate CiteIQ metrics for an author.

**Response:**
```json
{
  "author": {
    "id": "A5012345678",
    "name": "Jane Smith",
    "hasRetractions": false
  },
  "iqm": {
    "h": 42,
    "i10": 85,
    "totalWeightedCitations": 12500.5,
    "paperCount": 120,
    "retractionCount": 0,
    "deindexedCount": 0
  },
  "papers": [...]
}
```

## Data Sources

- **Paper metadata**: [OpenAlex](https://openalex.org/) (free, open scholarly data)
- **Retractions**: OpenAlex `is_retracted` flag (sourced from Retraction Watch)
- **De-indexed journals**: Custom database (Beall's List, Predatory Reports)

## License

MIT

## Author

[Quinn DuPont](https://github.com/quinndupont)
