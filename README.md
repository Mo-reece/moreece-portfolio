# Maurice Leonard Okurut Portfolio Website

Responsive personal portfolio website for presenting software, data, machine-learning, and automation projects to recruiters, clients, and collaborators.

## Purpose

This repository contains the source for my recruiter-facing portfolio. It is designed to make my work easy to scan, link each project back to GitHub, and provide a professional contact path for internships, junior developer roles, data analyst roles, and ML internship opportunities.

## Key Features

- Project gallery linking to selected repositories and available live demos.
- Responsive single-page layout with sections for skills, projects, and contact.
- SEO and Open Graph metadata for clearer sharing on LinkedIn and search engines.
- Structured data for recruiter and search-engine discoverability.
- Accessible mobile navigation, keyboard interactions, reduced-motion support, and touch-safe project actions.
- Privacy notice, crawler files, custom 404 page, security policy, and automated repository validation.

## Tech Stack

- HTML5
- CSS3
- Vanilla JavaScript
- Font Awesome and Devicon assets

## Project Structure

```text
.
├── index.html
├── privacy.html
├── 404.html
├── robots.txt
├── sitemap.xml
├── site.webmanifest
├── assets/
│   ├── favicon.svg
│   ├── og-image.jpg
│   └── portrait*.webp
├── scripts/
│   ├── validate_site.py
│   └── browser_audit.mjs
├── .github/workflows/quality.yml
├── SECURITY.md
└── README.md
```

## Local Preview

Open `index.html` directly in a browser, or serve the folder with a local static server:

```bash
python -m http.server 8000
```

Then visit `http://localhost:8000`.

## Validation

Run the dependency-free source checks before committing:

```bash
python scripts/validate_site.py
```

With Chrome installed, run responsive browser checks at 320, 390, 768, and 1440 pixels:

```bash
node scripts/browser_audit.mjs http://localhost:8000/index.html
```

Set `CHROME_PATH` when Chrome is installed outside the default Windows location. GitHub Actions runs the static validator on every push and pull request.

## Deployment

Live deployment:

- GitHub Pages: [https://mo-reece.github.io/moreece-portfolio/](https://mo-reece.github.io/moreece-portfolio/)

GitHub Pages deploys the root of `main`. Merge through a reviewed pull request after the `Site quality` workflow passes.

## Recruiter Notes

This site should stay synchronized with the GitHub pinned repositories. When a project is improved, update the portfolio card with the stronger README, screenshots, live demo, and measurable results.

## Content Maintenance

Keep project claims synchronized with their repositories. Prefer actual screenshots, live demos, measurable results, and concise problem/process/outcome summaries over generic descriptions.

## Author

Maurice Leonard Okurut  
GitHub: [Mo-reece](https://github.com/Mo-reece)  
LinkedIn: [maurice-leonard-okurut](https://www.linkedin.com/in/maurice-leonard-okurut)
