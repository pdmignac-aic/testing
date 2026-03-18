"""Track B: Major Customers lookup."""

import re
import logging
from search import get_search_provider, rate_limited_delay
from scraper import (
    fetch_page, parse_html, extract_text, find_links, normalize_url, scrape_page_for_content
)

logger = logging.getLogger(__name__)

# Known defense/aerospace primes
DEFENSE_PRIMES = [
    "lockheed martin", "boeing", "rtx", "raytheon", "northrop grumman",
    "general dynamics", "bae systems", "l3harris", "leidos", "huntington ingalls",
]


async def lookup_customers(company_name: str, website: str) -> dict:
    """Find major customers for a manufacturer.

    Returns dict with: major_customers (list of {name, source}), customer_source
    """
    result = {"major_customers": "", "customer_source": ""}
    customers = []  # list of (name, source)

    # Track 1: Scrape the manufacturer's own website
    website = normalize_url(website)
    if website:
        await rate_limited_delay()
        page_data = await scrape_page_for_content(website)
        if page_data["success"]:
            soup = page_data.get("soup")
            if soup:
                # Look for customer/partner pages
                customer_links = find_links(
                    soup, website,
                    ["customer", "partner", "client", "case stud", "trusted by",
                     "industries served", "who we serve", "our work", "portfolio",
                     "testimonial"]
                )

                # Check main page text for customer names
                text = page_data["text"]
                customers.extend(_extract_customer_names_from_text(text, "company website"))

                # Scrape up to 2 customer-related sub-pages
                for link in customer_links[:2]:
                    await rate_limited_delay()
                    sub_data = await scrape_page_for_content(link)
                    if sub_data["success"]:
                        customers.extend(
                            _extract_customer_names_from_text(sub_data["text"], "company website")
                        )

    # Track 2: Search for press releases, news, and government contracts
    search = get_search_provider()
    await rate_limited_delay()
    search_results = await search.search(
        f'"{company_name}" supplier OR customer OR contract OR "supplies parts to"',
        num_results=5,
    )
    for sr in search_results:
        snippet = sr.get("snippet", "")
        title = sr.get("title", "")
        combined = f"{title} {snippet}"
        names = _extract_known_companies(combined)
        for name in names:
            customers.append((name, "search"))
        # Check for government agencies
        gov_agencies = _extract_gov_agencies(combined)
        for agency in gov_agencies:
            customers.append((agency, "search"))
        # Check for prime contractors
        combined_lower = combined.lower()
        for prime in DEFENSE_PRIMES:
            if prime in combined_lower:
                customers.append((prime.title(), "search"))

    # Deduplicate and format
    seen = set()
    unique_customers = []
    for name, source in customers:
        name_lower = name.lower().strip()
        if name_lower not in seen and len(name) > 1:
            seen.add(name_lower)
            unique_customers.append((name, source))

    # Take top 5
    unique_customers = unique_customers[:5]

    if unique_customers:
        result["major_customers"] = ", ".join(
            f"{name} ({source})" for name, source in unique_customers
        )
        result["customer_source"] = ", ".join(
            set(source for _, source in unique_customers)
        )

    return result


# Major companies we look for
KNOWN_COMPANIES = [
    "Boeing", "Lockheed Martin", "RTX", "Raytheon", "Northrop Grumman",
    "General Dynamics", "BAE Systems", "L3Harris", "General Electric", "GE",
    "Honeywell", "3M", "Caterpillar", "John Deere", "Deere & Company",
    "Ford", "GM", "General Motors", "Chrysler", "Stellantis", "Toyota", "Honda",
    "Tesla", "SpaceX", "Blue Origin", "NASA", "ExxonMobil", "Chevron",
    "Dow Chemical", "DuPont", "BASF", "Procter & Gamble", "Johnson & Johnson",
    "Medtronic", "Abbott", "Stryker", "Siemens", "ABB", "Emerson",
    "Rockwell", "Parker Hannifin", "Danaher", "Illinois Tool Works",
    "Thor Industries", "Forest River", "Patrick Industries", "Cummins",
    "Rolls-Royce", "Pratt & Whitney", "Collins Aerospace",
    "U.S. Army", "U.S. Navy", "U.S. Air Force", "Department of Defense",
    "Apple", "Google", "Microsoft", "Amazon", "Meta Platforms",
]


def _extract_known_companies(text: str) -> list[str]:
    """Find known company names in text using word boundary matching."""
    import re
    found = []
    text_lower = text.lower()
    for company in KNOWN_COMPANIES:
        company_lower = company.lower()
        # Short or common names need word boundaries + business context
        # to avoid false positives in random text
        ambiguous_names = {"ge", "gm", "3m", "abb", "ford", "meta platforms"}
        if len(company) <= 3 or company_lower in ambiguous_names:
            pattern = r'\b' + re.escape(company_lower) + r'\b'
            if re.search(pattern, text_lower):
                # Extra check: require it appears near business context
                for match in re.finditer(pattern, text_lower):
                    start = max(0, match.start() - 100)
                    end = min(len(text_lower), match.end() + 100)
                    context = text_lower[start:end]
                    business_terms = ["customer", "client", "partner", "supplier", "contract",
                                      "supplies", "aviation", "aerospace", "defense", "industrial",
                                      "manufacturer", "company", "corporation", "inc"]
                    if any(term in context for term in business_terms):
                        found.append(company)
                        break
        else:
            if company_lower in text_lower:
                found.append(company)
    return found


def _extract_customer_names_from_text(text: str, source: str) -> list[tuple[str, str]]:
    """Extract potential customer names from page text."""
    customers = []
    # Look for known companies
    for company in _extract_known_companies(text):
        customers.append((company, source))
    return customers


def _extract_gov_agencies(text: str) -> list[str]:
    """Extract government agency names from text."""
    agencies = []
    gov_keywords = {
        "department of defense": "Dept. of Defense",
        "u.s. army": "U.S. Army",
        "u.s. navy": "U.S. Navy",
        "u.s. air force": "U.S. Air Force",
        "nasa": "NASA",
        "department of energy": "Dept. of Energy",
        "department of homeland security": "DHS",
    }
    text_lower = text.lower()
    for keyword, label in gov_keywords.items():
        if keyword in text_lower:
            agencies.append(label)
    return agencies
