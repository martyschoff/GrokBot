# Art Interpretation Data

This directory contains art interpretation indexes for the nt4me2 player.

## Files

### interpretations.json
Academic art interpretation index. Maps picture basenames to interpretation metadata.

**Format:**
```json
{
  "picture-basename.jpg": {
    "status": "approved",
    "card": "relative/path/to/card.json"
  }
}
```

**Status values:**
- `"approved"` - card is ready for display

**Example:**
```json
{
  "prodigal-son-rembrandt-hermitage.jpg": {
    "status": "approved",
    "card": "academic/prodigal-rembrandt-card.json"
  }
}
```

### religious-interpretations.json
Religious art interpretation index (mounted separately). Uses the same schema as `interpretations.json`.

**Status values:**
- `"approved"` - card is ready for display

**Example:**
```json
{
  "prodigal-son-rembrandt-hermitage.jpg": {
    "status": "approved",
    "card": "religious/prodigal-rembrandt-card.json"
  },
  "adoration-magi-geertgen-rijksmuseum.jpg": {
    "status": "approved",
    "card": "religious/adoration-magi-card.json"
  }
}
```

## Card Format

Card JSON files use the following schema:

```json
{
  "status": "approved",
  "sources_header": [
    "Source 1",
    "Source 2"
  ],
  "body": "Interpretation text here...\n\nSecond paragraph...",
  "citations": [
    {
      "author": "Author Name",
      "title": "Work Title",
      "publication": "Publication Name",
      "date": "Year",
      "url": "https://example.com"
    }
  ]
}
```

## Pilot Religious Cards

Three religious interpretation pilots are documented:
- `rembrandt-return-prodigal` — Luke 15 — picture: `prodigal-son-rembrandt-hermitage.jpg`
- `adoration-magi-amsterdam` — Matthew 2 — picture: `adoration-magi-geertgen-rijksmuseum.jpg`
- `rembrandt-supper-emmaus` — Luke 24 — picture: (may require addition to pictures.json)

When Kimberly mounts live data:
1. Upload religious-interpretations.json to this directory
2. Upload card JSON files to the appropriate subdirectories
3. Ensure picture basenames match those in the player's pictures.json
4. Verify interpretation mode toggle shows green/approves correct cards

## Loading Behavior

- **Academic mode:** Loads from `interpretations.json`
- **Religious mode:** Loads from `religious-interpretations.json` (graceful no-op if missing)
- **Mode switching:** Updates button label and re-renders card if interpretation bubble is open
- **Card caching:** Cleared when mode switches; loaded on-demand when interpretation opened
