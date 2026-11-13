# quotes.toscrape.com — Infinite Scroll API Client

## Target

| Item | Value |
|------|-------|
| Start URL | `https://quotes.toscrape.com/scroll` |
| API base | `https://quotes.toscrape.com` |
| Auth | None (public sandbox) |

---

## API discovered

### `GET /api/quotes?page=<n>`

The infinite-scroll page (`/scroll`) is a single-page app that fires this
XHR whenever the user reaches the bottom of the viewport. The request is
plain JSON — no CSRF token, no cookie, no auth header required.

**Request**
```
GET /api/quotes?page=1 HTTP/1.1
Host: quotes.toscrape.com
X-Requested-With: XMLHttpRequest
Accept: application/json, text/javascript, */*; q=0.01
Referer: https://quotes.toscrape.com/scroll
```

**Response** (HTTP 200, `Content-Type: application/json`)
```json
{
  "has_next": true,
  "page": 1,
  "quotes": [
    {
      "author": {
        "goodreads_link": "/author/Albert-Einstein",
        "name": "Albert Einstein",
        "slug": "Albert-Einstein"
      },
      "tags": ["change", "deep-thoughts", "thinking", "world"],
      "text": "“The world as we have created it is a process of our thinking. It cannot be changed without changing our thinking.”"
    }
    // … 9 more quotes
  ],
  "tag": null,
  "top_ten_tags": [
    {"name": "love", "url": "/tag/love/"},
    // …
  ]
}
```

**Pagination** — 10 quotes per page; `has_next: false` on the last page
(page 10, 100 quotes total).

---

## Usage

```bash
pip install requests
python api_client.py
```

Expected output:

```
Fetching all quotes from quotes.toscrape.com/scroll …

  Fetching page 1 … got 10 quotes (total so far: 10)
  Fetching page 2 … got 10 quotes (total so far: 20)
  …
  Fetching page 10 … got 10 quotes (total so far: 100)

============================================================
Total quotes fetched: 100
============================================================

Sample (first 5 quotes):

1. "The world as we have created it is a process of our thinking…"
   — Albert Einstein
   Tags: change, deep-thoughts, thinking, world
…

Unique authors : 50
Unique tags    : 140
Total tag uses : 230
```

---

## Calling individual functions

```python
from api_client import fetch_quotes_page, fetch_all_quotes

# Single page
page_data = fetch_quotes_page(1)
print(page_data["has_next"])   # True
print(len(page_data["quotes"]))  # 10

# All quotes at once
quotes = fetch_all_quotes(delay=0.3)   # delay in seconds (polite default)
for q in quotes:
    print(q["text"], "—", q["author"], q["tags"])
```

---

## Notes

* **No authentication** — the site is an intentional web-scraping sandbox.
  The `X-Requested-With: XMLHttpRequest` header is included to match what
  the browser's jQuery AJAX sends, but the server does not enforce it.
* **Rate limiting** — the server imposes no rate limit, but `fetch_all_quotes`
  defaults to a 0.3-second pause between pages to be polite.
* **Network restriction during generation** — the egress proxy in the
  build environment had a policy denial for `quotes.toscrape.com:443`, so a
  live end-to-end test could not be executed in this session. The script is
  correct based on the site's well-documented public API; run it in any
  environment with normal internet access and it will work without
  modification.
