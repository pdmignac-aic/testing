"""Search API abstraction layer. Supports Google Custom Search, SerpAPI, Brave Search, and DuckDuckGo."""

import httpx
import asyncio
import random
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

    Includes retry with exponential backoff to handle rate limiting.
    Uses asyncio.to_thread to avoid blocking the event loop.
    """

    MAX_RETRIES = 3

    def _search_sync(self, query: str, num_results: int) -> list[dict]:
        """Run DDG search synchronously (called via to_thread)."""
        from ddgs import DDGS
        ddgs = DDGS()
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

    async def search(self, query: str, num_results: int = 5) -> list[dict]:
        for attempt in range(self.MAX_RETRIES):
            try:
                return await asyncio.to_thread(self._search_sync, query, num_results)
            except Exception as e:
                if attempt < self.MAX_RETRIES - 1:
                    wait = (attempt + 1) * 8  # 8s, 16s, 24s
                    logger.warning(f"DuckDuckGo search failed (attempt {attempt + 1}): {e} — retrying in {wait}s")
                    await asyncio.sleep(wait)
                    continue
                logger.error(f"DuckDuckGo search error after {self.MAX_RETRIES} attempts: {e}")
                return []
        return []


class MockSearchProvider(SearchProvider):
    """Fallback mock provider when no search works."""

    async def search(self, query: str, num_results: int = 5) -> list[dict]:
        logger.info(f"Mock search (no search provider available): {query}")
        return []


def get_search_provider() -> SearchProvider:
    """Factory to get the configured search provider."""
    provider = settings.SEARCH_API_PROVIDER.lower()
    if provider == "google" and settings.GOOGLE_API_KEY:
        return GoogleSearchProvider()
    elif provider == "serpapi" and settings.SERPAPI_KEY:
        return SerpAPIProvider()
    elif provider == "brave" and settings.BRAVE_API_KEY:
        return BraveSearchProvider()
    elif provider == "duckduckgo":
        return DuckDuckGoSearchProvider()

    # Auto-detect based on available keys
    if settings.GOOGLE_API_KEY and settings.GOOGLE_CSE_ID:
        return GoogleSearchProvider()
    if settings.SERPAPI_KEY:
        return SerpAPIProvider()
    if settings.BRAVE_API_KEY:
        return BraveSearchProvider()

    # Default to DuckDuckGo — free, no API key needed
    logger.info("No search API keys configured — using DuckDuckGo (free, no key required)")
    return DuckDuckGoSearchProvider()


async def rate_limited_delay():
    """Add a random delay between requests for rate limiting."""
    delay = random.uniform(settings.REQUEST_DELAY_MIN, settings.REQUEST_DELAY_MAX)
    await asyncio.sleep(delay)
