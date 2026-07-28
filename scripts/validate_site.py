from __future__ import annotations

import json
import sys
import xml.etree.ElementTree as ET
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit


ROOT = Path(__file__).resolve().parents[1]
HTML_FILES = [ROOT / "index.html", ROOT / "privacy.html", ROOT / "404.html"]
REQUIRED_FILES = [
    ROOT / "index.html",
    ROOT / "privacy.html",
    ROOT / "404.html",
    ROOT / "robots.txt",
    ROOT / "sitemap.xml",
    ROOT / "site.webmanifest",
    ROOT / "vercel.json",
    ROOT / "assets" / "favicon.svg",
    ROOT / "assets" / "og-image.jpg",
]


class SiteParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.ids: list[str] = []
        self.links: list[tuple[str, str]] = []
        self.images_without_alt: list[str] = []
        self.blank_links_without_rel: list[str] = []
        self.heading_levels: list[int] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        if values.get("id"):
            self.ids.append(values["id"] or "")
        if tag in {"a", "link"} and values.get("href"):
            self.links.append(("href", values["href"] or ""))
        if tag in {"img", "script"} and values.get("src"):
            self.links.append(("src", values["src"] or ""))
        if tag == "img" and "alt" not in values:
            self.images_without_alt.append(values.get("src", "<unknown>") or "<unknown>")
        if tag == "a" and values.get("target") == "_blank":
            rel = set((values.get("rel") or "").split())
            if not {"noopener", "noreferrer"}.issubset(rel):
                self.blank_links_without_rel.append(values.get("href", "<unknown>") or "<unknown>")
        if tag in {"h1", "h2", "h3", "h4", "h5", "h6"}:
            self.heading_levels.append(int(tag[1]))


def is_local_reference(value: str) -> bool:
    return not (
        value.startswith(("#", "mailto:", "tel:", "data:", "http://", "https://", "//"))
        or value == ""
    )


def validate_html(path: Path) -> list[str]:
    errors: list[str] = []
    source = path.read_text(encoding="utf-8")
    parser = SiteParser()
    parser.feed(source)

    duplicates = sorted({item for item in parser.ids if parser.ids.count(item) > 1})
    if duplicates:
        errors.append(f"{path.name}: duplicate ids: {', '.join(duplicates)}")
    if parser.images_without_alt:
        errors.append(f"{path.name}: images missing alt: {', '.join(parser.images_without_alt)}")
    if parser.blank_links_without_rel:
        errors.append(
            f"{path.name}: target=_blank links missing noopener noreferrer: "
            + ", ".join(parser.blank_links_without_rel)
        )

    for previous, current in zip(parser.heading_levels, parser.heading_levels[1:]):
        if current > previous + 1:
            errors.append(f"{path.name}: heading level jumps from h{previous} to h{current}")

    for attribute, reference in parser.links:
        if reference.startswith("http://"):
            errors.append(f"{path.name}: insecure {attribute} reference: {reference}")
            continue
        if not is_local_reference(reference):
            continue
        clean_path = unquote(urlsplit(reference).path)
        if clean_path.startswith("/moreece-portfolio/"):
            clean_path = clean_path.removeprefix("/moreece-portfolio/")
            target = (ROOT / clean_path).resolve()
        else:
            target = (path.parent / clean_path).resolve()
        if not target.exists():
            errors.append(f"{path.name}: missing local {attribute} target: {reference}")

    if "_captcha', 'false" in source or '_captcha", "false' in source:
        errors.append(f"{path.name}: contact CAPTCHA is disabled")
    if "/cdn-cgi/" in source:
        errors.append(f"{path.name}: contains a Cloudflare-only path")
    return errors


def main() -> int:
    errors: list[str] = []
    for required in REQUIRED_FILES:
        if not required.exists():
            errors.append(f"missing required file: {required.relative_to(ROOT)}")

    for html_file in HTML_FILES:
        if html_file.exists():
            errors.extend(validate_html(html_file))

    try:
        json.loads((ROOT / "site.webmanifest").read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        errors.append(f"invalid site.webmanifest: {exc}")

    try:
        json.loads((ROOT / "vercel.json").read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        errors.append(f"invalid vercel.json: {exc}")

    try:
        ET.parse(ROOT / "sitemap.xml")
    except (OSError, ET.ParseError) as exc:
        errors.append(f"invalid sitemap.xml: {exc}")

    if errors:
        print("Site validation failed:")
        for error in errors:
            print(f"- {error}")
        return 1

    print(f"Validated {len(HTML_FILES)} HTML files and {len(REQUIRED_FILES)} required assets.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
