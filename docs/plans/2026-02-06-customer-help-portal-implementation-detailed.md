# Enterprise End-User Help Portal Plan

## Phase 1: Visual Identity & Scaffolding
- [ ] **T1: Starlight Setup:** Initialize Astro/Starlight in `customer-help-portal/` on `feat/help-portal`.
- [ ] **T2: Material 3 Branding:** Apply `--mat-sys` tokens and `rounded-xl` styling to match the SaaS dashboard.
- [ ] **T3: Screenshot Service:** Setup a workflow to capture and store app screenshots in `src/assets/guides/`.

## Phase 2: Visual "How-To" Guides
- [ ] **T4: The "Admin Onboarding" Guide:** Visual walkthrough of setting up a new company.
- [ ] **T5: The "Meter Reading" Guide:** Step-by-step with screenshots showing the mobile-friendly reading capture flow.
- [ ] **T6: The "Billing & Payments" Guide:** High-resolution guide for generating bills and recording M-Pesa payments.

## Phase 3: SaaS App Integration
- [ ] **T7: Deep Linking:** Implementation of the `HelpService` in Angular for contextual redirecting.
- [ ] **T8: Global Help Access:** Add "Help & Support" to the SaaS header and sidebar.
- [ ] **T9: Feedback Loop:** Add a "Was this article helpful?" widget at the bottom of each guide.

## Phase 4: Enterprise Review
- [ ] **T10: Asset Annotation:** Add arrows and highlights to all screenshots using an image processing script.
- [ ] **T11: Search Verification:** Ensure all common end-user terms (e.g., "invoice", "tenant", "disconnect") return high-quality guides.
- [ ] **T12: Final Build:** Deploy as a static site and verify cross-domain navigation.
