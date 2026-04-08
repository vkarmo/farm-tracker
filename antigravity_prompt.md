# Antigravity Prompt: Farm Management System

You can copy and paste the following prompt to start your agentic workflow with Antigravity. It is specifically designed to leverage Antigravity's capabilities, tech stack preferences, and automated terminal handling.

***

**Copy the text below:**

```markdown
# Context & Objective
You are Antigravity, an expert agentic AI coding assistant. Your objective is to build a robust, premium, and offline-capable full-stack **Custom Farm Management System**. 

# Technology Stack
- **Frontend:** ReactJS (bootstrapped via Vite: `npx create-vite@latest . --template react`). 
- **State Management & Offline Capability:** Redux Toolkit paired with **Redux-Persist** for local data caching, combined with a **PWA Service Worker** strategy so the app functions seamlessly in fields with poor connectivity.
- **Database / Backend:** Neo4j Community Edition. Use the official Neo4j JavaScript driver (`neo4j-driver`). Design the system using a Graph DB approach to map farming relationships.
- **Styling:** Premium, modern Vanilla CSS (or modern styling solution) featuring a polished mobile-first interface, intuitive data-entry, and subtle micro-animations.  Use earthy green tones and natural colors.

# Core System Features 
Draw inspiration from industry standards like **farmOS** and **ShambaPro**:
1. **Asset Management:** Track distinct nodes like `Field`, `Crop`, `Livestock`, and `Equipment`. Include basic map/GIS placeholders for fields.
2. **Logs & Data-Entry:** Offline-ready forms to record `Activity` (e.g., seeding, harvesting, input application, observations).
3. **Financials & Analytics:** Track `Expense` and `Sale` transactions linked to specific fields or crops. 
4. **Relational Graph Power:** Leverage Neo4j to easily query relationships (e.g., `(Crop)-[:PLANTED_IN]->(Field)-[:HAD_ACTIVITY]->(Harvest)`).
5. **Sync Engine:** Implement a resilient syncing mechanism where offline data-entry is queued locally via Redux-Persist and pushes to the Neo4j backend when the connection is restored.

# Execution & Auto-Run Rules
1. **Automated Setup:** The terminal must be automated. When running setup commands (`npm install`, scaffolding, etc.), use non-interactive flags (e.g., `-y`), and configure your commands to run as smoothly as possible. 
2. If you create any internal workspace workflows for this project, include the `// turbo-all` annotation at the top to ensure commands auto-run without blocking on terminal approval.
3. **Workflow Phase:** Begin by creating a formal `implementation_plan.md` defining the Neo4j graph schema (Nodes & Edges) and the React PWA architecture. Once approved, execute the setup autonomously.

Please acknowledge this prompt and begin by scaffolding the React application and detailing the Neo4j Graph Schema in an implementation plan!
```
