# Enterprise Plan: Flutter Mobile App Help System

## 1. Objectives
- Support field staff (Meter Readers/Technicians) in low-connectivity environments.
- Provide "Flash Guides" for hands-on tasks (e.g., "Replacing an Analog Meter").
- Ensure a unified "Help" experience between Mobile and Web.

## 2. User Flows
- **Flow A: In-App Help Overlays:** For first-time users, an interactive overlay (`OverlayPortal`) highlights the "Capture Photo" button.
- **Flow B: Offline How-To's:** A dedicated "Help" screen within the app that caches core Markdown guides for offline use.
- **Flow C: Remote Support:** A "Help" button in the Drawer that opens the Starlight Help Portal in a mobile-optimized WebView or External Browser.

## 3. Code Logic & Implementation
- **`DocumentationService` (Flutter):**
    - A service that fetches Markdown content from the central Starlight portal API and caches it locally using `sqflite` or `hive`.
    - Detects connectivity: If online, serves latest docs; if offline, serves cached version.
- **Visual Asset Pipeline:**
    - Use `flutter_driver` to capture mobile screenshots on various devices (iPhone 15, Galaxy S23).
    - Annotations: Highlight mobile gestures (e.g., "Swipe left to delete reading").

## 4. UI/UX Strategy
- **Material 3 Mobile:**
    - Uses `Theme.of(context).colorScheme` for native integration.
    - Guides are presented as "Scrollable Bottom Sheets" for quick reference without losing context of the current task.
- **Content Optimization:**
    - Large images and minimal text for readability under direct sunlight.
    - Bulleted checklists for field safety and accuracy.

## 5. Data Privacy & Obfuscation (Enterprise Standard)
- **Mock Implementation:**
    - For screenshot capturing, the app will be built with a `documentation` flavor.
    - This flavor uses a `MockRepository` that provides consistent, anonymized dummy data instead of fetching from production servers.
- **Annotation Overlay:**
    - Arrows and gesture highlights will be drawn using a custom painter to ensure they don't overlap with any (already anonymized) text.