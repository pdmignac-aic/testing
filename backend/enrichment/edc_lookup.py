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

# EDC-specific terms that must appear for a valid match
EDC_TERMS = [
    "economic development", "development council", "development corporation",
    "development authority", "development commission", "development agency",
    "development partnership", "development alliance", "development district",
    "chamber of commerce", "industrial development", "edc", "eda",
]


def _is_blacklisted_url(url: str) -> bool:
    try:
        domain = (urlparse(url).hostname or "").lower().lstrip("www.")
        return any(domain.endswith(bl) for bl in BLACKLISTED_DOMAINS)
    except Exception:
        return False


def _score_edc_result(title: str, snippet: str, url: str, city: str, state: str, county: str) -> int:
    """Score a search result for EDC relevance. Returns 0 for irrelevant."""
    if _is_blacklisted_url(url):
        return 0

    title_lower = title.lower()
    snippet_lower = snippet.lower()
    url_lower = url.lower()
    combined = f"{title_lower} {snippet_lower}"

    if not any(term in combined for term in EDC_TERMS):
        return 0

    score = 0

    # Strong title signals
    for term in ["economic development", "development council", "development corporation",
                 "development authority", "chamber of commerce", "industrial development"]:
        if term in title_lower:
            score += 5
        if term in snippet_lower:
            score += 1

    # Location match
    if city and city.lower() in combined:
        score += 3
    if county and county.lower() in combined:
        score += 3
    if state and state.lower() in combined:
        score += 1

    # URL signals
    try:
        domain = (urlparse(url).hostname or "").lower()
        path = urlparse(url).path.lower()
        # Prefer dedicated EDC sites (edc, chamber, economic in domain)
        if any(kw in domain for kw in ["edc", "chamber", "economic", "develop"]):
            score += 4
        elif domain.endswith(".org"):
            score += 2
        elif domain.endswith(".gov"):
            # City/state .gov sites are OK only if the path is about economic development
            if any(kw in path for kw in ["economic", "develop", "business", "edc"]):
                score += 2
            else:
                # Generic gov subpage — heavily penalize
                score -= 3
    except Exception:
        pass

    return max(0, score)


async def lookup_edc(city: str, state: str, county: str = "") -> dict:
    """Look up the EDC for a given city/state/county.

    Uses a single focused search query to minimize API calls.
    """
    result = {
        "edc_name": "", "edc_contact_name": "", "edc_contact_email": "",
        "edc_contact_phone": "", "edc_website": "", "edc_source": "",
    }

    if not city and not county:
        return result

    search = get_search_provider()
    location = county if county else city

    # Single focused query — include full state name to avoid wrong-state results
    from enrichment.address_parser import US_STATES
    state_full = US_STATES.get(state, state)
    query = f'"{location}" "{state_full}" economic development council OR corporation OR authority OR "chamber of commerce"'
    await rate_limited_delay()
    search_results = await search.search(query, num_results=5)

    best = None
    for sr in search_results:
        score = _score_edc_result(
            sr.get("title", ""), sr.get("snippet", ""), sr.get("url", ""),
            city, state, county
        )
        if score > 0 and (best is None or score > best["score"]):
            best = {"score": score, **sr}

    if not best or best["score"] < 2:
        result["edc_source"] = "search (no relevant results)"
        return result

    # Clean up EDC name
    edc_name = best.get("title", "")
    edc_name = re.sub(r'\s*[-|·–—]\s*(Home|About|Contact|Welcome).*$', '', edc_name, flags=re.IGNORECASE)
    edc_name = re.sub(r'\s*[-|·–—]\s*$', '', edc_name)
    result["edc_name"] = edc_name.strip()
    result["edc_website"] = best.get("url", "")
    result["edc_source"] = "search"

    # Scrape the EDC website for contact info
    await rate_limited_delay()
    html = await fetch_page(best["url"])
    if html:
        soup = parse_html(html)
        text = extract_text(soup)
        full_text = soup.get_text(separator="\n", strip=True)

        emails = extract_emails(html)
        phones = extract_phones(text)

        if emails:
            result["edc_contact_email"] = emails[0]
        if phones:
            result["edc_contact_phone"] = phones[0]

        contact_name = extract_contact_name(full_text)
        if contact_name:
            result["edc_contact_name"] = contact_name

        # Try one sub-page for contact info if we don't have a name
        if not result["edc_contact_name"]:
            for link in soup.find_all("a", href=True):
                link_text = link.get_text(strip=True).lower()
                if any(kw in link_text for kw in ["about", "staff", "team", "leadership", "contact"]):
                    from urllib.parse import urljoin
                    sub_url = urljoin(best["url"], link["href"])
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
                    break

        result["edc_source"] = "search + website scrape"

    return result
