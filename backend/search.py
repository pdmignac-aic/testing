"""Search API abstraction layer. Supports Google Custom Search, SerpAPI, Brave Search, and DuckDuckGo."""

import httpx
import asyncio
import random
import time
import logging
from config import settings

logger = logging.getLogger(__name__)


class SearchProvider:
    """Base search provider interface."""

    async def search(self, query: str, num_results: int = 5) -> list[dict]:
        """Returns list of {title, url, snippet}."""
        raise NotImplementedError


class GoogleSearchProvider(SearchProvider):
    """Google Custom Search JSON API."""

    def __init__(self):
        self.api_key = settings.GOOGLE_API_KEY
        self.cse_id = settings.GOOGLE_CSE_ID

    async def search(self, query: str, num_results: int = 5) -> list[dict]:
        if not self.api_key or not self.cse_id:
            logger.warning("Google API key or CSE ID not configured")
            return []
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                "https://www.googleapis.com/customsearch/v1",
                params={
                    "key": self.api_key,
                    "cx": self.cse_id,
                    "q": query,
                    "num": min(num_results, 10),
                },
            )
            if resp.status_code != 200:
                logger.error(f"Google search error: {resp.status_code} {resp.text[:200]}")
                return []
            data = resp.json()
            results = []
            for item in data.get("items", []):
                results.append(
                    {
                        "title": item.get("title", ""),
                        "url": item.get("link", ""),
                        "snippet": item.get("snippet", ""),
                    }
                )
            return results


class SerpAPIProvider(SearchProvider):
    """SerpAPI search provider."""

    def __init__(self):
        self.api_key = settings.SERPAPI_KEY

    async def search(self, query: str, num_results: int = 5) -> list[dict]:
        if not self.api_key:
            logger.warning("SerpAPI key not configured")
            return []
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                "https://serpapi.com/search",
                params={
                    "api_key": self.api_key,
                    "q": query,
                    "num": min(num_results, 10),
                    "engine": "google",
                },
            )
            if resp.status_code != 200:
                logger.error(f"SerpAPI error: {resp.status_code}")
                return []
            data = resp.json()
            results = []
            for item in data.get("organic_results", []):
                results.append(
                    {
                        "title": item.get("title", ""),
                        "url": item.get("link", ""),
                        "snippet": item.get("snippet", ""),
                    }
                )
            return results


class BraveSearchProvider(SearchProvider):
    """Brave Search API provider."""

    def __init__(self):
        self.api_key = settings.BRAVE_API_KEY

    async def search(self, query: str, num_results: int = 5) -> list[dict]:
        if not self.api_key:
            logger.warning("Brave API key not configured")
            return []
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                "https://api.search.brave.com/res/v1/web/search",
                headers={"X-Subscription-Token": self.api_key},
                params={"q": query, "count": min(num_results, 20)},
            )
            if resp.status_code != 200:
                logger.error(f"Brave search error: {resp.status_code}")
                return []
            data = resp.json()
            results = []
            for item in data.get("web", {}).get("results", []):
                results.append(
                    {
                        "title": item.get("title", ""),
                        "url": item.get("url", ""),
                        "snippet": item.get("description", ""),
                    }
                )
            return results


class DuckDuckGoSearchProvider(SearchProvider):
    """DuckDuckGo search provider — free, no API key required.

    Uses a global rate limiter to avoid 403 Ratelimit errors.
    Falls back to HTML scraping when the API is blocked.
    """

    MAX_RETRIES = 3
    # Global cooldown tracking shared across all instances
    _last_success: float = 0
    _consecutive_failures: int = 0
    _cooldown_until: float = 0
    _lock = None  # initialized lazily

    @classmethod
    def _get_lock(cls):
        if cls._lock is None:
            cls._lock = asyncio.Lock()
        return cls._lock

    def _search_sync(self, query: str, num_results: int) -> list[dict]:
        """Run DDG search synchronously (called via to_thread)."""
        from ddgs import DDGS
        ddgs = DDGS(timeout=20)
        raw_results = ddgs.text(query, max_results=num_results)
        results = []
        for item in raw_results:
            results.append(
                {
                    "title": item.get("title", ""),
                    "url": item.get("href", ""),
                    "snippet": item.get("body", ""),
                }
            )
        return results

    async def _search_html_fallback(self, query: str, num_results: int) -> list[dict]:
        """Fallback: scrape DuckDuckGo HTML directly when the API is rate-limited."""
        from urllib.parse import quote_plus
        url = f"https://html.duckduckgo.com/html/?q={quote_plus(query)}"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
        try:
            async with httpx.AsyncClient(timeout=20, follow_redirects=True) as client:
                resp = await client.get(url, headers=headers)
                if resp.status_code != 200:
                    return []

            from bs4 import BeautifulSoup
            soup = BeautifulSoup(resp.text, "lxml")
            results = []
            for result_div in soup.select(".result"):
                title_tag = result_div.select_one(".result__title a, .result__a")
                snippet_tag = result_div.select_one(".result__snippet")
                if not title_tag:
                    continue
                href = title_tag.get("href", "")
                if "uddg=" in href:
                    from urllib.parse import unquote, parse_qs, urlparse
                    parsed = urlparse(href)
                    qs = parse_qs(parsed.query)
                    href = unquote(qs.get("uddg", [href])[0])
                results.append({
                    "title": title_tag.get_text(strip=True),
                    "url": href,
                    "snippet": snippet_tag.get_text(strip=True) if snippet_tag else "",
                })
                if len(results) >= num_results:
                    break
            return results
        except Exception as e:
            logger.warning(f"DDG HTML fallback failed: {e}")
            return []

    async def search(self, query: str, num_results: int = 5) -> list[dict]:
        lock = self._get_lock()

        async with lock:
            # Wait for cooldown if active
            now = time.monotonic()
            if now < DuckDuckGoSearchProvider._cooldown_until:
                wait = DuckDuckGoSearchProvider._cooldown_until - now
                logger.info(f"DDG rate-limit cooldown: waiting {wait:.0f}s")
                await asyncio.sleep(wait)

        for attempt in range(self.MAX_RETRIES):
            try:
                results = await asyncio.to_thread(self._search_sync, query, num_results)
                # Success — reset failure counter
                DuckDuckGoSearchProvider._consecutive_failures = 0
                DuckDuckGoSearchProvider._last_success = time.monotonic()
                return results
            except Exception as e:
                err_str = str(e).lower()
                is_ratelimit = "ratelimit" in err_str or "403" in err_str

                if is_ratelimit:
                    DuckDuckGoSearchProvider._consecutive_failures += 1
                    # Exponential backoff: 10s, 30s, 60s
                    cooldown = min(10 * (2 ** DuckDuckGoSearchProvider._consecutive_failures), 60)
                    DuckDuckGoSearchProvider._cooldown_until = time.monotonic() + cooldown
                    logger.warning(f"DDG rate-limited (attempt {attempt + 1}), cooling down {cooldown}s")
                    await asyncio.sleep(cooldown)
                    continue

                wait = 3 * (attempt + 1)
                if attempt < self.MAX_RETRIES - 1:
                    logger.warning(f"DDG search failed (attempt {attempt + 1}): {e} — retrying in {wait}s")
                    await asyncio.sleep(wait)
                    continue

                logger.error(f"DDG search error after {self.MAX_RETRIES} attempts: {e}")
                return []

        # All retries exhausted — try HTML fallback as last resort
        logger.info("DDG API exhausted, trying HTML fallback...")
        return await self._search_html_fallback(query, num_results)


class MockSearchProvider(SearchProvider):
    """Fallback mock provider when no search works."""

    async def search(self, query: str, num_results: int = 5) -> list[dict]:
        logger.info(f"Mock search (no search provider available): {query}")
        return []


# Module-level singleton to avoid recreating on every call
_search_provider: SearchProvider | None = None


def get_search_provider() -> SearchProvider:
    """Factory to get the configured search provider (singleton)."""
    global _search_provider
    if _search_provider is not None:
        return _search_provider

    provider = settings.SEARCH_API_PROVIDER.lower()
    if provider == "google" and settings.GOOGLE_API_KEY:
        _search_provider = GoogleSearchProvider()
    elif provider == "serpapi" and settings.SERPAPI_KEY:
        _search_provider = SerpAPIProvider()
    elif provider == "brave" and settings.BRAVE_API_KEY:
        _search_provider = BraveSearchProvider()
    elif provider == "duckduckgo":
        _search_provider = DuckDuckGoSearchProvider()

    if _search_provider is None:
        # Auto-detect based on available keys
        if settings.GOOGLE_API_KEY and settings.GOOGLE_CSE_ID:
            _search_provider = GoogleSearchProvider()
        elif settings.SERPAPI_KEY:
            _search_provider = SerpAPIProvider()
        elif settings.BRAVE_API_KEY:
            _search_provider = BraveSearchProvider()
        else:
            # Default to DuckDuckGo — free, no API key needed
            logger.info("No search API keys configured — using DuckDuckGo (free, no key required)")
            _search_provider = DuckDuckGoSearchProvider()

    return _search_provider


async def rate_limited_delay():
    """Add a random delay between requests for rate limiting."""
    delay = random.uniform(settings.REQUEST_DELAY_MIN, settings.REQUEST_DELAY_MAX)
    await asyncio.sleep(delay)
