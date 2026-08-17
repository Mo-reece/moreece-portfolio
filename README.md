# Maurice Leonard Okurut Portfolio Website

Multi-page professional portfolio for Okurut Maurice Leonard, a data engineer and digital solutions builder based in Kampala, Uganda.

## Information architecture

The site uses a focused homepage supported by dedicated pages for information that deserves its own context:

- About: professional profile, principles, approach, and relevant toolkit.
- Experience: complete employment timeline and verified certification.
- Capabilities: overview of the three strongest data service areas.
- Capability details: separate pages for data engineering, analytics and reporting, and automation and AI-ready data.
- Projects: selected public work grouped by data/analytics and applied machine learning.
- Contact: direct channels, enquiry guidance, and a privacy-aware contact form.

## Tech stack

- Semantic HTML5
- Shared responsive CSS
- Dependency-free vanilla JavaScript
- Original editorial visual system using Bebas Neue, Space Mono, and Syne
- Optimised WebP capability imagery with curated Unsplash project photography
- Static hosting on GitHub Pages, with Vercel security-header configuration
- Prettier development tooling for consistent HTML, CSS, JavaScript, JSON, and Markdown formatting

## Project structure

```text
.
|-- index.html
|-- about.html
|-- experience.html
|-- services.html
|-- projects.html
|-- contact.html
|-- privacy.html
|-- 404.html
|-- services/
|   |-- data-engineering.html
|   |-- analytics-reporting.html
|   `-- automation-ai-data.html
|-- assets/
|   |-- site.css
|   |-- site.js
|   |-- favicon.svg
|   |-- og-image.jpg
|   |-- portrait*.webp
|   |-- data-engineering-editorial.webp
|   |-- analytics-reporting-editorial.webp
|   `-- automation-ai-editorial.webp
|-- scripts/
|   |-- validate_site.py
|   `-- browser_audit.mjs
|-- .editorconfig
|-- .gitattributes
|-- .prettierrc.json
|-- package.json
|-- package-lock.json
|-- sitemap.xml
|-- robots.txt
|-- site.webmanifest
`-- vercel.json
```

## Local preview

```bash
python -m http.server 8000
```

Then visit `http://localhost:8000/`.

## Code formatting

Install the pinned development tooling once:

```bash
npm install
```

Format the supported source files or check that they are already formatted:

```bash
npm run format
npm run format:check
```

The project uses UTF-8, LF line endings, four-space indentation, final newlines, and trimmed trailing whitespace.

## Validation

Run the source, metadata, accessibility-baseline, image, and internal-link checks:

```bash
python scripts/validate_site.py
```

With Chrome installed, run responsive browser checks:

```bash
node scripts/browser_audit.mjs http://localhost:8000/
```

The browser audit scrolls through the main pages at 320, 390, 768, and 1440 pixels, then checks content, landmarks, responsive images, fonts, navigation, touch-target minimums, overflow, and browser errors. Add `--json` for the full machine-readable report.

## Deployment

Live GitHub Pages URL: [https://mo-reece.github.io/moreece-portfolio/](https://mo-reece.github.io/moreece-portfolio/)

GitHub Pages deploys from `main`. Merge the feature branch through a reviewed pull request after validation succeeds.

## Content maintenance

- Keep employment dates and responsibilities aligned with the current CV.
- Keep certificate verification links current.
- Keep project claims aligned with the linked repositories.
- Add a new detail page only when the topic has enough useful, distinct content to justify it.

## Author

Okurut Maurice Leonard

- GitHub: [Mo-reece](https://github.com/Mo-reece)
- LinkedIn: [maurice-leonard-okurut](https://www.linkedin.com/in/maurice-leonard-okurut-26a048356)
