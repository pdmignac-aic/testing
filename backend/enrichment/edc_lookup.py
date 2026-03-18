"""Track A: Economic Development Council (EDC) Lookup."""

import logging
import re
from urllib.parse import urlparse
from search import get_search_provider, rate_limited_delay
from scraper import fetch_page, parse_html, extract_text, extract_emails, extract_phones, extract_contact_name

logger = logging.getLogger(__name__)

# Domains that are never EDC websites
BLACKLISTED_DOMAINS = {
    "wikipedia.org", "facebook.com", "linkedin.com", "twitter.com", "x.com",
    "yelp.com", "yellowpages.com", "bbb.org", "glassdoor.com", "indeed.com",
    "mapquest.com", "google.com", "amazon.com", "reddit.com", "youtube.com",
    "zillow.com", "realtor.com", "trulia.com", "opengov.com", "opencorporates.com",
    "bizapedia.com", "dnb.com", "zoominfo.com", "crunchbase.com",
}

# EDC-specific terms that must appear in title or snippet for a valid match
EDC_TERMS = [
    "economic development",
    "development council",
    "development corporation",
    "development authority",
    "development commission",
    "development agency",
    "development partnership",
    "development alliance",
    "development district",
    "chamber of commerce",
    "industrial development",
    "business development",
    "economic growth",
    "edc",
    "edp",
    "eda",
]


def _is_blacklisted_url(url: str) -> bool:
    """Check if a URL is on the blacklist."""
    try:
        domain = urlparse(url).hostname or ""
        domain = domain.lower().lstrip("www.")
        return any(domain.endswith(bl) for bl in BLACKLISTED_DOMAINS)
    except Exception:
        return False


def _score_edc_result(title: str, snippet: str, url: str, city: str, state: str, county: str) -> int:
    """Score a search result for EDC relevance. Returns 0 for irrelevant results."""
    if _is_blacklisted_url(url):
        return 0

    title_lower = title.lower()
    snippet_lower = snippet.lower()
    combined = f"{title_lower} {snippet_lower}"

    # Must contain at least one EDC-related term
    has_edc_term = any(term in combined for term in EDC_TERMS)
    if not has_edc_term:
        return 0

    score = 0

    # Strong signals in title
    for term in ["economic development", "development council", "development corporation",
                 "development authority", "chamber of commerce", "industrial development"]:
        if term in title_lower:
            score += 4
        if term in snippet_lower:
            score += 1

    # Location match
    if city and city.lower() in combined:
        score += 3
    if county and county.lower() in combined:
        score += 3
    if state and state.lower() in combined:
        score += 1

    # URL signals (EDC sites often have .org or .gov domains)
    try:
        domain = urlparse(url).hostname or ""
        if domain.endswith(".gov"):
            score += 2
        elif domain.endswith(".org"):
            score += 1
    except Exception:
        pass

    return score


async def lookup_edc(city: str, state: str, county: str = "") -> dict:
    """Look up the EDC for a given city/state/county.

    Returns dict with: edc_name, edc_contact_name, edc_contact_email,
    edc_contact_phone, edc_website, edc_source
    """
    result = {
        "edc_name": "",
        "edc_contact_name": "",
        "edc_contact_email": "",
        "edc_contact_phone": "",
        "edc_website": "",
        "edc_source": "",
    }

    if not city and not county:
        return result

    search = get_search_provider()
    location = county if county else city

    # Use multiple targeted queries to improve result quality
    queries = [
        f'{location} {state} economic development council',
        f'{location} {state} economic development corporation OR authority',
    ]
    # If we have a county, also search by county
    if county and city:
        queries.append(f'{city} {state} chamber of commerce economic development')

    best_result = None
    for query in queries:
        await rate_limited_delay()
        search_results = await search.search(query, num_results=5)

        for sr in search_results:
            title = sr.get("title", "")
            snippet = sr.get("snippet", "")
            url = sr.get("url", "")

            score = _score_edc_result(title, snippet, url, city, state, county)
            if score > 0 and (best_result is None or score > best_result["score"]):
                best_result = {"score": score, "title": title, "url": url, "snippet": snippet}

        if best_result and best_result["score"] >= 6:
            break  # Strong match, no need for more queries

    if not best_result or best_result["score"] < 2:
        result["edc_source"] = "search (no relevant results)"
        return result

    # Clean up the EDC name — use title but strip domain suffixes and junk
    edc_name = best_result["title"]
    # Remove common junk patterns from titles
    edc_name = re.sub(r'\s*[-|·–—]\s*(Home|About|Contact|Welcome).*$', '', edc_name, flags=re.IGNORECASE)
    edc_name = re.sub(r'\s*[-|·–—]\s*$', '', edc_name)
    result["edc_name"] = edc_name.strip()
    result["edc_website"] = best_result["url"]
    result["edc_source"] = "search"

    # Try to scrape the EDC website for contact info
    await rate_limited_delay()
    html = await fetch_page(best_result["url"])
    if html:
        soup = parse_html(html)
        text = extract_text(soup)
        full_text = soup.get_text(separator="\n", strip=True)

        # Extract contact details
        emails = extract_emails(html)
        phones = extract_phones(text)

        # Filter out generic emails (noreply, info@, etc. are still useful for EDCs)
        if emails:
            result["edc_contact_email"] = emails[0]
        if phones:
            result["edc_contact_phone"] = phones[0]

        # Try to find executive director / president name
        contact_name = extract_contact_name(full_text)
        if contact_name:
            result["edc_contact_name"] = contact_name

        # Try "About" or "Staff" or "Team" or "Leadership" pages for more contact info
        if not result["edc_contact_name"]:
            for link in soup.find_all("a", href=True):
                link_text = link.get_text(strip=True).lower()
                if any(kw in link_text for kw in ["about", "staff", "team", "leadership", "board", "contact"]):
                    from urllib.parse import urljoin
                    sub_url = urljoin(best_result["url"], link["href"])
                    await rate_limited_delay()
                    sub_html = await fetch_page(sub_url)
                    if sub_html:
                        sub_text = parse_html(sub_html).get_text(separator="\n", strip=True)
                        name = extract_contact_name(sub_text)
                        if name:
                            result["edc_contact_name"] = name
                        if not result["edc_contact_email"]:
                            sub_emails = extract_emails(sub_html)
                            if sub_emails:
                                result["edc_contact_email"] = sub_emails[0]
                        if not result["edc_contact_phone"]:
                            sub_phones = extract_phones(sub_text)
                            if sub_phones:
                                result["edc_contact_phone"] = sub_phones[0]
                    break  # Only try one sub-page

        result["edc_source"] = "search + website scrape"

    return result
