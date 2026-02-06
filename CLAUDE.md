# CLAUDE.md - Workspace Master Context

**This is the ROOT context for the Analog Water / Real Estate Workspace.**

## 1. WORKSPACE STRUCTURE
*   **`frontend-analog-meter-project/`**: Angular 21 Frontend. Consumes BOTH backends.
    *   *Context File:* `frontend-analog-meter-project/CLAUDE.md`
*   **`analog-meter-project/`**: Water Billing Backend (NestJS, Port 3332).
    *   *Context File:* `analog-meter-project/CLAUDE.md`
*   **`realator_backend/`**: Real Estate Backend (NestJS, Port 3333).
    *   *Context File:* `realator_backend/CLAUDE.md`

## 2. GLOBAL "ULTRATHINK" PROTOCOL
**TRIGGER:** When the user prompts **"ULTRATHINK"**:
*   **Mode:** Holistic System Analysis.
*   **Scope:** Consider impacts across Frontend <-> Backend boundaries.
*   **Process:**
    1.  **Analyze Request:** Identify affected domains (Billing, Real Estate, or UI).
    2.  **Check Contracts:** Verify GraphQL schema alignment.
    3.  **Trace Data:** Follow data flow from Database -> API -> UI.
    4.  **Failure Analysis:** What if one backend is down? What if network fails?
*   **Output:** Comprehensive cross-stack solution.

## 3. QUICK NAVIGATION (Mental Map)
*   **Water Billing:**
    *   UI: `views/water-billing`
    *   API: `analog-meter-project`
    *   DB: `analogwater_prod_db` (:5434)
*   **Real Estate:**
    *   UI: `views/real-estate`
    *   API: `realator_backend`
    *   DB: `realator_local_db` (:5444)

## 4. CRITICAL RULES
1.  **Context Switching:** When moving between folders, READ the local `CLAUDE.md`.
2.  **Schema Sync:** Changes in Backend Entities -> GraphQL Schema -> Frontend `npm run generate:all`.
3.  **Ports:**
    *   Frontend: 4200
    *   Water API: 3332
    *   Real Estate API: 3333
