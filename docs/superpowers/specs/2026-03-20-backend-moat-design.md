# Spec: Backend Multi-Agent Memory Engine Moat

## 1. Overview
The current system runs `ts-fsrs` and `ai-agent-team` primarily on the frontend or poorly integrated in the cloud. A true moat for an educational app must run learning state updates and agentic generation reliably on the backend. This ensures offline sync works properly across devices, mitigates client tampering, and creates a powerful data flywheel (e.g. tracking aggregate difficulty of a question).

## 2. Approach
We will shift the paradigm from "dumb CRUD backend" to "Intelligent Engine Backend".
- **Laf Backend Dependencies**: Install `ts-fsrs` and `ai-agent-team` in `laf-backend`.
- **FSRS Core Service**: Extract the FSRS logic into a dedicated `services/fsrs.service.ts` in the backend to manage scheduling.
- **AI Agent Orchestration**: Move the AI Tutor / AI Companion logic to backend workers (using `ai-agent-team`), creating endpoints where the client just sends "Submit Answer" and receives "Grade + FSRS Schedule + AI Tutor feedback" synchronously.

## 3. Architecture Details
- **Data Flow**:
  1. Frontend sends answer to `POST /submit-answer`
  2. Backend evaluates correct/incorrect.
  3. Backend FSRS Service updates the card's memory state in DB.
  4. Backend Multi-Agent Service observes the mistake and generates a personalized feedback note using the student's learning history.
  5. Backend returns `{ schedule, tutor_feedback, result }`.

## 4. Execution Plan
1. **Dependencies**: Add `ts-fsrs` and `ai-agent-team` to `laf-backend/package.json`.
2. **Service Layer**: Create `laf-backend/functions/_shared/services/fsrs.service.ts` and `agent.service.ts` to implement clean service architecture instead of dumping logic into function handlers.
3. **Endpoint Upgrades**: Refactor `answer-submit.ts` to consume these new services.
4. **Agent Prompts**: Define the Teacher/Tutor agent personas in the backend.
