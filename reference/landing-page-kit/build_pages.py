#!/usr/bin/env python3
"""
Build one personalized landing page per lead from a CSV.

Usage:
    python3 build_pages.py                        # uses leads.csv + config.json
    python3 build_pages.py --leads my_leads.csv --config config.json --out dist

Output:
    dist/<slug>/index.html   one self-contained page per lead (CSS inlined)
    dist/index.html          a blank, noindexed root page
    dist/_headers            noindex header for Cloudflare Pages / Netlify
    outreach_merge.csv       one row per built page, ready to upload to your email tool

Standard library only. Python 3.9+.
"""
from __future__ import annotations

import argparse
import csv
import datetime as dt
import hashlib
import html
import json
import re
import shutil
import sys
import unicodedata
from pathlib import Path
from urllib.parse import urlencode, urlparse, urlunparse, parse_qsl

ROOT = Path(__file__).resolve().parent
MARKER_FILE = ".built-by-build_pages"

REQUIRED_ROW = ["business_name", "email", "search_term", "checked_on",
                "observation_1_title", "observation_1"]
REQUIRED_CONFIG = ["base_url", "your_name", "your_business", "postal_address",
                   "booking_link", "price", "offer_name", "bio"]
RAW_KEYS = {"inline_css", "credentials_html"}  # inserted without HTML escaping

COMPANY_SUFFIX = re.compile(
    r"[,\s]+(l\.?l\.?c\.?|inc\.?|incorporated|co\.?|corp\.?|corporation|ltd\.?|pllc|p\.?c\.?)\s*$",
    re.IGNORECASE)

# Phrases that usually claim something you cannot see from outside the account.
LINT_RULES = [
    (r"\baudit(ed|ing)?\b", "an outside look is not an audit"),
    (r"\bwast(e|ed|es|ing)\b", "you can't see wasted spend from outside"),
    (r"\blos(e|es|ing|t)\b", "you can't see losses from outside"),
    (r"\bguarantee", "never imply guaranteed results"),
    (r"\byour (spend|budget|conversions?|cost per|cpc|quality score|ctr)\b",
     "that is only visible inside their account"),
    (r"\b\d+(\.\d+)?\s*%", "a percentage usually implies account data; check where it came from"),
]

COUNT_PHRASE = {1: "One thing", 2: "Two things", 3: "Three things"}


class RowError(Exception):
    pass


def slugify(text: str) -> str:
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    text = text.lower().replace("&", " and ").replace("'", "")
    text = re.sub(r"[^a-z0-9]+", "-", text).strip("-")
    return re.sub(r"-{2,}", "-", text)[:60].strip("-")


def clean_business_name(name: str) -> str:
    name = " ".join(name.split())
    previous = None
    while previous != name:  # handles "Acme Co., Inc."
        previous = name
        name = COMPANY_SUFFIX.sub("", name).strip(" ,")
    return name


def format_date(value: str) -> str:
    try:
        d = dt.date.fromisoformat(value.strip())
    except ValueError as exc:
        raise RowError(f"checked_on must be YYYY-MM-DD, got {value!r}") from exc
    return f"{d:%B} {d.day}, {d.year}"


def add_query(url: str, params: dict) -> str:
    parts = urlparse(url)
    query = dict(parse_qsl(parts.query))
    query.update({k: v for k, v in params.items() if v})
    return urlunparse(parts._replace(query=urlencode(query)))


def render_conditionals(template: str, values: dict) -> str:
    pattern = re.compile(r"<!--if:(\w+)-->(.*?)<!--endif:\1-->\n?", re.DOTALL)
    while True:
        new = pattern.sub(lambda m: m.group(2) if str(values.get(m.group(1), "")).strip() else "",
                          template)
        if new == template:
            return new
        template = new


def render(template: str, values: dict) -> str:
    out = render_conditionals(template, values)

    def sub(match: re.Match) -> str:
        key = match.group(1)
        if key not in values:
            raise RowError(f"template placeholder {{{{{key}}}}} has no value")
        value = str(values[key])
        return value if key in RAW_KEYS else html.escape(value, quote=True)

    out = re.sub(r"\{\{(\w+)\}\}", sub, out)
    leftover = re.findall(r"\{\{.*?\}\}|<!--(?:if|endif):", out)
    if leftover:
        raise RowError(f"unrendered template markers: {leftover[:3]}")
    return out


def lint_row(row: dict) -> list[str]:
    warnings = []
    for n in (1, 2, 3):
        for field in (f"observation_{n}_title", f"observation_{n}", f"observation_{n}_short",
                      f"observation_{n}_check"):
            text = row.get(field, "") or ""
            for rule, reason in LINT_RULES:
                if field.endswith("_check") and "your" in rule:
                    continue  # "what I'd check inside your account" may name account data
                if re.search(rule, text, re.IGNORECASE):
                    warnings.append(f"{field}: {reason} ({re.search(rule, text, re.I).group(0)!r})")
    return warnings


def load_config(path: Path, allow_placeholders: bool) -> dict:
    config = json.loads(path.read_text(encoding="utf-8"))
    missing = [k for k in REQUIRED_CONFIG if not str(config.get(k, "")).strip()]
    if missing:
        sys.exit(f"config: missing {', '.join(missing)}")
    placeholders = [k for k, v in config.items()
                    if "EDIT" in json.dumps(v) and not k.startswith("_")]
    if placeholders and not allow_placeholders:
        sys.exit("config: replace the EDIT placeholders first: " + ", ".join(placeholders)
                 + "\n(use --allow-placeholders only for a private preview)")
    return config


def prepare_out_dir(out: Path) -> None:
    if out.exists():
        if any(out.iterdir()) and not (out / MARKER_FILE).exists():
            sys.exit(f"{out} exists and wasn't made by this script; choose another --out")
        shutil.rmtree(out)
    out.mkdir(parents=True)
    (out / MARKER_FILE).write_text("Safe to delete: rebuilt by build_pages.py\n")


def build(args: argparse.Namespace) -> int:
    config = load_config(args.config, args.allow_placeholders)
    template = (ROOT / "template.html").read_text(encoding="utf-8")
    css_path = ROOT / "styles.css"
    if not css_path.exists():
        sys.exit("styles.css is missing: run `npx tailwindcss -i input.css -o styles.css --minify`")
    css = css_path.read_text(encoding="utf-8").replace("</style", "<\\/style")

    base_url = config["base_url"].rstrip("/")
    trailing = "/" if config.get("trailing_slash", True) else ""
    credentials = [c for c in config.get("credentials", []) if str(c).strip()]
    shared = {
        "your_name": config["your_name"],
        "your_first_name": config["your_name"].split()[0],
        "your_business": config["your_business"],
        "postal_address": config["postal_address"],
        "price": config["price"],
        "offer_name": config["offer_name"],
        "bio": config["bio"],
        "photo_url": config.get("photo_url", ""),
        "visit_logger_url": config.get("visit_logger_url", ""),
        "sample_banner": "yes" if config.get("sample_banner") else "",
        "credentials_html": "\n      ".join(
            f'<li class="cred">{html.escape(str(c))}</li>' for c in credentials),
        "inline_css": css,
    }

    prepare_out_dir(args.out)
    (args.out / "_headers").write_text("/*\n  X-Robots-Tag: noindex, nofollow\n")
    home = config.get("home_url", "")
    (args.out / "index.html").write_text(
        '<!doctype html><meta charset="utf-8"><meta name="robots" content="noindex">'
        f'<title>{html.escape(config["your_business"])}</title>'
        + (f'<meta http-equiv="refresh" content="0; url={html.escape(home)}">' if home else "")
        + "\n", encoding="utf-8")

    with args.leads.open(newline="", encoding="utf-8-sig") as fh:
        rows = list(csv.DictReader(fh))

    built, skipped, warnings_total = [], [], 0
    used_slugs: set[str] = set()
    merge_rows = []

    for line_no, raw in enumerate(rows, start=2):
        row = {k.strip(): (v or "").strip() for k, v in raw.items() if k}
        label = row.get("business_name") or f"line {line_no}"
        page_dir = None
        try:
            if row.get("fit", "").upper() == "N":
                raise RowError("marked fit=N")
            if row.get("status", "").lower() in {"dnc", "unsubscribed", "do not contact"}:
                raise RowError(f"status is {row['status']!r}")
            missing = [f for f in REQUIRED_ROW if not row.get(f)]
            if missing:
                raise RowError("needs " + ", ".join(missing))

            display_name = clean_business_name(row["business_name"])
            slug = slugify(row.get("slug") or display_name)
            if not slug:
                raise RowError("could not make a slug from the business name")
            if slug in used_slugs and row.get("city"):
                slug = slugify(f"{slug}-{row['city']}")
            if config.get("slug_suffix"):
                slug = f"{slug}-{hashlib.sha1(row['email'].lower().encode()).hexdigest()[:4]}"
            if slug in used_slugs:
                raise RowError(f"slug {slug!r} already used; set a unique slug in the CSV")

            obs_count = sum(1 for n in (1, 2, 3)
                            if row.get(f"observation_{n}") and row.get(f"observation_{n}_title"))
            for n in (2, 3):
                if bool(row.get(f"observation_{n}")) != bool(row.get(f"observation_{n}_title")):
                    raise RowError(f"observation_{n} needs both a title and text")

            page_dir = args.out / slug
            page_dir.mkdir()
            values = dict(shared)
            values.update({
                "slug": slug,
                "business_name": display_name,
                "business_possessive": display_name + ("'" if display_name.lower().endswith("s") else "'s"),
                "greeting": f"Hi {row['first_name']}, " if row.get("first_name") else "Hi, ",
                "search_term": row["search_term"],
                "checked_on": format_date(row["checked_on"]),
                "observation_count_phrase": COUNT_PHRASE[obs_count],
            })
            location = row.get("search_location") or ", ".join(
                p for p in (row.get("city"), row.get("state")) if p)
            context = f"Searched from {location}" if location else ""
            if row.get("search_device"):
                context = f"{context} on {row['search_device']}" if context \
                    else f"Searched on {row['search_device']}"
            values["search_context"] = context

            for n in (1, 2, 3):
                values[f"observation_{n}_title"] = row.get(f"observation_{n}_title", "")
                values[f"observation_{n}"] = row.get(f"observation_{n}", "")
                values[f"observation_{n}_check"] = row.get(f"observation_{n}_check", "")
                image = row.get(f"observation_{n}_image", "")
                if image:
                    source = (args.images / image)
                    if not source.is_file():
                        raise RowError(f"observation_{n}_image not found: {source}")
                    shutil.copy2(source, page_dir / source.name)
                    image = source.name
                values[f"observation_{n}_image"] = image
                values[f"observation_{n}_image_alt"] = (
                    f"Screenshot: {row.get(f'observation_{n}_title', '')}")

            cta = row.get("cta_link") or add_query(
                config["booking_link"],
                {"utm_source": "outreach", "utm_medium": "page", "utm_content": slug})
            values["cta_link"] = cta
            values["cta_label"] = row.get("cta_label") or config.get("cta_label") or "Book a 15-minute review"

            page_html = render(template, values)
            (page_dir / "index.html").write_text(page_html, encoding="utf-8")
            used_slugs.add(slug)

            page_url = f"{base_url}/{slug}{trailing}"
            row_warnings = lint_row(row)
            for n in (1, 2):
                if row.get(f"observation_{n}") and not row.get(f"observation_{n}_short"):
                    row_warnings.append(f"observation_{n}_short is empty; emails will use the title")
            warnings_total += len(row_warnings)
            built.append((label, page_url, row_warnings))

            merge_rows.append({
                "email": row["email"],
                "first_name": row.get("first_name") or "there",
                "business_name": display_name,
                "search_term": row["search_term"],
                "observation_1_short": row.get("observation_1_short")
                or row["observation_1_title"].lower(),
                "observation_2_short": row.get("observation_2_short")
                or row.get("observation_2_title", "").lower(),
                "page_url": page_url,
                "booking_link": cta,
                "slug": slug,
                "cta_label": values["cta_label"],
                "phone": row.get("phone", ""),
                "timezone": row.get("timezone", ""),
                "city": row.get("city", ""),
            })
        except RowError as exc:
            skipped.append((label, str(exc)))
            # remove a half-written page directory, if any
            if page_dir is not None and page_dir.exists() and not (page_dir / "index.html").exists():
                shutil.rmtree(page_dir)

    merge_path = args.merge_out
    with merge_path.open("w", newline="", encoding="utf-8") as fh:
        fields = ["email", "first_name", "business_name", "search_term", "observation_1_short",
                  "observation_2_short", "page_url", "booking_link", "slug", "cta_label", "phone",
                  "timezone", "city"]
        writer = csv.DictWriter(fh, fieldnames=fields)
        writer.writeheader()
        writer.writerows(merge_rows)

    print(f"Built {len(built)} page(s) in {args.out}/ and wrote {merge_path.name}")
    for label, url, row_warnings in built:
        print(f"  ok    {label}: {url}")
        for w in row_warnings:
            print(f"        check {w}")
    for label, reason in skipped:
        print(f"  skip  {label}: {reason}")
    if warnings_total:
        print(f"\n{warnings_total} wording check(s) above: make sure each claim is something "
              "you saw from outside, with a date.")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--leads", type=Path, default=ROOT / "leads.csv")
    parser.add_argument("--config", type=Path, default=ROOT / "config.json")
    parser.add_argument("--images", type=Path, default=ROOT / "images",
                        help="folder holding screenshot files named in observation_N_image")
    parser.add_argument("--out", type=Path, default=ROOT / "dist")
    parser.add_argument("--merge-out", type=Path, default=ROOT / "outreach_merge.csv")
    parser.add_argument("--allow-placeholders", action="store_true",
                        help="build even if config.json still has EDIT placeholders (preview only)")
    args = parser.parse_args()
    if not args.leads.exists():
        sys.exit(f"{args.leads} not found. Copy leads_template.csv to leads.csv and fill it in.")
    return build(args)


if __name__ == "__main__":
    sys.exit(main())
