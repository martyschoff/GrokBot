#!/usr/bin/env python3
"""
Trade Recommendations Updater

Merges Seeking Alpha and Yahoo Finance recommendations into a canonical
recommendations.json file for S3 publication.

Usage:
    python update_recommendations.py \\
        --holdings data/holdings-5k.json \\
        --sa-ratings data/ratings-latest.json \\
        --yahoo-ratings data/yahoo-ratings.json \\
        --output recommendations.json
"""

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional


FLOOR_VALUE = 5000
EXCEPTIONS = ["ET", "JEPI"]
UNGRADED = ["VFIAX"]
BUCKET = "martin-trade"
KEY = "recommendations.json"


def load_json(path: Path) -> dict:
    """Load and parse a JSON file."""
    try:
        with open(path, 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        print(f"Error: File not found: {path}", file=sys.stderr)
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON in {path}: {e}", file=sys.stderr)
        sys.exit(1)


def build_ticker_universe(holdings_data: dict) -> set[str]:
    """
    Build the ticker universe from holdings data.
    
    Includes:
    - All holdings >= floor value
    - Exception tickers (ET, JEPI) regardless of value
    
    Excludes:
    - Ungraded tickers (VFIAX, cash, money-market)
    """
    universe = set()
    floor = holdings_data.get("floor", FLOOR_VALUE)
    
    for holding in holdings_data.get("holdings", []):
        ticker = holding.get("ticker", "").upper()
        value = holding.get("value", 0)
        
        if not ticker or ticker in UNGRADED:
            continue
        
        if value >= floor or ticker in EXCEPTIONS:
            universe.add(ticker)
    
    return universe


def load_sa_ratings(sa_path: Path) -> tuple[dict[str, dict], Optional[str]]:
    """Load Seeking Alpha ratings from file."""
    if not sa_path.exists():
        print(f"Warning: SA ratings file not found: {sa_path}", file=sys.stderr)
        return {}, None
    
    data = load_json(sa_path)
    fetched_at = data.get("fetched_at")
    
    ratings_map = {}
    for rating in data.get("ratings", []):
        ticker = rating.get("ticker", "").upper()
        if ticker:
            ratings_map[ticker] = {
                "rating": rating.get("rating") or "",
                "previous": rating.get("previous"),
                "changed_at": rating.get("changed_at"),
                "url": rating.get("url", f"https://seekingalpha.com/symbol/{ticker}")
            }
    
    return ratings_map, fetched_at


def load_yahoo_ratings(yahoo_path: Path) -> tuple[dict[str, dict], Optional[str]]:
    """Load Yahoo Finance ratings from file."""
    if not yahoo_path.exists():
        print(f"Warning: Yahoo ratings file not found: {yahoo_path}", file=sys.stderr)
        return {}, None
    
    data = load_json(yahoo_path)
    fetched_at = data.get("fetched_at")
    
    ratings_map = {}
    for rating in data.get("ratings", []):
        ticker = rating.get("ticker", "").upper()
        if ticker:
            ratings_map[ticker] = {
                "rating": rating.get("rating") or "",
                "url": rating.get("url", f"https://finance.yahoo.com/quote/{ticker}/analysis/")
            }
    
    return ratings_map, fetched_at


def build_recommendations(
    universe: set[str],
    sa_ratings: dict[str, dict],
    yahoo_ratings: dict[str, dict],
    sa_timestamp: Optional[str],
    yahoo_timestamp: Optional[str],
    universe_date: str
) -> dict:
    """Build the canonical recommendations structure."""
    tickers_list = []
    
    for ticker in sorted(universe):
        ticker_obj = {"ticker": ticker}
        
        if ticker in sa_ratings:
            ticker_obj["sa"] = sa_ratings[ticker]
        
        if ticker in yahoo_ratings:
            ticker_obj["yahoo"] = yahoo_ratings[ticker]
        
        tickers_list.append(ticker_obj)
    
    now_iso = datetime.now().astimezone().isoformat()
    
    return {
        "schema_version": 1,
        "as_of": {
            "sa": sa_timestamp or now_iso,
            "yahoo": yahoo_timestamp or now_iso,
            "universe": universe_date
        },
        "bucket": BUCKET,
        "key": KEY,
        "floor": FLOOR_VALUE,
        "exceptions": EXCEPTIONS,
        "ungraded": UNGRADED,
        "tickers": tickers_list
    }


def write_output(data: dict, output_path: str):
    """Write recommendations to output path or stdout."""
    output_json = json.dumps(data, indent=2, ensure_ascii=False)
    
    if output_path == "-":
        print(output_json)
    else:
        try:
            output_file = Path(output_path)
            output_file.parent.mkdir(parents=True, exist_ok=True)
            with open(output_file, 'w') as f:
                f.write(output_json)
                f.write('\n')
            print(f"Recommendations written to: {output_path}", file=sys.stderr)
        except Exception as e:
            print(f"Error writing output: {e}", file=sys.stderr)
            sys.exit(1)


def main():
    parser = argparse.ArgumentParser(
        description="Generate canonical trade recommendations from SA and Yahoo data"
    )
    parser.add_argument(
        "--holdings",
        type=Path,
        default=Path("./data/holdings-5k.json"),
        help="Holdings JSON file with $5k floor (default: ./data/holdings-5k.json)"
    )
    parser.add_argument(
        "--sa-ratings",
        type=Path,
        default=Path("./data/ratings-latest.json"),
        help="Seeking Alpha ratings JSON file (default: ./data/ratings-latest.json)"
    )
    parser.add_argument(
        "--yahoo-ratings",
        type=Path,
        default=Path("./data/yahoo-ratings.json"),
        help="Yahoo ratings JSON file (default: ./data/yahoo-ratings.json)"
    )
    parser.add_argument(
        "--output",
        type=str,
        default="./recommendations.json",
        help="Output path, use '-' for stdout (default: ./recommendations.json)"
    )
    
    args = parser.parse_args()
    
    print("Loading holdings data...", file=sys.stderr)
    holdings_data = load_json(args.holdings)
    universe = build_ticker_universe(holdings_data)
    universe_date = holdings_data.get("as_of", datetime.now().strftime("%Y-%m-%d"))
    
    print(f"Universe: {len(universe)} tickers", file=sys.stderr)
    
    print("Loading Seeking Alpha ratings...", file=sys.stderr)
    sa_ratings, sa_timestamp = load_sa_ratings(args.sa_ratings)
    print(f"SA ratings: {len(sa_ratings)} tickers", file=sys.stderr)
    
    print("Loading Yahoo Finance ratings...", file=sys.stderr)
    yahoo_ratings, yahoo_timestamp = load_yahoo_ratings(args.yahoo_ratings)
    print(f"Yahoo ratings: {len(yahoo_ratings)} tickers", file=sys.stderr)
    
    print("Building recommendations...", file=sys.stderr)
    recommendations = build_recommendations(
        universe,
        sa_ratings,
        yahoo_ratings,
        sa_timestamp,
        yahoo_timestamp,
        universe_date
    )
    
    print("Writing output...", file=sys.stderr)
    write_output(recommendations, args.output)
    
    print("Done!", file=sys.stderr)


if __name__ == "__main__":
    main()
