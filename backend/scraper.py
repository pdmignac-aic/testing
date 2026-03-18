"""Web scraping utilities with rate limiting and error handling."""

import httpx
import asyncio
import logging
import re
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse

logger = logging.getLogger(__name__)

# Common user agent to avoid basic bot detection
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)


async def fetch_page(url: str, timeout: float = 15.0, retries: int = 2) -> str | None:
    """Fetch a page with retries and exponential backoff."""
    headers = {"User-Agent": USER_AGENT}
    for attempt in range(retries + 1):
        try:
            async with httpx.AsyncClient(
                timeout=timeout, follow_redirects=True, headers=headers
            ) as client:
                resp = await client.get(url)
                if resp.status_code == 200:
                    return resp.text
                logger.warning(f"HTTP {resp.status_code} for {url}")
        except (httpx.TimeoutException, httpx.ConnectError, httpx.ReadError, httpx.ProxyError, httpx.HTTPStatusError) as e:
            logger.warning(f"Fetch attempt {attempt + 1} failed for {url}: {e}")
        if attempt < retries:
            await asyncio.sleep(2 ** attempt)
    return None


def parse_html(html: str) -> BeautifulSoup:
    """Parse HTML content."""
    return BeautifulSoup(html, "lxml")


def extract_text(soup: BeautifulSoup) -> str:
    """Extract visible text from parsed HTML."""
    for tag in soup(["script", "style", "nav", "footer", "header"]):
        tag.decompose()
    return soup.get_text(separator=" ", strip=True)


def find_links(soup: BeautifulSoup, base_url: str, patterns: list[str]) -> list[str]:
    """Find links matching given text patterns."""
    results = []
    for a_tag in soup.find_all("a", href=True):
        text = a_tag.get_text(strip=True).lower()
        href = a_tag["href"]
        for pattern in patterns:
            if pattern.lower() in text:
                full_url = urljoin(base_url, href)
                results.append(full_url)
                break
    return results


def extract_emails(text: str) -> list[str]:
    """Extract email addresses from text."""
    pattern = r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}"
    return list(set(re.findall(pattern, text)))


def extract_phones(text: str) -> list[str]:
    """Extract US phone numbers from text."""
    pattern = r"[\(]?\d{3}[\)]?[\s.\-]?\d{3}[\s.\-]?\d{4}"
    return list(set(re.findall(pattern, text)))


def extract_contact_name(text: str, title_keywords: list[str] | None = None) -> str | None:
    """Try to extract a contact name near a title keyword."""
    if title_keywords is None:
        title_keywords = [
            "executive director",
            "president",
            "ceo",
            "director",
            "chairman",
            "chief executive",
        ]
    lines = text.split("\n")
    for i, line in enumerate(lines):
        line_lower = line.lower().strip()
        for keyword in title_keywords:
            if keyword in line_lower:
                # Check this line and adjacent lines for a name
                candidates = []
                if i > 0:
                    candidates.append(lines[i - 1].strip())
                candidates.append(line.strip())
                if i < len(lines) - 1:
                    candidates.append(lines[i + 1].strip())
                for candidate in candidates:
                    # Simple name heuristic: 2-4 capitalized words
                    words = candidate.split()
                    if 2 <= len(words) <= 5 and all(
                        w[0].isupper() for w in words if w[0].isalpha()
                    ):
                        clean = candidate.strip(",.-:;")
                        if len(clean) > 3 and keyword not in clean.lower():
                            return clean
                # If name is in same line as title
                parts = re.split(r"[,\-–|]", line)
                for part in parts:
                    part = part.strip()
                    words = part.split()
                    if 2 <= len(words) <= 4 and all(
                        w[0].isupper() for w in words if w[0].isalpha()
                    ):
                        if not any(k in part.lower() for k in title_keywords):
                            return part
    return None


def normalize_url(url: str) -> str:
    """Ensure URL has a scheme."""
    if not url:
        return ""
    if not url.startswith(("http://", "https://")):
        return "https://" + url
    return url


async def scrape_page_for_content(url: str) -> dict:
    """Scrape a page and return structured content."""
    html = await fetch_page(url)
    if not html:
        return {"success": False, "url": url, "text": "", "emails": [], "phones": []}

    soup = parse_html(html)
    text = extract_text(soup)
    emails = extract_emails(html)
    phones = extract_phones(text)

    return {
        "success": True,
        "url": url,
        "text": text[:10000],  # Limit text size
        "emails": emails,
        "phones": phones,
        "soup": soup,
        "html": html,
    }
