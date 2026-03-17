# Manufacturer Relationship Mapper

A full-stack web application that enriches manufacturer data with relationship intelligence — Economic Development Councils, major customers, and trade associations — to help BD teams build warm intro pathways.

## Architecture

```
┌─────────────────────────────────┐
│     React + TypeScript Frontend │
│     (Vite, Tailwind, TanStack)  │
├─────────────────────────────────┤
│         FastAPI Backend          │
│    ┌──────────┬──────────┬─────┐│
│    │ EDC      │ Customer │Trade││
│    │ Lookup   │ Lookup   │Assoc││
│    └──────────┴──────────┴─────┘│
│    Search API  │  Web Scraper   │
├─────────────────────────────────┤
│        SQLite Database           │
│   (manufacturers + cache)        │
└─────────────────────────────────┘
```

### Enrichment Tracks

1. **Track A: EDC Lookup** — Finds the local Economic Development Council for each manufacturer's geography, scrapes contact info (director name, email, phone)
2. **Track B: Major Customers** — Scrapes manufacturer websites and searches news/press releases for named customers, checks USASpending for government contracts
3. **Track C: Trade Associations** — Identifies confirmed memberships (*) and relevant associations (REL) based on sector inference

## Tech Stack

- **Frontend**: React 18 + TypeScript, Vite, Tailwind CSS, TanStack Table
- **Backend**: Python 3.11+, FastAPI, httpx, BeautifulSoup4, lxml
- **Database**: SQLite (via aiosqlite)
- **Search API**: Google Custom Search, SerpAPI, or Brave Search (configurable)

## Setup Instructions

### Prerequisites

- Node.js 18+
- Python 3.11+

### Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Configure environment variables (see below)
python main.py
```

The backend runs on `http://localhost:8000`.

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The frontend runs on `http://localhost:5173` and proxies `/api` to the backend.

## Required API Keys

Set these as environment variables before starting the backend:

| Variable | Description | Required |
|----------|-------------|----------|
| `SEARCH_API_PROVIDER` | `google`, `serpapi`, or `brave` | No (auto-detects) |
| `GOOGLE_API_KEY` | Google Custom Search API key | If using Google |
| `GOOGLE_CSE_ID` | Google Custom Search Engine ID | If using Google |
| `SERPAPI_KEY` | SerpAPI API key | If using SerpAPI |
| `BRAVE_API_KEY` | Brave Search API key | If using Brave |

At least one search API must be configured for enrichment to return results. Without API keys, the application will still function but enrichment results will be limited to direct website scraping.

### Getting API Keys

- **Google Custom Search**: [Get API Key](https://developers.google.com/custom-search/v1/overview), [Create CSE](https://programmablesearchengine.google.com/)
- **SerpAPI**: [Get API Key](https://serpapi.com/)
- **Brave Search**: [Get API Key](https://brave.com/search/api/)

## Rate Limit Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `REQUEST_DELAY_MIN` | `1.0` | Minimum seconds between requests |
| `REQUEST_DELAY_MAX` | `2.0` | Maximum seconds between requests |
| `MAX_CONCURRENT` | `5` | Max manufacturers processed in parallel |

## Usage

1. **Upload CSV** — Drag and drop a CSV file with columns: `company_name`, `address`, `website`
2. **Preview** — Review the parsed data (first 10 rows shown)
3. **Enrich** — Click "Enrich All" to start the pipeline, or enrich individual rows
4. **Monitor** — Watch real-time progress with status indicators per row
5. **Export** — Download the enriched data as CSV

### CSV Format

```csv
company_name,address,website
Apex Precision Machining,"1234 Industrial Dr, Canton, OH 44707",apexprecision.com
Heartland Metal Fabrication,"890 Commerce Pkwy, Elkhart, IN 46516",heartlandmetalfab.com
```

### Status Indicators

| Icon | Status | Meaning |
|------|--------|---------|
| ⏳ | Pending | Not yet processed |
| 🔄 | Processing | Currently being enriched |
| ✅ | Complete | All tracks succeeded |
| ⚠️ | Partial | Some tracks failed |
| ❌ | Failed | All tracks failed |

### Trade Association Markers

- `*NTMA` — Confirmed membership (found on website, directory, or exhibitor list)
- `REL — AMT` — Relevant association (matches industry sector but no direct evidence)

## Caching

Enrichment results are cached in SQLite keyed on `company_name + address`. Re-running enrichment on the same records will use cached data instead of re-scraping. To clear the cache, delete the `enrichment.db` file.

## Production Considerations

- Replace SQLite with PostgreSQL for concurrent multi-user access
- Add authentication for API key management
- Deploy behind a reverse proxy (nginx) with the React build served as static files
- Consider adding Playwright for JS-rendered pages (currently uses httpx for static pages)
- Add webhook/email notifications for batch completion
