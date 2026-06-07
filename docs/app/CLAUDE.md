# Web App Style Guide (Stitch Integrated)

## Design System Source
- **Primary Source:** `./design.MD` (Generated via Google Stitch)
- **Constraint:** All generated components must strictly adhere to the tokens defined in `design.md`.

## Implementation Rules
- **Framework:** React + Tailwind CSS
- **Styling:** Map Stitch design tokens to `tailwind.config.js`. 
- **Consistency:** Before creating any new UI, read `design.md` to ensure correct spacing, border-radius, and font-weights.
- **Components:** Favor modular, functional components that reflect the "Instant Prototype" layouts from Stitch.

## Claude Code + Stitch MCP
- If you need to regenerate designs, use the Stitch MCP: `claude mcp add stitch --transport http https://stitch.googleapis.com/mcp`
- Use Stitch to build visual foundations; use Claude for logic and state management.
