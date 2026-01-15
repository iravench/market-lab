# GEMINI Project Context for `Market Lab`

## 1. Ground Truth
Always start with establishing ground truth by ingesting following sources:
- **`README.md`**: Project summary, philosophy, architecture, roadmap, setup instructions and usage.
- **`docs/`**: Source of truth for math, design, logic and feature proposals.

## 2. Folder Structure
- `docs/`: Source of truth for knowledge: math, design, logic, variarious proposals(some might not make it to final implementation) and architecture.
- `src/logic/`: market indicators, math functions, trading strategies, regime profiling, risk management, portfolio optimization and backtesting.
- `src/services/`: External API integrations (Market Data).
- `src/scripts/`: CLI entry points for user interaction.
- `src/db/`: Persistence & Migrations.

## 3. Development Mandates
1. **Milestone First**: Identify active Milestone/Development Phase from `README.md` roadmap section. No active phase = no dev.
2. **Doc-Driven**: Document logic/knowledge in `docs/` *before* implementation. And keep them consistent, up-to-date and without duplications.
3. **Engineering Mandates**: Follow @./software_engineering_protocol.md
