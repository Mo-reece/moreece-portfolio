# Maurice Leonard Okurut Portfolio Website

Responsive personal portfolio website for presenting data science, machine learning, and software projects to recruiters and collaborators.

## Purpose

This repository contains the source for my recruiter-facing portfolio. It is designed to make my work easy to scan, link each project back to GitHub, and provide a professional contact path for internships, junior developer roles, data analyst roles, and ML internship opportunities.

## Key Features

- Project gallery linking to selected GitHub repositories.
- Responsive single-page layout with sections for skills, projects, and contact.
- SEO and Open Graph metadata for clearer sharing on LinkedIn and search engines.
- Structured data for recruiter and search-engine discoverability.

## Tech Stack

- HTML5
- CSS3
- Vanilla JavaScript
- Font Awesome and Devicon assets

## Project Structure

```text
.
├── index.html
├── .gitignore
└── README.md
```

## Local Preview

Open `index.html` directly in a browser, or serve the folder with a local static server:

```bash
python -m http.server 8000
```

Then visit `http://localhost:8000`.

## Deployment

Live deployment:

- GitHub Pages: [https://mo-reece.github.io/moreece-portfolio/](https://mo-reece.github.io/moreece-portfolio/)

Recommended deployment targets:

- GitHub Pages for a simple static portfolio.
- Vercel or Netlify if custom domains, preview deployments, or form handling are needed.

## Recruiter Notes

This site should stay synchronized with the GitHub pinned repositories. When a project is improved, update the portfolio card with the stronger README, screenshots, live demo, and measurable results.

## Future Improvements

- Move embedded image assets into an `assets/` directory.
- Add a real Open Graph image file instead of relying only on metadata.
- Add project screenshots and live demo links for each featured repository.
- Add accessibility and Lighthouse checks before deployment.

## Author

Maurice Leonard Okurut  
GitHub: [Mo-reece](https://github.com/Mo-reece)  
LinkedIn: [maurice-leonard-okurut](https://www.linkedin.com/in/maurice-leonard-okurut)
