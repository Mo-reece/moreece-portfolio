from __future__ import annotations

import json
import sys
import xml.etree.ElementTree as ET
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit


ROOT = Path(__file__).resolve().parents[1]
HTML_FILES = sorted(ROOT.rglob("*.html"))
REQUIRED_FILES = [
    ROOT / ".editorconfig",
    ROOT / ".gitattributes",
    ROOT / ".prettierrc.json",
    ROOT / "index.html",
    ROOT / "about.html",
    ROOT / "experience.html",
    ROOT / "services.html",
    ROOT / "projects.html",
    ROOT / "contact.html",
    ROOT / "privacy.html",
    ROOT / "404.html",
    ROOT / "services" / "solutions-architecture.html",
    ROOT / "services" / "full-stack-development.html",
    ROOT / "services" / "data-engineering.html",
    ROOT / "services" / "analytics-reporting.html",
    ROOT / "services" / "automation-ai-data.html",
    ROOT / "robots.txt",
    ROOT / "sitemap.xml",
    ROOT / "site.webmanifest",
    ROOT / "vercel.json",
    ROOT / "package.json",
    ROOT / "package-lock.json",
    ROOT / "assets" / "favicon.svg",
    ROOT / "assets" / "og-image.jpg",
    ROOT / "assets" / "data-engineering-editorial.webp",
    ROOT / "assets" / "analytics-reporting-editorial.webp",
    ROOT / "assets" / "automation-ai-editorial.webp",
    ROOT / "assets" / "fullstack-editorial.webp",
    ROOT / "assets" / "solutions-architecture-diagram.svg",
    ROOT / "assets" / "fonts" / "bebas-neue-400.woff2",
    ROOT / "assets" / "fonts" / "space-mono-400.woff2",
    ROOT / "assets" / "fonts" / "space-mono-700.woff2",
    ROOT / "assets" / "fonts" / "syne-400-800.woff2",
    ROOT / "assets" / "site.css",
    ROOT / "assets" / "site.js",
]


class SiteParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.ids: list[str] = []
        self.links: list[tuple[str, str]] = []
        self.images_without_alt: list[str] = []
        self.images_without_dimensions: list[str] = []
        self.responsive_images_without_sizes: list[str] = []
        self.blank_links_without_rel: list[str] = []
        self.buttons_without_type: list[str] = []
        self.heading_levels: list[int] = []
        self.title_count = 0
        self.main_count = 0
        self.h1_count = 0
        self.canonical_count = 0
        self.manifest_count = 0
        self.has_description = False
        self.has_charset = False
        self.has_viewport = False
        self.has_skip_link = False
        self.has_main_content_id = False
        self.noindex = False
        self.has_language = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        if tag == "html" and values.get("lang"):
            self.has_language = True
        if tag == "title":
            self.title_count += 1
        if tag == "main":
            self.main_count += 1
            if values.get("id") == "main-content":
                self.has_main_content_id = True
        if tag == "h1":
            self.h1_count += 1
        if tag == "meta" and values.get("charset"):
            self.has_charset = True
        if tag == "meta" and values.get("name", "").lower() == "viewport" and values.get("content"):
            self.has_viewport = True
        if tag == "meta" and values.get("name", "").lower() == "description" and values.get("content"):
            self.has_description = True
        if tag == "meta" and values.get("name", "").lower() == "robots":
            self.noindex = "noindex" in (values.get("content") or "").lower()
        if values.get("id"):
            self.ids.append(values["id"] or "")
        if tag in {"a", "link"} and values.get("href"):
            self.links.append(("href", values["href"] or ""))
        if tag == "a" and values.get("class") and "skip-link" in values["class"].split():
            self.has_skip_link = values.get("href") == "#main-content"
        if tag == "link":
            rel = set((values.get("rel") or "").split())
            if "canonical" in rel:
                self.canonical_count += 1
            if "manifest" in rel:
                self.manifest_count += 1
        if tag in {"img", "script"} and values.get("src"):
            self.links.append(("src", values["src"] or ""))
        if tag == "img" and "alt" not in values:
            self.images_without_alt.append(values.get("src", "<unknown>") or "<unknown>")
        if tag == "img" and not (values.get("width") and values.get("height")):
            self.images_without_dimensions.append(values.get("src", "<unknown>") or "<unknown>")
        if tag == "img" and values.get("srcset") and not values.get("sizes"):
            self.responsive_images_without_sizes.append(values.get("src", "<unknown>") or "<unknown>")
        if tag == "a" and values.get("target") == "_blank":
            rel = set((values.get("rel") or "").split())
            if not {"noopener", "noreferrer"}.issubset(rel):
                self.blank_links_without_rel.append(values.get("href", "<unknown>") or "<unknown>")
        if tag == "button" and not values.get("type"):
            self.buttons_without_type.append(values.get("class", "<unknown>") or "<unknown>")
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

    if not parser.has_language:
        errors.append(f"{path.relative_to(ROOT)}: html element is missing a language")
    if not parser.has_charset:
        errors.append(f"{path.relative_to(ROOT)}: document is missing a charset declaration")
    if not parser.has_viewport:
        errors.append(f"{path.relative_to(ROOT)}: document is missing a viewport declaration")
    if parser.title_count != 1:
        errors.append(f"{path.relative_to(ROOT)}: expected one title element, found {parser.title_count}")
    if parser.main_count != 1:
        errors.append(f"{path.relative_to(ROOT)}: expected one main element, found {parser.main_count}")
    if parser.h1_count != 1:
        errors.append(f"{path.relative_to(ROOT)}: expected one h1, found {parser.h1_count}")
    if not parser.noindex and not parser.has_description:
        errors.append(f"{path.relative_to(ROOT)}: indexable page is missing a meta description")
    if not parser.noindex and parser.canonical_count != 1:
        errors.append(
            f"{path.relative_to(ROOT)}: expected one canonical link, found {parser.canonical_count}"
        )
    if parser.manifest_count != 1:
        errors.append(f"{path.relative_to(ROOT)}: expected one manifest link, found {parser.manifest_count}")
    if path.name != "404.html" and not (parser.has_skip_link and parser.has_main_content_id):
        errors.append(f"{path.relative_to(ROOT)}: missing a working skip link to #main-content")

    duplicates = sorted({item for item in parser.ids if parser.ids.count(item) > 1})
    if duplicates:
        errors.append(f"{path.name}: duplicate ids: {', '.join(duplicates)}")
    if parser.images_without_alt:
        errors.append(f"{path.name}: images missing alt: {', '.join(parser.images_without_alt)}")
    if parser.images_without_dimensions:
        errors.append(f"{path.name}: images missing dimensions: {', '.join(parser.images_without_dimensions)}")
    if parser.responsive_images_without_sizes:
        errors.append(
            f"{path.name}: responsive images missing sizes: "
            + ", ".join(parser.responsive_images_without_sizes)
        )
    if parser.blank_links_without_rel:
        errors.append(
            f"{path.name}: target=_blank links missing noopener noreferrer: "
            + ", ".join(parser.blank_links_without_rel)
        )
    if parser.buttons_without_type:
        errors.append(f"{path.name}: buttons missing type: {', '.join(parser.buttons_without_type)}")

    for previous, current in zip(parser.heading_levels, parser.heading_levels[1:]):
        if current > previous + 1:
            errors.append(f"{path.name}: heading level jumps from h{previous} to h{current}")

    for attribute, reference in parser.links:
        if reference.startswith("http://"):
            errors.append(f"{path.name}: insecure {attribute} reference: {reference}")
            continue
        if reference.startswith("#"):
            target = path
            fragment = unquote(reference[1:])
        elif is_local_reference(reference):
            parsed_reference = urlsplit(reference)
            clean_path = unquote(parsed_reference.path)
            fragment = unquote(parsed_reference.fragment)
            if clean_path.startswith("/moreece-portfolio/"):
                clean_path = clean_path.removeprefix("/moreece-portfolio/")
                target = (ROOT / clean_path).resolve()
            else:
                target = (path.parent / clean_path).resolve()
        else:
            continue
        if not target.exists():
            errors.append(f"{path.relative_to(ROOT)}: missing local {attribute} target: {reference}")
            continue
        if fragment and target.suffix.lower() == ".html":
            target_parser = SiteParser()
            target_parser.feed(target.read_text(encoding="utf-8"))
            if fragment not in target_parser.ids:
                errors.append(
                    f"{path.relative_to(ROOT)}: missing fragment target #{fragment} in "
                    f"{target.relative_to(ROOT)}"
                )

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

    for json_path in [
        ROOT / ".prettierrc.json",
        ROOT / "package.json",
        ROOT / "package-lock.json",
        ROOT / "site.webmanifest",
        ROOT / "vercel.json",
    ]:
        try:
            json.loads(json_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            errors.append(f"invalid {json_path.name}: {exc}")

    try:
        ET.parse(ROOT / "sitemap.xml")
    except (OSError, ET.ParseError) as exc:
        errors.append(f"invalid sitemap.xml: {exc}")

    if errors:
        print("Site validation failed:")
        for error in errors:
            print(f"- {error}")
        return 1

    print(f"Validated {len(HTML_FILES)} HTML files and {len(REQUIRED_FILES)} required files.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
