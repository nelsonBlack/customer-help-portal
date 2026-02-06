# Enterprise Plan: Angular Dashboard Help Portal

## 1. Objectives
- Provide seamless, contextual assistance to administrative users.
- Minimize support tickets via high-quality visual walkthroughs.
- Maintain Material 3 brand consistency across the main app and help portal.

## 2. User Flows
- **Flow A: General Exploration:** User navigates to `/help` from the sidebar to browse all guides.
- **Flow B: Contextual Assistance:** User clicks a `?` icon on the "Bulk Billing" screen and is deep-linked to the "Automated Billing Cycles" guide.
- **Flow C: Global Search:** User searches for "M-Pesa" in the SaaS header; search results from the Help Portal are displayed via a shared API/Search index.

## 3. Code Logic & Integration
- **`HelpService` (Angular):**
    - A singleton service that maps `ComponentID` (e.g., `PAYMENT_LIST`) to `PortalRoute` (e.g., `/billing/payments`).
    - Uses `window.open()` with targeted anchors to ensure the user lands on the exact paragraph needed.
- **Visual Asset Pipeline:**
    - Use headless browser scripts to take 1920x1080 screenshots of the running Angular app.
    - Post-processing script: Automatically draws red "Step Indicators" and arrows based on element coordinates.

## 4. UI/UX Strategy
- **Skinning Starlight:**
    - **Sidebar:** Matches the Angular `simple-sidenav` aesthetic.
    - **Cards:** Use `mat-card` equivalents with `rounded-xl` and deep soft shadows.
    - **Typography:** Uses Google Fonts (Roboto/Open Sans) to match the main application.
- **Interactive Elements:**
    - "Copy Config" buttons for any technical setup steps.
    - Expandable "Deep Dive" sections for complex Kenyan tax/utility laws.

## 5. Data Privacy & Obfuscation (Enterprise Standard)
- **Docs Mode Interceptor:**
    - Implement an Angular HTTP Interceptor that activates when `?docs_mode=true` is present in the URL.
    - This interceptor will parse GraphQL responses and replace PII (Names, Phone Numbers, Emails, Amounts) with dummy data.
- **Automatic Masking Script:**
    - The screenshot capture tool will use an image processing library (e.g., Sharp) to detect text regions and apply a subtle Gaussian blur to any fields identified as sensitive (M-Pesa transaction IDs, precise GPS coordinates).
- **Environment:**
    - Screenshots will be captured against a dedicated "Staging/Demo" database containing no real production data.