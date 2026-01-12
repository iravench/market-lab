# Gemini Context: Market Lab

## 1. Ground Truth
- **`README.md`**: Active Roadmap & Project Philosophy.
- **`docs/`**: Source of truth for math, design, and logic.

## 2. Core Loop (Mandates)
1. **Milestone First**: Identify active Phase in `README.md`. No phase = no dev.
2. **Doc-Driven**: Document new logic in `docs/` *before* implementation.
3. **Logic Testing**: All code in `src/logic/` requires unit tests. No exceptions.
4. **Zero Regression**: `npm test` must pass before every commit.

## 3. Structure
- `src/logic/`: Pure functions (Indicators, Math, Strategies).
- `src/scripts/`: CLI tools.
- `src/db/`: Persistence & Migrations.

## 4. Documentation Strategy
- Explain **WHY** in comments; explain **MATH/LOGIC** in `docs/`.
- Treat documentation as a first-class citizen.
