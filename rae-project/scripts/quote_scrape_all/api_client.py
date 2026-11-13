"""
quotes.toscrape.com Infinite Scroll API Client
===============================================
Fetches all quotes (text, author, tags) from the infinite-scroll page at
https://quotes.toscrape.com/scroll by calling the JSON API it uses internally.

API endpoint:  GET /api/quotes?page=<n>
No authentication required — the site is a public web-scraping sandbox.
"""

import time
from typing import Any

import requests


# ---------------------------------------------------------------------------
# Session setup
# ---------------------------------------------------------------------------

BASE_URL = "https://quotes.toscrape.com"

SESSION = requests.Session()
SESSION.headers.update(
    {
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": f"{BASE_URL}/scroll",
        "X-Requested-With": "XMLHttpRequest",
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        ),
    }
)


# ---------------------------------------------------------------------------
# API functions
# ---------------------------------------------------------------------------


def fetch_quotes_page(page: int) -> dict[str, Any]:
    """Fetch a single page of quotes from the JSON API.

    Args:
        page: 1-based page number.

    Returns:
        Parsed JSON response dict with keys:
            - ``has_next`` (bool): whether more pages exist.
            - ``page`` (int): current page number.
            - ``quotes`` (list[dict]): list of quote objects.

    Raises:
        requests.HTTPError: on non-2xx responses.
    """
    url = f"{BASE_URL}/api/quotes"
    response = SESSION.get(url, params={"page": page}, timeout=15)
    response.raise_for_status()
    return response.json()


def fetch_all_quotes(delay: float = 0.5) -> list[dict[str, Any]]:
    """Fetch every quote from every page of the infinite-scroll feed.

    Walks pages until ``has_next`` is ``False``, collecting all quotes.

    Args:
        delay: seconds to wait between requests (polite crawling).

    Returns:
        A flat list of quote dicts, each containing::

            {
                "text":   str,       # the quote text (with curly quotes)
                "author": str,       # author's display name
                "tags":   list[str], # list of tag strings
            }
    """
    all_quotes: list[dict[str, Any]] = []
    page = 1

    while True:
        print(f"  Fetching page {page} …", end=" ", flush=True)
        data = fetch_quotes_page(page)

        raw_quotes = data.get("quotes", [])
        for q in raw_quotes:
            all_quotes.append(
                {
                    "text": q.get("text", ""),
                    "author": q.get("author", {}).get("name", ""),
                    "tags": q.get("tags", []),
                }
            )

        print(f"got {len(raw_quotes)} quotes (total so far: {len(all_quotes)})")

        if not data.get("has_next", False):
            break

        page += 1
        if delay:
            time.sleep(delay)

    return all_quotes


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> None:
    """Fetch all quotes and print a summary."""
    print("Fetching all quotes from quotes.toscrape.com/scroll …\n")

    quotes = fetch_all_quotes(delay=0.3)

    print(f"\n{'=' * 60}")
    print(f"Total quotes fetched: {len(quotes)}")
    print(f"{'=' * 60}\n")

    # Print the first 5 as a sample
    print("Sample (first 5 quotes):\n")
    for i, q in enumerate(quotes[:5], start=1):
        tags = ", ".join(q["tags"]) if q["tags"] else "(none)"
        print(f"{i}. {q['text']}")
        print(f"   — {q['author']}")
        print(f"   Tags: {tags}")
        print()

    # Quick statistics
    unique_authors = {q["author"] for q in quotes}
    all_tags = [tag for q in quotes for tag in q["tags"]]
    unique_tags = set(all_tags)

    print(f"Unique authors : {len(unique_authors)}")
    print(f"Unique tags    : {len(unique_tags)}")
    print(f"Total tag uses : {len(all_tags)}")


if __name__ == "__main__":
    main()
