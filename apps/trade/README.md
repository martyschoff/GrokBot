# Trade Recommendations

Unified Seeking Alpha grades and Yahoo Finance analyst recommendations for Martin's portfolio, delivered via a canonical `recommendations.json` file on AWS S3.

## S3 Configuration

**Bucket:** `martin-trade` (us-east-1, public GetObject / static website hosting)

**Key:** `recommendations.json` (bucket root)

**Public URLs:**
- **HTTP (static website):** `http://martin-trade.s3-website-us-east-1.amazonaws.com/recommendations.json`
- **HTTPS (object URL):** `https://martin-trade.s3.us-east-1.amazonaws.com/recommendations.json`

## Schema

The canonical schema is defined in `recommendations.schema.json`. See `fixtures/recommendations.example.json` for a complete example.

### Key Fields

- `schema_version`: Currently `1`
- `as_of`: Timestamps for SA, Yahoo, and universe data sources
- `bucket`, `key`: S3 location metadata
- `floor`: Minimum holding value ($5000) for inclusion
- `exceptions`: Tickers always included (ET, JEPI)
- `ungraded`: Tickers excluded from rating (VFIAX, cash, money-market)
- `tickers`: Array of ticker objects with SA and Yahoo ratings

### Ticker Object

```json
{
  "ticker": "IAU",
  "sa": {
    "rating": "Buy",
    "previous": null,
    "changed_at": null,
    "url": "https://seekingalpha.com/symbol/IAU"
  },
  "yahoo": {
    "rating": "",
    "url": "https://finance.yahoo.com/quote/IAU/analysis/"
  }
}
```

**Rating values:** Empty string or null when unavailable. Never invent ratings.

## Updater Script

### Usage

```bash
python scripts/update_recommendations.py \
  --holdings data/holdings-5k.json \
  --sa-ratings path/to/ratings-latest.json \
  --yahoo-ratings path/to/yahoo-ratings.json \
  --output recommendations.json
```

### Arguments

- `--holdings`: Holdings JSON file with $5k floor (default: `./data/holdings-5k.json`)
- `--sa-ratings`: Seeking Alpha ratings JSON file (default: `./data/ratings-latest.json`)
- `--yahoo-ratings`: Yahoo ratings JSON file (default: `./data/yahoo-ratings.json`)
- `--output`: Output path, use `-` for stdout (default: `./recommendations.json`)

### Input Formats

**Holdings** (`holdings-5k.json`):
```json
{
  "as_of": "2026-08-16",
  "floor": 5000,
  "count": 15,
  "holdings": [
    {"ticker": "IAU", "value": 12500.00}
  ]
}
```

**Seeking Alpha** (`ratings-latest.json`):
```json
{
  "fetched_at": "2026-08-17T08:35:56-04:00",
  "source": "Seeking Alpha",
  "portfolio_id": "65102829",
  "ratings": [
    {"ticker": "IAU", "rating": "Buy", "previous": null, "changed_at": null, "url": "https://seekingalpha.com/symbol/IAU"}
  ]
}
```

**Yahoo** (`yahoo-ratings.json`):
```json
{
  "owner": "daniel",
  "source": "Yahoo Finance",
  "fetched_at": "2026-08-21T16:00:00-04:00",
  "ratings": [
    {"ticker": "IAU", "rating": "", "url": "https://finance.yahoo.com/quote/IAU/analysis/"}
  ]
}
```

### Notes

- **Seeking Alpha scraping:** SA live scrape is blocked by PerimeterX in cloud environments. Kimberly's SA pull can provide the SA input file offline.
- **Yahoo fetching:** The updater attempts to fetch Yahoo analyst recommendations via public Yahoo Finance endpoints. If fetch fails, it falls back to reading from `--yahoo-ratings` file or omits Yahoo data.
- **Ungraded tickers:** VFIAX, cash, and money-market positions are excluded from rating output (not included in recommendations).
- **Exceptions:** ET and JEPI are always included even if below the $5k floor.

## Deployment Workflow (Kimberly)

1. Run updater locally to generate `recommendations.json`
2. Upload to S3:
   ```bash
   aws s3 cp recommendations.json s3://martin-trade/recommendations.json --acl public-read
   ```
3. Verify public access:
   ```bash
   curl http://martin-trade.s3-website-us-east-1.amazonaws.com/recommendations.json
   ```

## Trade Board

The trade board (`index.html`) displays recommendations loaded from the configured public S3 URL.

### Environment Variable

Set `TRADE_RECOMMENDATIONS_URL` to override the default URL:

```bash
export TRADE_RECOMMENDATIONS_URL="http://martin-trade.s3-website-us-east-1.amazonaws.com/recommendations.json"
```

If the URL fetch fails, the board falls back to a local file.

### Running Locally

Open `index.html` in a browser or serve via Python:

```bash
python3 -m http.server 8000
# Visit http://localhost:8000
```

## Cadence

- **Future:** Daily at 8:30 AM ET (automated)
- **Current:** On-demand via updater script

## Constraints

- No AWS operations from this repository (Kimberly manages S3)
- No invented prices or ratings
- No trade execution
- $5k+ holdings filter with ET/JEPI exceptions
- VFIAX/cash/money-market remain ungraded
