"""Track C: Trade Association lookup."""

import logging
from search import get_search_provider, rate_limited_delay
from scraper import fetch_page, parse_html, extract_text, normalize_url, find_links

logger = logging.getLogger(__name__)

# Well-known manufacturing trade associations and their sectors
TRADE_ASSOCIATIONS = {
    "NTMA": {"name": "National Tooling and Machining Association", "sectors": ["machining", "tooling", "cnc", "precision", "metalworking"]},
    "PMA": {"name": "Precision Metalforming Association", "sectors": ["metalforming", "stamping", "metal", "fabrication", "sheet metal"]},
    "AMT": {"name": "Association for Manufacturing Technology", "sectors": ["manufacturing", "machine tool", "automation", "cnc"]},
    "SME": {"name": "Society of Manufacturing Engineers", "sectors": ["manufacturing", "engineering", "automation", "machining"]},
    "NAM": {"name": "National Association of Manufacturers", "sectors": ["manufacturing"]},
    "FMA": {"name": "Fabricators & Manufacturers Association", "sectors": ["fabrication", "metal", "welding", "sheet metal"]},
    "AWS": {"name": "American Welding Society", "sectors": ["welding", "fabrication", "metal"]},
    "AIAG": {"name": "Automotive Industry Action Group", "sectors": ["automotive", "auto parts"]},
    "NADCA": {"name": "North American Die Casting Association", "sectors": ["die casting", "casting", "foundry"]},
    "AFS": {"name": "American Foundry Society", "sectors": ["foundry", "casting", "metal casting"]},
    "AISI": {"name": "American Iron and Steel Institute", "sectors": ["steel", "iron", "metals"]},
    "SPI": {"name": "Plastics Industry Association", "sectors": ["plastics", "injection molding", "polymer", "extrusion"]},
    "PMPA": {"name": "Precision Machined Products Association", "sectors": ["machining", "precision", "screw machine", "turned parts"]},
    "NFPA": {"name": "National Fluid Power Association", "sectors": ["hydraulic", "pneumatic", "fluid power"]},
    "RIA": {"name": "Robotic Industries Association", "sectors": ["robotics", "automation", "robot"]},
    "ISFA": {"name": "International Surface Fabricators Association", "sectors": ["surface", "countertop", "fabrication"]},
    "TMA": {"name": "Texas Manufacturers Association", "sectors": ["manufacturing", "texas"]},
    "IMA": {"name": "Indiana Manufacturers Association", "sectors": ["manufacturing", "indiana"]},
    "OMA": {"name": "Ohio Manufacturers Association", "sectors": ["manufacturing", "ohio"]},
    "MFGOH": {"name": "Ohio Manufacturing Association", "sectors": ["manufacturing", "ohio"]},
}


async def lookup_trade_associations(
    company_name: str, website: str, city: str = "", state: str = ""
) -> dict:
    """Find trade associations for a manufacturer.

    Returns dict with: trade_associations (formatted string with * and REL markers)
    """
    result = {"trade_associations": ""}
    confirmed = []  # (abbreviation, source)
    relevant = []  # (abbreviation, reason)
    sector_keywords = []

    # Step 1: Scrape manufacturer website for membership info and sector clues
    website = normalize_url(website)
    if website:
        await rate_limited_delay()
        html = await fetch_page(website)
        if html:
            soup = parse_html(html)
            text = extract_text(soup).lower()

            # Extract sector keywords from website content
            sector_keywords = _infer_sectors(text)

            # Look for explicit trade association mentions
            for abbr, info in TRADE_ASSOCIATIONS.items():
                if abbr.lower() in text or info["name"].lower() in text:
                    confirmed.append((abbr, "company website"))

            # Check for membership/affiliation pages
            membership_links = find_links(
                soup, website,
                ["membership", "affiliation", "association", "certification",
                 "accreditation", "partner", "member of"]
            )
            for link in membership_links[:2]:
                await rate_limited_delay()
                sub_html = await fetch_page(link)
                if sub_html:
                    sub_text = extract_text(parse_html(sub_html)).lower()
                    for abbr, info in TRADE_ASSOCIATIONS.items():
                        if (abbr.lower() in sub_text or info["name"].lower() in sub_text) and abbr not in [c[0] for c in confirmed]:
                            confirmed.append((abbr, "company website"))

            # Check footer for association logos/badges (look for img alt text)
            footer = soup.find("footer")
            if footer:
                for img in footer.find_all("img", alt=True):
                    alt = img.get("alt", "").lower()
                    for abbr, info in TRADE_ASSOCIATIONS.items():
                        if abbr.lower() in alt or info["name"].lower() in alt:
                            if abbr not in [c[0] for c in confirmed]:
                                confirmed.append((abbr, "website footer"))

    # Step 2: Search for manufacturer in trade association directories
    search = get_search_provider()
    await rate_limited_delay()
    search_results = await search.search(
        f'"{company_name}" trade association OR member OR directory',
        num_results=5,
    )
    if search_results:
        for sr in search_results:
            title = sr.get("title", "").lower()
            snippet = sr.get("snippet", "").lower()
            url = sr.get("url", "").lower()
            combined = f"{title} {snippet} {url}"

            for abbr, info in TRADE_ASSOCIATIONS.items():
                if abbr.lower() in combined or info["name"].lower() in combined:
                    if abbr not in [c[0] for c in confirmed]:
                        confirmed.append((abbr, "directory/search"))

    # Step 3: Identify relevant associations based on sector
    confirmed_abbrs = {c[0] for c in confirmed}
    for abbr, info in TRADE_ASSOCIATIONS.items():
        if abbr in confirmed_abbrs:
            continue
        # Check if any of the association's sectors match inferred sectors
        for sector in info["sectors"]:
            if sector in sector_keywords:
                relevant.append((abbr, f"sector match: {sector}"))
                break

    # Also add state-specific associations
    state_assocs = {
        "TX": "TMA", "IN": "IMA", "OH": "OMA",
    }
    if state in state_assocs:
        sa = state_assocs[state]
        if sa not in confirmed_abbrs and sa not in [r[0] for r in relevant]:
            relevant.append((sa, f"state: {state}"))

    # Format output
    parts = []
    for abbr, source in confirmed:
        parts.append(f"*{abbr}")
    for abbr, reason in relevant[:4]:  # Limit relevant suggestions
        parts.append(f"REL — {abbr}")

    result["trade_associations"] = ", ".join(parts) if parts else ""
    return result


def _infer_sectors(text: str) -> list[str]:
    """Infer manufacturing sectors from website text."""
    sector_keywords = []
    keyword_map = {
        "machining": ["machining", "cnc", "milling", "turning", "lathe"],
        "fabrication": ["fabrication", "fabricating", "sheet metal", "laser cutting"],
        "welding": ["welding", "weld"],
        "stamping": ["stamping", "metal stamping", "press"],
        "casting": ["casting", "foundry", "die cast"],
        "plastics": ["plastic", "injection molding", "extrusion", "polymer"],
        "automotive": ["automotive", "auto parts", "vehicle"],
        "aerospace": ["aerospace", "aircraft", "aviation", "defense"],
        "metalworking": ["metalworking", "metal work", "alloy"],
        "tooling": ["tooling", "tool and die", "mold making", "mold"],
        "automation": ["automation", "robotic", "robot"],
        "precision": ["precision", "tight tolerance", "micro"],
        "manufacturing": ["manufacturing", "manufacturer"],
        "hydraulic": ["hydraulic", "pneumatic", "fluid power"],
        "steel": ["steel", "stainless", "iron"],
        "metal": ["metal", "aluminum", "titanium", "copper", "brass"],
    }

    for sector, keywords in keyword_map.items():
        for kw in keywords:
            if kw in text:
                sector_keywords.append(sector)
                break

    return sector_keywords
