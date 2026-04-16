#!/usr/bin/env python3
"""Clean the raw pipeline CSV into a Supabase-ready pipeline_clean.csv."""

import csv
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "pipeline"
DST = ROOT / "pipeline_clean.csv"

HEADER_MAP = {
    "Company Name": "company_name",
    "Identifier": "identifier",
    "Duplicate?": "is_duplicate",
    "Status": "status",
    "Owner": "owner",
    "Layer": "layer",
    "Dirty Grade": "dirty_grade",
    "Components": "components",
    "Full Address": "full_address",
    "Street": "street",
    "City": "city",
    "State": "state",
    "Zip": "zip",
    "Country": "country",
    "Founding Year": "founding_year",
    "Territory": "territory",
    "Notes": "notes",
    "Contact Name": "contact_name",
    "Contact Title": "contact_title",
    "Email": "email",
    "Other": "other",
    "Warm Intro?": "warm_intro",
    "Phone/LinkedIn": "phone_linkedin",
    "Notes2": "notes2",
    "Touch 1 Date": "touch_1_date",
    "Touch 1 Channel": "touch_1_channel",
    "Touch 2 Date": "touch_2_date",
    "Touch 2 Channel": "touch_2_channel",
    "Touch 3 Date": "touch_3_date",
    "Touch 3 Channel": "touch_3_channel",
    "Touch 4 Date": "touch_4_date",
    "Touch 4 Channel": "touch_4_channel",
    "Touch 5 Date": "touch_5_date",
    "Touch 5 Channel": "touch_5_channel",
    "Touch 6 Date": "touch_6_date",
    "Touch 6 Channel": "touch_6_channel",
    "LinkedIn Date": "linkedin_date",
    "LinkedIn": "linkedin",
    "Response Date": "response_date",
    "Engaged Date": "engaged_date",
    "Email Count": "email_count",
    "TP1 Sent?": "tp1_sent",
    "TP2 Sent?": "tp2_sent",
    "TP3 Sent?": "tp3_sent",
    "TP1 Date": "tp1_date",
    "TP2 Date": "tp2_date",
    "TP3 Date": "tp3_date",
}

DROP_HEADERS = {"Column 48", "Column 49", "Column 50"}

DATE_COLUMNS = {
    "touch_1_date", "touch_2_date", "touch_3_date", "touch_4_date",
    "touch_5_date", "touch_6_date", "linkedin_date", "response_date",
    "engaged_date", "tp1_date", "tp2_date", "tp3_date",
}
INT_COLUMNS = {"founding_year"}
NUMERIC_COLUMNS = {"email_count"}
BOOL_COLUMNS = {"tp1_sent", "tp2_sent", "tp3_sent"}

SLASH_DATE = re.compile(r"^(\d{1,2})/(\d{1,2})/(\d{4})$")
ISO_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def normalize_date(raw: str) -> str:
    if not raw:
        return ""
    if ISO_DATE.match(raw):
        return raw
    m = SLASH_DATE.match(raw)
    if m:
        mm, dd, yyyy = m.groups()
        return f"{yyyy}-{int(mm):02d}-{int(dd):02d}"
    return ""


def normalize_bool(raw: str) -> str:
    value = raw.strip().lower()
    if value in {"true", "yes", "y", "1", "t"}:
        return "true"
    if value in {"false", "no", "n", "0", "f"}:
        return "false"
    return ""


def normalize_int(raw: str) -> str:
    try:
        return str(int(float(raw)))
    except (TypeError, ValueError):
        return ""


def normalize_numeric(raw: str) -> str:
    try:
        return str(float(raw))
    except (TypeError, ValueError):
        return ""


def main() -> int:
    if not SRC.exists():
        print(f"Source not found: {SRC}", file=sys.stderr)
        return 1

    with SRC.open(newline="", encoding="utf-8") as f:
        reader = csv.reader(f)
        src_headers = next(reader)
        kept_indexes: list[int] = []
        out_headers: list[str] = []
        for i, h in enumerate(src_headers):
            h_clean = h.strip()
            if h_clean in DROP_HEADERS:
                continue
            mapped = HEADER_MAP.get(h_clean)
            if not mapped:
                print(f"Warning: unknown header '{h_clean}' (skipped)", file=sys.stderr)
                continue
            kept_indexes.append(i)
            out_headers.append(mapped)

        rows_in = 0
        rows_out = 0
        skipped_no_name = 0

        with DST.open("w", newline="", encoding="utf-8") as out:
            writer = csv.writer(out)
            writer.writerow(out_headers)

            for row in reader:
                rows_in += 1
                values = []
                for idx, col in zip(kept_indexes, out_headers):
                    raw = (row[idx] if idx < len(row) else "").strip()
                    if col in DATE_COLUMNS:
                        values.append(normalize_date(raw))
                    elif col in BOOL_COLUMNS:
                        values.append(normalize_bool(raw))
                    elif col in INT_COLUMNS:
                        values.append(normalize_int(raw))
                    elif col in NUMERIC_COLUMNS:
                        values.append(normalize_numeric(raw))
                    else:
                        values.append(raw)

                name_idx = out_headers.index("company_name")
                id_idx = out_headers.index("identifier")
                if not values[name_idx]:
                    if values[id_idx]:
                        values[name_idx] = values[id_idx]
                    else:
                        skipped_no_name += 1
                        continue

                writer.writerow(values)
                rows_out += 1

    print(f"Read {rows_in} rows; wrote {rows_out} to {DST.name} ({skipped_no_name} skipped for missing company_name).")
    print(f"Columns: {len(out_headers)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
