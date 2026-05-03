#!/usr/bin/env python3
"""
process_cliopatria.py
=====================
Converts the full Cliopatria GeoJSON (~15K records, potentially 100+ MB)
into a lightweight JSON file optimised for the web dashboard.

Usage:
  1. Download the Cliopatria GeoJSON:
     - GitHub: https://github.com/Seshat-Global-History-Databank/cliopatria
       (the file is stored as a zip — download and unzip it)
     - Or Zenodo: https://doi.org/10.5281/zenodo.14714684

  2. Run this script:
       pip install geopandas shapely
       python process_cliopatria.py cliopatria.geojson

  3. The output file (cliopatria_web.json) goes into your project's public/ folder.
     The dashboard loads it automatically.

What it does:
  - Reads every polity polygon from the Cliopatria GeoJSON
  - Assigns each feature to the modern country whose bounding box it overlaps
  - Simplifies polygon geometries to reduce file size (~10x smaller)
  - Rounds coordinates to 2 decimal places
  - Outputs a compact JSON grouped by modern country
"""

import json
import sys
import os
import re
import zipfile
import tempfile
from pathlib import Path

try:
    import geopandas as gpd
    from shapely.geometry import box, mapping, shape
    from shapely.ops import unary_union
except ImportError:
    print("ERROR: This script requires geopandas and shapely.")
    print("Install them:  pip install geopandas shapely")
    sys.exit(1)

# ──────────────────────────────────────────────────────────────────────
# Natural Earth countries — used for proper point-in-polygon filtering
# instead of bounding-box overlap (which causes Russia to inherit every
# Roman polity, etc.). Downloaded once and cached locally.
# ──────────────────────────────────────────────────────────────────────
NATURAL_EARTH_URL = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson"
NATURAL_EARTH_CACHE = "ne_110m_admin_0_countries.geojson"

# Map our Seshat 2-letter prefix -> Natural Earth's ISO_A2 code (mostly identical
# but we list the exceptions explicitly).
SESHAT_TO_NE_ISO_A2 = {
    "bu": "BI",  # Burundi (Seshat uses 'bu', NE uses BI)
    "ic": "CI",  # Côte d'Ivoire
    "gu": "GN",  # Guinea
    "is": "IS",  # Iceland
    "sl": "LK",  # Sri Lanka (NE: LK)
    "zi": "ZW",  # Zimbabwe
    "uz": "UZ",
    "td": "TG",  # Togo (Seshat 'td')
    "fm": "FM",  # Micronesia
    "kh": "KH",  # Cambodia
}


def load_country_shapes():
    """Download (or reuse cached) Natural Earth countries GeoJSON
    and return a dict { iso_a2: shapely_geometry } for spatial filtering."""
    if not os.path.exists(NATURAL_EARTH_CACHE):
        print(f"Downloading Natural Earth countries dataset (one-time, ~200KB) ...")
        try:
            from urllib.request import urlretrieve
            urlretrieve(NATURAL_EARTH_URL, NATURAL_EARTH_CACHE)
            print(f"  Saved to {NATURAL_EARTH_CACHE}")
        except Exception as e:
            print(f"  WARNING: Couldn't download Natural Earth ({e}).")
            print(f"  Falling back to bounding-box filtering (less accurate).")
            return None

    try:
        with open(NATURAL_EARTH_CACHE, "r") as f:
            ne_data = json.load(f)
    except Exception as e:
        print(f"  WARNING: Couldn't read {NATURAL_EARTH_CACHE} ({e}). Using bbox filter.")
        return None

    shapes = {}
    for feat in ne_data.get("features", []):
        props = feat.get("properties", {})
        iso = props.get("ISO_A2") or props.get("ISO_A2_EH") or props.get("iso_a2")
        if iso and iso != "-99":
            try:
                shapes[iso.upper()] = shape(feat["geometry"])
            except Exception:
                pass
    print(f"  Loaded {len(shapes)} country shapes from Natural Earth")
    return shapes


def get_country_filter(prefix, info, country_shapes):
    """Get a shapely geometry to filter Cliopatria features for this country.
    Prefers the Natural Earth country shape; falls back to bbox."""
    if country_shapes:
        # Find matching ISO_A2
        iso = SESHAT_TO_NE_ISO_A2.get(prefix, prefix.upper())
        if iso in country_shapes:
            return country_shapes[iso], "shape"
    # Fallback: bbox
    return box(info["west"], info["south"], info["east"], info["north"]), "bbox"

# ──────────────────────────────────────────────────────────────────────
# Country registry, keyed by the 2-letter prefix Seshat uses in its
# polity_new_ID field (e.g. eg_old_k -> Egypt). Most are ISO 3166-1
# alpha-2 codes; a few are Seshat-specific (`bu` for Burundi, `cd` for
# Chad, `ic` for Côte d'Ivoire, etc.) — all verified against actual
# polity names in the religion-tolerance dataset.
#
# bbox is approximate; it's used only for spatial filtering of
# Cliopatria polygons. visual_center is for the regional map's pan/zoom.
# ──────────────────────────────────────────────────────────────────────
COUNTRY_REGISTRY = {
    # Africa
    "bf": {"name": "Burkina Faso",     "south":  9, "north": 15, "west": -6,  "east":  3,  "lat": 12.5, "lon": -1.5},
    "bu": {"name": "Burundi",          "south": -5, "north": -2, "west": 28,  "east": 31,  "lat": -3.4, "lon": 29.9},
    "cd": {"name": "Chad",             "south":  7, "north": 24, "west": 13,  "east": 24,  "lat": 15.5, "lon": 18.7},
    "eg": {"name": "Egypt",            "south": 21, "north": 33, "west": 24,  "east": 37,  "lat": 27.0, "lon": 30.5},
    "et": {"name": "Ethiopia",         "south":  3, "north": 15, "west": 32,  "east": 48,  "lat":  9.0, "lon": 38.7},
    "gh": {"name": "Ghana",            "south":  4, "north": 12, "west": -4,  "east":  2,  "lat":  7.9, "lon": -1.0},
    "gm": {"name": "Gambia",           "south": 13, "north": 14, "west": -17, "east": -13, "lat": 13.5, "lon": -15.4},
    "gu": {"name": "Guinea",           "south":  7, "north": 13, "west": -16, "east": -7,  "lat": 10.5, "lon": -10.9},
    "ic": {"name": "Côte d'Ivoire",    "south":  4, "north": 11, "west": -9,  "east": -2,  "lat":  7.5, "lon": -5.5},
    "ma": {"name": "Morocco",          "south": 21, "north": 36, "west": -17, "east": -1,  "lat": 31.8, "lon": -7.0},
    "ml": {"name": "Mali",             "south": 10, "north": 25, "west": -12, "east":  5,  "lat": 17.5, "lon": -4.0},
    "mr": {"name": "Mauritania",       "south": 14, "north": 27, "west": -17, "east": -5,  "lat": 21.0, "lon": -10.9},
    "mw": {"name": "Malawi",           "south": -17,"north": -9, "west": 32,  "east": 36,  "lat": -13.2,"lon": 34.3},
    "ni": {"name": "Nigeria",          "south":  4, "north": 14, "west":  2,  "east": 15,  "lat":  9.1, "lon":  8.7},
    "rw": {"name": "Rwanda",           "south": -3, "north": -1, "west": 28,  "east": 31,  "lat": -1.9, "lon": 29.9},
    "sl": {"name": "Sri Lanka",        "south":  5, "north": 10, "west": 79,  "east": 82,  "lat":  7.9, "lon": 80.8},
    "so": {"name": "Somalia",          "south": -2, "north": 12, "west": 40,  "east": 52,  "lat":  5.2, "lon": 46.2},
    "td": {"name": "Togo",             "south":  6, "north": 12, "west": -1,  "east":  2,  "lat":  8.6, "lon":  0.8},
    "tn": {"name": "Tunisia",          "south": 30, "north": 38, "west":  7,  "east": 12,  "lat": 33.9, "lon":  9.5},
    "tz": {"name": "Tanzania",         "south": -12,"north": -1, "west": 29,  "east": 41,  "lat": -6.4, "lon": 34.9},
    "ug": {"name": "Uganda",           "south": -2, "north":  4, "west": 29,  "east": 35,  "lat":  1.4, "lon": 32.3},
    "zi": {"name": "Zimbabwe",         "south": -23,"north": -15,"west": 25,  "east": 33,  "lat": -19.0,"lon": 29.9},
    # Americas
    "co": {"name": "Colombia",         "south": -5, "north": 14, "west": -80, "east": -67, "lat":  4.5, "lon": -74.0},
    "ec": {"name": "Ecuador",          "south": -5, "north":  2, "west": -82, "east": -75, "lat": -1.8, "lon": -78.0},
    "mx": {"name": "Mexico",           "south": 14, "north": 33, "west": -118,"east": -86, "lat": 23.0, "lon": -102.0},
    "pe": {"name": "Peru",             "south": -19,"north":  0, "west": -82, "east": -68, "lat": -10.0,"lon": -76.0},
    "us": {"name": "United States",    "south": 18, "north": 72, "west": -180,"east": -66, "lat": 38.0, "lon": -97.0},
    # Europe
    "es": {"name": "Spain",            "south": 35, "north": 44, "west": -10, "east":  4,  "lat": 40.5, "lon": -3.7},
    "fr": {"name": "France",           "south": 42, "north": 51, "west": -5,  "east":  9,  "lat": 46.5, "lon":  2.5},
    "gb": {"name": "United Kingdom",   "south": 49, "north": 61, "west": -8,  "east":  2,  "lat": 54.0, "lon": -2.0},
    "gr": {"name": "Greece",           "south": 34, "north": 42, "west": 19,  "east": 28,  "lat": 39.1, "lon": 21.8},
    "is": {"name": "Iceland",          "south": 63, "north": 67, "west": -25, "east": -13, "lat": 65.0, "lon": -18.0},
    "it": {"name": "Italy",            "south": 36, "north": 48, "west":  6,  "east": 19,  "lat": 42.5, "lon": 13.0},
    "nl": {"name": "Netherlands",      "south": 50, "north": 54, "west":  3,  "east":  8,  "lat": 52.1, "lon":  5.3},
    "no": {"name": "Norway",           "south": 57, "north": 71, "west":  4,  "east": 32,  "lat": 60.5, "lon":  8.5},
    "pt": {"name": "Portugal",         "south": 36, "north": 43, "west": -10, "east": -5,  "lat": 39.4, "lon": -8.2},
    "ru": {"name": "Russia",           "south": 41, "north": 82, "west": 19,  "east": 180, "lat": 60.0, "lon": 100.0},
    "se": {"name": "Sweden",           "south": 55, "north": 70, "west": 10,  "east": 25,  "lat": 60.1, "lon": 18.6},
    "si": {"name": "Slovenia",         "south": 45, "north": 47, "west": 13,  "east": 17,  "lat": 46.2, "lon": 14.6},
    # Middle East / West Asia
    "il": {"name": "Israel",           "south": 29, "north": 34, "west": 34,  "east": 36,  "lat": 31.5, "lon": 34.9},
    "iq": {"name": "Iraq",             "south": 29, "north": 38, "west": 38,  "east": 49,  "lat": 33.2, "lon": 43.7},
    "ir": {"name": "Iran",             "south": 25, "north": 40, "west": 44,  "east": 64,  "lat": 32.0, "lon": 53.0},
    "om": {"name": "Oman",             "south": 16, "north": 27, "west": 51,  "east": 60,  "lat": 21.5, "lon": 55.9},
    "sa": {"name": "Saudi Arabia",     "south": 16, "north": 33, "west": 34,  "east": 56,  "lat": 23.9, "lon": 45.1},
    "sy": {"name": "Syria",            "south": 32, "north": 38, "west": 35,  "east": 43,  "lat": 34.8, "lon": 38.0},
    "tr": {"name": "Turkey",           "south": 36, "north": 42, "west": 26,  "east": 45,  "lat": 39.0, "lon": 35.0},
    "ye": {"name": "Yemen",            "south": 12, "north": 19, "west": 42,  "east": 55,  "lat": 15.5, "lon": 48.0},
    # Central / South Asia
    "af": {"name": "Afghanistan",      "south": 29, "north": 39, "west": 60,  "east": 75,  "lat": 33.9, "lon": 67.7},
    "bd": {"name": "Bangladesh",       "south": 20, "north": 27, "west": 88,  "east": 93,  "lat": 23.7, "lon": 90.4},
    "in": {"name": "India",            "south":  6, "north": 36, "west": 68,  "east": 98,  "lat": 22.0, "lon": 79.0},
    "kg": {"name": "Kyrgyzstan",       "south": 39, "north": 44, "west": 69,  "east": 81,  "lat": 41.2, "lon": 74.8},
    "kz": {"name": "Kazakhstan",       "south": 40, "north": 56, "west": 46,  "east": 88,  "lat": 48.0, "lon": 66.9},
    "pk": {"name": "Pakistan",         "south": 23, "north": 37, "west": 60,  "east": 77,  "lat": 30.0, "lon": 69.0},
    "tj": {"name": "Tajikistan",       "south": 36, "north": 41, "west": 67,  "east": 75,  "lat": 38.9, "lon": 71.3},
    "uz": {"name": "Uzbekistan",       "south": 37, "north": 46, "west": 56,  "east": 74,  "lat": 41.0, "lon": 64.5},
    # East / SE Asia
    "cn": {"name": "China",            "south": 18, "north": 54, "west": 73,  "east": 135, "lat": 35.0, "lon": 105.0},
    "id": {"name": "Indonesia",        "south": -11,"north":  6, "west": 95,  "east": 141, "lat": -2.5, "lon": 118.0},
    "jp": {"name": "Japan",            "south": 24, "north": 46, "west": 123, "east": 146, "lat": 36.0, "lon": 138.0},
    "kh": {"name": "Cambodia",         "south": 10, "north": 15, "west": 102, "east": 108, "lat": 12.5, "lon": 105.0},
    "mn": {"name": "Mongolia",         "south": 41, "north": 52, "west": 87,  "east": 120, "lat": 47.0, "lon": 103.0},
    "th": {"name": "Thailand",         "south":  6, "north": 21, "west": 97,  "east": 106, "lat": 15.9, "lon": 100.9},
    # Oceania
    "fm": {"name": "Micronesia",       "south":  5, "north": 10, "west": 138, "east": 163, "lat":  6.9, "lon": 158.2},
    "pg": {"name": "Papua New Guinea", "south": -11,"north": -1, "west": 141, "east": 156, "lat": -6.3, "lon": 143.9},
}

# ──────────────────────────────────────────────────────────────────────

# How aggressively to simplify polygons (degrees of tolerance).
# 0.05 ≈ 5 km at the equator — good balance of fidelity vs file size.
SIMPLIFY_TOLERANCE = 0.05

# Coordinate precision (decimal places)
COORD_PRECISION = 2

# Hard cap: max polities per country in the output. With proper point-in-polygon
# filtering, most countries stay well under this naturally — only data-rich
# countries like the UK (lots of Anglo-Saxon kingdoms) and India hit it.
# When over the cap, we sample by century bucket so all eras are represented
# (otherwise a single dense era can crowd out everything else).
MAX_FEATURES_PER_COUNTRY = 1000

# Which GeoJSON properties to keep (case-insensitive lookup)
KEEP_PROPS = {
    "name", "startdate", "enddate", "start", "end",
    "startyear", "endyear", "year_start", "year_end",
    "color", "colour", "seshatid", "seshat_id",
    "phrase", "wikipedia", "wiki",
    "memberof", "components"
}


def round_coords(coords, precision=COORD_PRECISION):
    """Recursively round all coordinate values."""
    if isinstance(coords, (int, float)):
        return round(coords, precision)
    return [round_coords(c, precision) for c in coords]


def extract_year(props, keys):
    """Try to extract a year from properties using multiple candidate keys."""
    for k in keys:
        for pk, pv in props.items():
            if pk.lower().replace("_", "") == k.lower().replace("_", ""):
                try:
                    return int(float(pv))
                except (ValueError, TypeError):
                    pass
    return None


# Actual Cliopatria column names (verified from the paper + GitHub README):
#   Name, FromYear, ToYear, Area, Type, Wikipedia, SeshatID, MemberOf, Components, geometry
START_YEAR_KEYS = ["FromYear", "From_Year", "fromyear", "StartDate", "Start", "StartYear", "Year_Start", "start_date"]
END_YEAR_KEYS   = ["ToYear", "To_Year", "toyear", "EndDate", "End", "EndYear", "Year_End", "end_date"]


def extract_name(props):
    """Extract polity name from properties."""
    for k in ["Name", "name", "NAME", "Entity", "entity", "ENTITY"]:
        if k in props and props[k]:
            return str(props[k])
    return "Unknown"


def extract_wiki(props):
    """Extract Wikipedia phrase from properties."""
    for k in ["Wikipedia", "wikipedia", "phrase", "Phrase", "wiki", "Wiki"]:
        if k in props and props[k]:
            return str(props[k])
    return None


def extract_color(props):
    """Extract color from properties."""
    for k in ["Color", "color", "COLOR", "Colour", "colour"]:
        if k in props and props[k]:
            return str(props[k])
    return None


# ──────────────────────────────────────────────────────────────────────
# Religion-tolerance dataset processing.
#
# We build a Historical Government Restrictions Index (H-GRI) and a
# parallel Historical Social Hostilities Index (H-SHI), conceptually
# matching the modern Pew GRI/SHI scales (0–10).
#
# H-GRI = mean of all coded indicator values (0=absent, 1=present, 0.5=
# transitional) across the 12 government-side variables, multiplied by 10.
# Polities with fewer than MIN_INDICATORS coded values are skipped because
# the score would be too noisy.
# ──────────────────────────────────────────────────────────────────────

GOVT_RESTRICTION_VARS = {
    "Government Restrictions on Public Worship",
    "Government Restrictions on Circulation of Religious Literature",
    "Government Pressure to Convert",
    "Frequency of Governmental Violence Against Religious Groups",
    "Government Restrictions on Construction of Religious Buildings",
    "Government Restrictions on Public Proselytizing",
    "Government Restrictions on Conversion",
    "Government Restrictions on Religious Education",
    "Government Restrictions on Property Ownership for Adherents of Any Religious Group",
    "Taxes Based on Religious Adherence or on Religious Activities and Institutions",
    "Government Discrimination Against Religious Groups Taking up Certain Occupations or Functions",
    "Governmental Obligations for Religious Groups to Apply for Official Recognition",
}

SOCIETY_RESTRICTION_VARS = {
    "Societal Pressure to Convert or Against Conversion",
    "Frequency of Societal Violence Against Religious Groups",
    "Societal Discrimination Against Religious Groups Taking up Certain Occupations or Functions",
}

MIN_INDICATORS = 4   # need at least this many coded indicators for a score


def value_to_score(value):
    """Convert a Seshat value_from string to a 0..1 score, or None if unknown.

    Handles binary (present/absent), transitional (P~A, A~P), and the
    frequency scale used for Violence variables (never < vr < mftvr).
    """
    if value is None:
        return None
    v = str(value).strip().lower()
    if v in ("", "unknown", "suspected unknown"):
        return None
    if v in ("present", "p", "yes", "true"):
        return 1.0
    if v in ("absent", "a", "no", "false"):
        return 0.0
    if v == "never":      # frequency: never
        return 0.0
    if v == "vr":         # frequency: very rare
        return 0.33
    if v == "mftvr":      # frequency: more frequent than very rare
        return 0.67
    if "~" in v:          # transitional, e.g. P~A or A~P
        return 0.5
    return None


def parse_year(s):
    if s is None or s == "":
        return None
    try:
        return int(float(s))
    except (ValueError, TypeError):
        return None


def load_religion_data(csv_path):
    """Read the pipe-delimited religion-tolerance CSV and aggregate per polity.

    Aggregation logic: a polity can have several rows for the same variable
    (one per time-period). We first average within each variable, then take
    the mean across variables. That way a polity with 5 rows of one variable
    and 1 row of another doesn't get the first variable weighted 5x.

    Returns: { seshat_id_or_name: {hgri, hshi, mainReligion, ...} }
    """
    print(f"\nReading religion-tolerance data from {csv_path} ...")

    # Per-polity accumulators. Per-variable lists of scores so we can
    # average within a variable before averaging across variables.
    polities = {}

    with open(csv_path, "r", encoding="utf-8") as f:
        header = f.readline().rstrip("\r\n").split("|")
        idx = {col: i for i, col in enumerate(header)}

        line_count = 0
        for raw_line in f:
            parts = raw_line.rstrip("\r\n").split("|")
            if len(parts) < len(header):
                continue
            line_count += 1

            subsection = parts[idx["subsection"]]
            variable   = parts[idx["variable_name"]]
            year_from  = parts[idx["year_from"]]
            year_to    = parts[idx["year_to"]]
            polity     = parts[idx["polity_name"]]
            new_id     = parts[idx["polity_new_ID"]]
            old_id     = parts[idx["polity_old_ID"]]
            value      = parts[idx["value_from"]]

            key = new_id or old_id or polity
            if not key:
                continue

            entry = polities.setdefault(key, {
                "name": polity,
                "ids": set(),
                "gri_per_var": {},
                "shi_per_var": {},
                "main_religion": None,
                "official_religion": None,
                "elites_religion": None,
                "year_from": None,
                "year_to": None,
            })
            if new_id: entry["ids"].add(new_id)
            if old_id: entry["ids"].add(old_id)

            # Track year range — take the widest
            yf, yt = parse_year(year_from), parse_year(year_to)
            if yf is not None:
                entry["year_from"] = yf if entry["year_from"] is None else min(entry["year_from"], yf)
            if yt is not None:
                entry["year_to"]   = yt if entry["year_to"]   is None else max(entry["year_to"],   yt)

            # Religious composition (latest non-empty wins)
            if variable == "Most widespread religion" and value:
                entry["main_religion"] = value
            elif variable == "Official Religion" and value:
                entry["official_religion"] = value
            elif variable == "Elites Religion" and value:
                entry["elites_religion"] = value

            if subsection == "Religious Tolerance":
                score = value_to_score(value)
                if score is None:
                    continue
                if variable in GOVT_RESTRICTION_VARS:
                    entry["gri_per_var"].setdefault(variable, []).append(score)
                elif variable in SOCIETY_RESTRICTION_VARS:
                    entry["shi_per_var"].setdefault(variable, []).append(score)

    # Finalize: per-variable mean, then mean across variables * 10
    finalized = {}
    n_with_gri = 0
    for key, e in polities.items():
        # Detect country prefix from any of the polity's IDs
        country_prefix = None
        for pid in [key] + list(e["ids"]):
            m = re.match(r'^([a-z]{2})_', pid)
            if m and m.group(1) in COUNTRY_REGISTRY:
                country_prefix = m.group(1)
                break

        record = {
            "name": e["name"],
            "mainReligion":     e["main_religion"],
            "officialReligion": e["official_religion"],
            "elitesReligion":   e["elites_religion"],
            "yearFrom":         e["year_from"],
            "yearTo":           e["year_to"],
            "countryPrefix":    country_prefix,
        }

        gri_vars = e["gri_per_var"]
        if len(gri_vars) >= MIN_INDICATORS:
            var_means = [sum(scores)/len(scores) for scores in gri_vars.values()]
            record["hgri"]         = round(sum(var_means) / len(var_means) * 10, 2)
            record["hgriCoverage"] = len(gri_vars)
            n_with_gri += 1

        shi_vars = e["shi_per_var"]
        if len(shi_vars) >= 2:
            var_means = [sum(scores)/len(scores) for scores in shi_vars.values()]
            record["hshi"]         = round(sum(var_means) / len(var_means) * 10, 2)
            record["hshiCoverage"] = len(shi_vars)

        # Per-variable scores for radar / comparison views.
        # We emit ALL coded variables, even when coverage is below the
        # H-GRI threshold — the radar can still show the partial profile.
        if gri_vars or shi_vars:
            profile = {}
            for variable, scores in gri_vars.items():
                profile[variable] = round(sum(scores)/len(scores), 3)
            for variable, scores in shi_vars.items():
                profile[variable] = round(sum(scores)/len(scores), 3)
            record["religiousProfile"] = profile

        record["_ids"] = list(e["ids"])
        finalized[key] = record

    print(f"  {line_count} data rows -> {len(finalized)} polities, {n_with_gri} with H-GRI score")

    # Build a lookup table: any of the polity's IDs -> finalized record
    lookup = {}
    for key, rec in finalized.items():
        lookup[key.lower()] = rec
        for pid in rec.get("_ids", []):
            lookup[pid.lower()] = rec
        lookup[rec["name"].lower()] = rec

    return lookup


def process(input_path, output_path, religion_lookup=None):
    print(f"Reading {input_path} ...")
    gdf = gpd.read_file(input_path)
    print(f"  Loaded {len(gdf)} features")

    # Peek at columns
    print(f"  Columns: {list(gdf.columns)}")

    # Diagnostic: verify we can find year columns
    sample_props = {k: v for k, v in gdf.iloc[0].items() if k != "geometry"} if len(gdf) > 0 else {}
    test_start = extract_year(sample_props, START_YEAR_KEYS)
    test_end   = extract_year(sample_props, END_YEAR_KEYS)
    test_name  = extract_name(sample_props)
    print(f"  Sample row -> Name={test_name!r}, FromYear={test_start}, ToYear={test_end}")
    if test_start is None or test_end is None:
        print(f"  WARNING: Could not extract years from first row!")
        print(f"  Available props: {list(sample_props.keys())}")
        print(f"  Looking for start in: {START_YEAR_KEYS}")
        print(f"  Looking for end in:   {END_YEAR_KEYS}")

    # Build proper spatial filters per country
    # (uses Natural Earth country shapes if available, bbox as fallback)
    print("\nBuilding spatial filters ...")
    country_shapes = load_country_shapes()
    country_filters = {}
    for prefix, info in COUNTRY_REGISTRY.items():
        country_filters[prefix], _ = get_country_filter(prefix, info, country_shapes)

    # Pre-compute representative points for each Cliopatria polygon — much faster
    # than running point-in-polygon against complex country shapes for every
    # (country × polygon) pair. We use the polygon's representative_point() which
    # is guaranteed to be inside the polygon (unlike centroid for concave shapes).
    print("Computing representative points for spatial join ...")
    rep_points = gdf.geometry.representative_point()

    # Output result structure
    result = {
        "metadata": {
            "source": "Cliopatria (Seshat Global History Databank) + Seshat religion-tolerance",
            "version": "processed",
            "features_in": len(gdf),
            "simplify_tolerance": SIMPLIFY_TOLERANCE
        },
        "regions": {}
    }

    # Pre-group religion records by country prefix so we can find polities
    # that lack Cliopatria geometry but DO have religion data
    religion_by_country = {prefix: [] for prefix in COUNTRY_REGISTRY}
    seen_religion_keys = set()
    if religion_lookup:
        # religion_lookup has multiple keys per record (id + name) — dedupe
        unique_records = {}
        for rec in religion_lookup.values():
            rid = id(rec)
            if rid not in unique_records:
                unique_records[rid] = rec
        for rec in unique_records.values():
            cp = rec.get("countryPrefix")
            if cp and cp in religion_by_country:
                religion_by_country[cp].append(rec)

    total_kept = 0
    total_religion_only = 0
    for prefix, info in COUNTRY_REGISTRY.items():
        country_name = info["name"]
        country_filter = country_filters[prefix]
        bb = {"south": info["south"], "north": info["north"],
              "west":  info["west"],  "east":  info["east"]}
        center = (info["lat"], info["lon"])

        features = []
        matched_religion_keys = set()

        # === Pass 1: Cliopatria features whose representative point lies
        # inside this country's actual borders ===
        # Using representative_point().within() instead of geometry.intersects()
        # avoids the pathological case where, e.g., the Roman Empire (which
        # intersects 50+ modern countries' bounding boxes) gets duplicated
        # everywhere. A polity is assigned to a country when its centroid-ish
        # point falls inside that country's actual polygon.
        mask = rep_points.within(country_filter)
        subset = gdf[mask]
        for _, row in subset.iterrows():
            props = {k: v for k, v in row.items() if k != "geometry"}

            name = extract_name(props)
            start = extract_year(props, START_YEAR_KEYS)
            end   = extract_year(props, END_YEAR_KEYS)
            wiki  = extract_wiki(props)
            color = extract_color(props)

            geom = row.geometry
            if geom is None or geom.is_empty:
                continue
            simplified = geom.simplify(SIMPLIFY_TOLERANCE, preserve_topology=True)
            if simplified.is_empty:
                continue

            geom_json = mapping(simplified)
            geom_json["coordinates"] = round_coords(geom_json["coordinates"])

            feature = {
                "name": name,
                "startYear": start,
                "endYear": end,
                "geometry": geom_json,
            }
            if wiki:  feature["wiki"] = wiki
            if color: feature["color"] = color

            seshat_id = None
            for k in ["SeshatID", "seshatid", "Seshat_ID", "seshat_id"]:
                if k in props and props[k]:
                    seshat_id = str(props[k])
                    feature["seshatId"] = seshat_id
                    break

            # Merge in religion data
            if religion_lookup:
                rec = None
                if seshat_id:
                    rec = religion_lookup.get(seshat_id.lower())
                if rec is None and name:
                    rec = religion_lookup.get(name.lower())
                if rec:
                    matched_religion_keys.add(id(rec))
                    if "hgri" in rec:
                        feature["hgri"] = rec["hgri"]
                        feature["hgriCoverage"] = rec["hgriCoverage"]
                    if "hshi" in rec:
                        feature["hshi"] = rec["hshi"]
                        feature["hshiCoverage"] = rec["hshiCoverage"]
                    if rec.get("mainReligion"):
                        feature["mainReligion"] = rec["mainReligion"]
                    if rec.get("officialReligion"):
                        feature["officialReligion"] = rec["officialReligion"]
                    if rec.get("elitesReligion"):
                        feature["elitesReligion"] = rec["elitesReligion"]
                    if rec.get("religiousProfile"):
                        feature["religiousProfile"] = rec["religiousProfile"]

            features.append(feature)

        # === Pass 2: Religion-only polities (no Cliopatria geometry) ===
        # These appear without borders but with H-GRI/religion data,
        # so the timeline and polity ribbon still work for them.
        religion_only_count = 0
        for rec in religion_by_country[prefix]:
            if id(rec) in matched_religion_keys:
                continue  # already merged into a Cliopatria feature
            yf = rec.get("yearFrom")
            yt = rec.get("yearTo")
            if yf is None and yt is None:
                continue  # no temporal info — can't place on the timeline

            feature = {
                "name": rec["name"],
                "startYear": yf if yf is not None else yt,
                "endYear":   yt if yt is not None else yf,
                "religionOnly": True,  # flag: no border geometry available
            }
            if "hgri" in rec:
                feature["hgri"] = rec["hgri"]
                feature["hgriCoverage"] = rec["hgriCoverage"]
            if "hshi" in rec:
                feature["hshi"] = rec["hshi"]
                feature["hshiCoverage"] = rec["hshiCoverage"]
            if rec.get("mainReligion"):
                feature["mainReligion"] = rec["mainReligion"]
            if rec.get("officialReligion"):
                feature["officialReligion"] = rec["officialReligion"]
            if rec.get("elitesReligion"):
                feature["elitesReligion"] = rec["elitesReligion"]
            if rec.get("religiousProfile"):
                feature["religiousProfile"] = rec["religiousProfile"]

            features.append(feature)
            religion_only_count += 1

        if not features:
            continue

        features.sort(key=lambda f: f.get("startYear") or -9999)

        # Apply per-country cap with century-bucket sampling — preserves
        # temporal coverage so no era gets crowded out by a single dense
        # period (e.g. 200 Anglo-Saxon kingdoms swamping the British Empire).
        if len(features) > MAX_FEATURES_PER_COUNTRY:
            buckets = {}  # century -> list of features
            for f in features:
                start = f.get("startYear") or 0
                century = start // 100
                buckets.setdefault(century, []).append(f)

            n_buckets = len(buckets)
            per_bucket_limit = max(3, MAX_FEATURES_PER_COUNTRY // n_buckets)
            kept = []
            overflow = []  # candidates that didn't fit in their bucket

            for century, fs in buckets.items():
                # Within a bucket, prioritise H-GRI then longest duration
                fs.sort(key=lambda f: (
                    1 if "hgri" in f else 0,
                    (f.get("endYear") or 0) - (f.get("startYear") or 0)
                ), reverse=True)
                kept.extend(fs[:per_bucket_limit])
                overflow.extend(fs[per_bucket_limit:])

            # Fill remaining slots from overflow if we're under the cap
            remaining = MAX_FEATURES_PER_COUNTRY - len(kept)
            if remaining > 0 and overflow:
                overflow.sort(key=lambda f: (
                    1 if "hgri" in f else 0,
                    (f.get("endYear") or 0) - (f.get("startYear") or 0)
                ), reverse=True)
                kept.extend(overflow[:remaining])

            features = kept
            features.sort(key=lambda f: f.get("startYear") or -9999)

        result["regions"][country_name] = {
            "center": {"lat": center[0], "lon": center[1]},
            "bounds": bb,
            "features": features,
        }

        with_gri = sum(1 for f in features if "hgri" in f)
        with_geom = sum(1 for f in features if not f.get("religionOnly"))
        total_kept += with_geom
        total_religion_only += religion_only_count
        if religion_lookup:
            print(f"  {country_name}: {with_geom} borders + {religion_only_count} religion-only ({with_gri} with H-GRI)")
        else:
            print(f"  {country_name}: {with_geom} borders")

    result["metadata"]["features_out"] = total_kept
    result["metadata"]["religion_only_features"] = total_religion_only
    result["metadata"]["countries"] = len(result["regions"])

    # Write output
    with open(output_path, "w") as f:
        json.dump(result, f, separators=(",", ":"))

    size_mb = os.path.getsize(output_path) / (1024 * 1024)
    print(f"\nDone! Wrote {output_path} ({size_mb:.1f} MB)")
    print(f"  {len(result['regions'])} countries with data")
    print(f"  {total_kept} polities with borders")
    print(f"  {total_religion_only} polities religion-only (no border geometry)")
    print(f"\nCopy this file to your project's public/ folder.")


def main():
    if len(sys.argv) < 2:
        print("Usage: python process_cliopatria.py <cliopatria.geojson> [religion_data.csv]")
        print()
        print("The first arg is the Cliopatria GeoJSON (or its .zip).")
        print("The second arg is OPTIONAL — pass the religion-tolerance CSV to")
        print("compute Historical GRI / SHI scores and merge them into each polity.")
        sys.exit(1)

    input_path  = sys.argv[1]
    # Detect if the second arg is a CSV (religion data) or an output path
    religion_path = None
    output_path = "cliopatria_web.json"
    for arg in sys.argv[2:]:
        if arg.endswith(".csv"):
            religion_path = arg
        else:
            output_path = arg

    if not os.path.exists(input_path):
        print(f"ERROR: File not found: {input_path}")
        sys.exit(1)
    if religion_path and not os.path.exists(religion_path):
        print(f"ERROR: Religion data file not found: {religion_path}")
        sys.exit(1)

    # Load religion data if provided
    religion_lookup = None
    if religion_path:
        religion_lookup = load_religion_data(religion_path)

    # Handle zip files
    if input_path.endswith(".zip"):
        print(f"\nExtracting {input_path} ...")
        with tempfile.TemporaryDirectory() as tmpdir:
            with zipfile.ZipFile(input_path, "r") as zf:
                geojson_names = [n for n in zf.namelist() if n.endswith(".geojson")]
                if not geojson_names:
                    print("ERROR: No .geojson file found inside the zip.")
                    sys.exit(1)
                zf.extract(geojson_names[0], tmpdir)
                extracted = os.path.join(tmpdir, geojson_names[0])
                print(f"  Extracted: {geojson_names[0]}")
                process(extracted, output_path, religion_lookup)
    else:
        process(input_path, output_path, religion_lookup)


if __name__ == "__main__":
    main()