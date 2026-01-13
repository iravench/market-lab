# Gemini Context: Market Lab

## 1. Ground Truth
Always start with establishing ground truth by ingesting following sources:
- **`README.md`**: Project summary, philosophy, architecture, roadmap, setup instructions and usage.
- **`docs/`**: Source of truth for math, design, logic and feature proposals.

## 2. Development Mandates
1. **Milestone First**: Identify active Phase in `README.md`. No phase = no dev.
2. **Doc-Driven**: Document new/updated logic in `docs/` *before* implementation.
3. **Logic Testing**: All code in `src/logic/` and `src/services/` requires unit tests. No exceptions.
4. **Zero Regression**: `npm test` must pass before every commit.

## 3. Folder Structure
- `docs/`: Source of truth for math, design, and architecture.
- `src/logic/`: Pure functions (Indicators, Math, Strategies).
- `src/services/`: External API integrations (Market Data).
- `src/scripts/`: CLI entry points for user interaction.
- `src/db/`: Persistence & Migrations.

## 4. Documentation Strategy
- Explain **WHY** in comments, short and concise.
- Document without low level implementation details in `docs/`.

## 5. Other Rules
- Use Context7 MCP when I need library/API documentation, code generation, setup or configuration steps without me having to explicitly ask.
