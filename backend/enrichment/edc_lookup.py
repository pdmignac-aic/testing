"""Track A: Economic Development Council (EDC) Lookup."""

import logging
from search import get_search_provider, rate_limited_delay
from scraper import fetch_page, parse_html, extract_text, extract_emails, extract_phones, extract_contact_name

logger = logging.getLogger(__name__)


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

    # Try search queries (limited to reduce rate limiting with free search providers)
    queries = [
        f'"{location}" "{state}" economic development council OR corporation OR authority',
    ]

    best_result = None
    for query in queries:
        await rate_limited_delay()
        search_results = await search.search(query, num_results=3)

        for sr in search_results:
            title = sr.get("title", "").lower()
            snippet = sr.get("snippet", "").lower()
            url = sr.get("url", "")

            # Score based on relevance
            score = 0
            for term in ["economic development", "edc", "development council", "development corporation", "development authority"]:
                if term in title:
                    score += 3
                if term in snippet:
                    score += 1

            # Prefer results mentioning the location
            if city.lower() in title or city.lower() in snippet:
                score += 2
            if location.lower() in title or location.lower() in snippet:
                score += 2

            if score > 0 and (best_result is None or score > best_result["score"]):
                best_result = {"score": score, "title": sr["title"], "url": url, "snippet": sr["snippet"]}

        if best_result and best_result["score"] >= 4:
            break  # Good enough match

    if not best_result:
        result["edc_source"] = "search (no results)"
        return result

    result["edc_name"] = best_result["title"]
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
