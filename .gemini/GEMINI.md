# Gemini Context: Market Lab

## 1. Context Loading Strategy
*   **Primary Source:** `README.md` contains the active Roadmap, Philosophy, and "Follow the Loop" guidelines. **Read it first.**
*   **Knowledge Base:** `docs/` contains the source of truth for Math, Design, and Logic. Consult specific files in `docs/` before implementing related features.

## 2. Agent Workflow Mandates
*   **Milestone Awareness:** Always identify the current active Roadmap phase from `README.md`.
*   **Doc-Driven Dev:** If a task involves new logic (math, strategy), ensure it is documented in `docs/` *before* or *during* implementation.
*   **Testing:** `src/logic/` is the core. All changes there require unit tests.

## 3. Quick References
*   `src/logic/` -> Pure functions (Indicators, Math).
*   `src/scripts/` -> CLI Entry points.
