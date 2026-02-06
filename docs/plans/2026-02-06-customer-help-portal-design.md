# Design: Customer Help Portal (Standalone)

## Overview
A dedicated, developer-managed documentation site for customers/clients of the Analog Water SaaS platform. This portal will provide "How-to" guides, API documentation (if needed), and general platform help.

## Tech Stack
- **Framework:** [Astro](https://astro.build/) with [Starlight](https://starlight.astro.build/)
- **Content Format:** Markdown / MDX
- **Hosting Target:** To be determined (Likely served via a `/help` or `/docs` route on the main domain or a `docs.` subdomain)
- **Styling:** Tailwind CSS (matching the main project's aesthetic)

## Key Features
- **Search:** Built-in Pagefind search.
- **Navigation:** Hierarchical sidebar organized by feature (Water Billing, Real Estate, User Management).
- **Internationalization:** Ready for multi-language support.
- **Responsive:** Optimized for mobile and desktop.
- **Theme:** Material-inspired dark/light mode toggle.

## Architecture
The portal will reside in a new top-level directory `customer-help-portal` within the workspace. This keeps it isolated from the main application logic while allowing shared assets or scripts if necessary.

## User Flow
1. User clicks "Help" in the main Angular Application.
2. User is redirected to the public help portal.
3. User searches or navigates to a specific "How-to" guide.

## Design Alignment
- Rounded corners (xl) for any cards.
- Outlined variants for interactive elements.
- Material icons (matching the Angular app).
