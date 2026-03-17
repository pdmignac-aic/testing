"""Search API abstraction layer. Supports Google Custom Search, SerpAPI, and Brave Search."""

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


class MockSearchProvider(SearchProvider):
    """Fallback mock provider when no API keys are configured."""

    async def search(self, query: str, num_results: int = 5) -> list[dict]:
        logger.info(f"Mock search (no API keys configured): {query}")
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

    # Auto-detect based on available keys
    if settings.GOOGLE_API_KEY and settings.GOOGLE_CSE_ID:
        return GoogleSearchProvider()
    if settings.SERPAPI_KEY:
        return SerpAPIProvider()
    if settings.BRAVE_API_KEY:
        return BraveSearchProvider()

    logger.warning("No search API keys configured — using mock provider")
    return MockSearchProvider()


async def rate_limited_delay():
    """Add a random delay between requests for rate limiting."""
    delay = random.uniform(settings.REQUEST_DELAY_MIN, settings.REQUEST_DELAY_MAX)
    await asyncio.sleep(delay)
