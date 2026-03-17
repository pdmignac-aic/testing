"""Parse US addresses to extract city, state, county, zip."""

import re
import logging

logger = logging.getLogger(__name__)

# Common US state abbreviations
US_STATES = {
    "AL": "Alabama", "AK": "Alaska", "AZ": "Arizona", "AR": "Arkansas",
    "CA": "California", "CO": "Colorado", "CT": "Connecticut", "DE": "Delaware",
    "FL": "Florida", "GA": "Georgia", "HI": "Hawaii", "ID": "Idaho",
    "IL": "Illinois", "IN": "Indiana", "IA": "Iowa", "KS": "Kansas",
    "KY": "Kentucky", "LA": "Louisiana", "ME": "Maine", "MD": "Maryland",
    "MA": "Massachusetts", "MI": "Michigan", "MN": "Minnesota", "MS": "Mississippi",
    "MO": "Missouri", "MT": "Montana", "NE": "Nebraska", "NV": "Nevada",
    "NH": "New Hampshire", "NJ": "New Jersey", "NM": "New Mexico", "NY": "New York",
    "NC": "North Carolina", "ND": "North Dakota", "OH": "Ohio", "OK": "Oklahoma",
    "OR": "Oregon", "PA": "Pennsylvania", "RI": "Rhode Island", "SC": "South Carolina",
    "SD": "South Dakota", "TN": "Tennessee", "TX": "Texas", "UT": "Utah",
    "VT": "Vermont", "VA": "Virginia", "WA": "Washington", "WV": "West Virginia",
    "WI": "Wisconsin", "WY": "Wyoming", "DC": "District of Columbia",
}

# Reverse lookup
STATE_NAMES_TO_ABBR = {v.lower(): k for k, v in US_STATES.items()}


def parse_address(address: str) -> dict:
    """Parse a US address string into components.

    Returns dict with keys: city, state, state_full, zip_code, county (empty string if unknown).
    """
    result = {"city": "", "state": "", "state_full": "", "zip_code": "", "county": ""}

    if not address:
        return result

    address = address.strip()

    # Extract zip code
    zip_match = re.search(r"(\d{5})(?:-\d{4})?", address)
    if zip_match:
        result["zip_code"] = zip_match.group(1)

    # Split by commas
    parts = [p.strip() for p in address.split(",")]

    if len(parts) >= 2:
        # Last part usually has state + zip
        last_part = parts[-1].strip()
        state_zip = last_part.split()

        for token in state_zip:
            token_upper = token.upper().strip(".,")
            if token_upper in US_STATES:
                result["state"] = token_upper
                result["state_full"] = US_STATES[token_upper]
                break
            elif token.lower().strip(".,") in STATE_NAMES_TO_ABBR:
                result["state"] = STATE_NAMES_TO_ABBR[token.lower().strip(".,")]
                result["state_full"] = token.strip(".,")
                break

        # City is usually the second-to-last part
        if len(parts) >= 2:
            city_candidate = parts[-2].strip()
            # Remove any street number/direction prefix if city looks like a full address
            if not any(c.isdigit() for c in city_candidate[:3]):
                result["city"] = city_candidate
            elif len(parts) >= 3:
                result["city"] = parts[-2].strip()

    # If we couldn't parse city from commas, try other approach
    if not result["city"] and result["state"]:
        # Try to find city before state
        state_pattern = re.escape(result["state"])
        match = re.search(rf"([A-Za-z\s]+?)\s*,?\s*{state_pattern}", address)
        if match:
            city = match.group(1).strip().rstrip(",")
            # Take last word group as city (skip street address)
            words = city.split()
            if len(words) > 2:
                result["city"] = " ".join(words[-2:]) if words[-2][0].isupper() else words[-1]
            else:
                result["city"] = city

    return result
