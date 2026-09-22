# AI Interview Prep Kit

An intelligent, full-stack application that transforms any job description into a personalized, comprehensive interview preparation kit conforming strictly to the **Trao Engineering Assessment (FS-AI-INTERVIEW-01)** specifications.

---

## 1. Project Overview & Tech Stack

The application autonomously researches the hiring company by crawling its website and discovering public interview discussions, extracts explicit role requirements from the job description, deterministically guarantees requirement coverage through an iterative second-pass loop, and arithmetically allocates a day-by-day preparation schedule. Candidates can reshape any portion of the generated kit in the Builder (preserving manual edits through section regenerations), practice flashcards using confidence-weighted spaced repetition, and simulate live mock interviews against an automated evaluation rubric.

### Tech Stack:
- **Frontend**: Next.js 14 (App Router) + Tailwind CSS + Lucide Icons
- **Backend**: Node.js + Express (TypeScript, NodeNext modules)
- **Database**: MongoDB (Mongoose with Atlas connection string)
- **Scraping / Crawling**: Resilient HTTP fetcher with exponential backoff, Cheerio HTML parser, heuristic dynamic link ranker, and Robots.txt compliance checker
- **LLM Provider**: Google Gemini (`gemini-2.0-flash`) via `@google/generative-ai` with token/request queue and rate-limiting exponential backoff; alternative provider Groq (`llama-3.3-70b-versatile`); plus built-in offline mock fallback for keyless local testing
- **Validation**: Strict Zod schema enforcing exact Appendix A and Appendix B schemas
- **Testing**: Vitest automated test suite protecting schedule allocation, deterministic coverage, Appendix A validation, and crawler link scoring

---

## 2. Setup Instructions & Batch Entry Point

### A. Quick Start from a Clean Clone

```bash
# 1. Install root dependencies
npm install

# 2. Install client dependencies
cd client && npm install && cd ..

# 3. Configure environment variables
# Copy .env.example to .env and provide your MongoDB URI and Gemini API key (optional for offline mode)
cp .env.example .env
```

### B. Mandatory Batch Entry Point (Section 9)

To run the pipeline across a batch of job descriptions without using the web UI:

```bash
npm run evaluate -- --input <cases.json> --output <kits.json>
```

*Alternative direct syntax:*
```bash
npx tsx scripts/evaluate.ts --input <cases.json> --output <kits.json>
```

**Features of the Batch Runner**:
- Reads an array of `{ id, jd, company_url, days }`.
- Executes the exact same end-to-end retrieval, generation, coverage-checking, and validation pipeline used by the application.
- Supports local development addresses (e.g. `http://localhost:8099/acme/`) without hardcoding host assumptions and follows relative links.
- Writes a formatted output JSON strictly matching Appendix B.
- Gracefully records individual case failures (e.g. `COMPANY_UNREACHABLE`) rather than aborting the batch run.
- Completed 5 cases within 15 minutes with exponential backoff handling rate limits.

### C. Running Automated Tests

```bash
npm test
```
Runs 18 automated tests across 5 test suites verifying:
- Deterministic arithmetic schedule allocation (exact day matching, must-have inclusion, difficulty front-loading, integer minutes).
- Deterministic coverage checker (gap identification, pass count tracking).
- Strict Appendix A structure validator (rejects float minutes, out-of-bounds difficulty, or unscheduled must-haves).
- Crawler link ranking and SSRF guards.

### D. Running the Full Application (Local Development)

```bash
# Run both backend server (port 5000) and Next.js frontend (port 3000) concurrently:
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) in your browser.

---

## 3. High-Level Architecture & Pipeline Sequencing

```
+-----------------------------------------------------------------------------+
|                               Next.js Frontend                              |
|   [Auth] -> [Dashboard / Batch Upload] -> [Builder] -> [Practice / Mock]   |
+-----------------------------------------------------------------------------+
                                       |
                                REST API / JWT
                                       v
+-----------------------------------------------------------------------------+
|                            Node.js Express Backend                          |
+-----------------------------------------------------------------------------+
                                       |
                   runPrepKitPipeline() Orchestrator
                                       |
  [Step 1] Crawl Site & Research (Link ranking, robots.txt, public discussions)
                                       |
  [Step 2] Parse Role & Classify Requirements (must vs nice, tech/behav/domain)
                                       |
  [Step 3] Synthesize Company Brief (honest report of products & hiring culture)
                                       |
  [Step 4] Generate Questions & Flashcards (distinct prompts by category)
                                       |
  [Step 5] DETERMINISTIC Coverage Check & Second-Pass Loop (closes must gaps)
                                       |
  [Step 6] DETERMINISTIC Arithmetic Schedule Allocation (front-loaded, exact days)
                                       |
  [Step 7] Strict Schema Validation (Appendix A Zod enforcement)
                                       |
                       +---------------+---------------+
                       |                               |
                       v                               v
             MongoDB Atlas Storage           Batch JSON Output File
```

### Sequencing Details (Why steps are separated):
1. **Pasted text needs no retrieval**: The job description is cleaned and pre-processed immediately.
2. **Company homepage crawling**: Crawled before synthesizing questions so questions reflect company engineering culture and known hiring stages.
3. **Requirement Extraction**: Handled strictly before question generation. Classifies requirements into `must` vs `nice` strictly based on posting wording (no hallucinated requirements).
4. **Category-Specific Generation**: Technical questions focus on internals, concurrency, and edge cases; behavioural questions focus on STAR leadership scenarios; system design questions focus on scalability and trade-offs. The models receive distinct, specialized instructions.
5. **Coverage Check (DETERMINISTIC)**: A pure TypeScript algorithm cross-references extracted requirement IDs against question `requirement_ids`. The LLM is NOT permitted to declare whether coverage succeeded.
6. **Second-Pass Loop**: If any must-have requirement lacks a question, a targeted second-pass generation call generates questions exclusively covering the gaps.
7. **Schedule Allocation (DETERMINISTIC)**: Pure code distributes questions across exactly `days_available` days, ensuring every must-have requirement is scheduled and higher-difficulty items land earlier.

---

## 4. Crawling & Retrieval Approach

- **Link Ranking without Hardcoding**: The crawler fetches the company homepage and dynamically inspects all links. It ranks them using an algorithmic scoring system that evaluates URL path tokens and anchor text keywords:
  - High weight: `hiring-process`, `how-we-hire`, `interview-process`, `handbook`, `careers`, `jobs`, `work-with-us`, `engineering-blog`.
  - Company weight: `about-us`, `mission`, `team`, `culture`, `technology`.
  - Penalty: `privacy`, `terms`, `login`, `pricing`, `cart`, `checkout`.
- **Relative Link Resolution**: Resolves relative paths (`/careers`, `../jobs`) accurately using base URL semantics.
- **Robots.txt Compliance**: Parses `/robots.txt` before fetching deeper links and respects Disallow directives.
- **Public Discussion Lookup**: Searches public discussion points regarding the company's interview rounds (Glassdoor, Reddit, engineering blogs) and extracts clean summaries.
- **SSRF Protection**: In production mode (`NODE_ENV=production`), private and loopback IP addresses (e.g. `127.0.0.1`, `10.0.0.0/8`, `192.168.0.0/16`, `localhost`) are blocked. In non-production/evaluation mode, local addresses (such as `http://localhost:8099/acme/`) are supported.
- **Content Cleaning**: Strips scripts, styles, iframes, navbars, footers, and tracking banners before passing clean text to the model.

---

## 5. The Builder: State Representation & Non-Destructive Regeneration

To satisfy Section 6 ("Regenerating one section must not discard edits the user has made elsewhere, and a question the user wrote or edited by hand must survive a regeneration of its category"):

### State Model:
Every question and flashcard maintains explicit provenance metadata:
```ts
{
  "id": "q1",
  "origin": "generated" | "edited" | "manual",
  "pinned": boolean
}
```
1. **`origin: "generated"`**: Produced untouched by the pipeline.
2. **`origin: "edited"`**: The user modified the prompt, answer outline, category, or difficulty inline in the UI.
3. **`origin: "manual"`**: The user clicked "+ Add Question" and wrote the item by hand.
4. **`pinned: true`**: The user clicked the pin icon on the card to protect it.

### Preservation Rules:
- When a user clicks **"Regenerate Category"** (e.g. for `technical` questions):
  1. Any question in that category where `origin === 'edited'`, `origin === 'manual'`, or `pinned === true` is **strictly preserved**.
  2. Only untouched generated questions (`origin === 'generated'` and `pinned === false`) are discarded and replaced with fresh questions.
  3. Questions in all other categories remain untouched.
  4. Company brief, role breakdown, and flashcards remain completely untouched.
  5. The coverage checker re-evaluates the revised question set, and the schedule is automatically re-allocated.

---

## 6. Deterministic Arithmetic Schedule Allocation

The schedule is allocated arithmetically without LLM intervention:
- **Exact Days**: Generates exactly `days_available` day entries (handles 1-day cram to 60-day extensive plans).
- **Front-Loaded Difficulty & Priority**: Questions are scored:
  - Must-have coverage: +100
  - Difficulty: `difficulty * 20` (Difficulty 3 = +60, Difficulty 2 = +40, Difficulty 1 = +20)
  - Category weight: System Design (+30), Technical (+25), Behavioural (+15), Company Fit (+10).
- Questions are sorted in descending order of score, ensuring challenging and critical must-have topics are placed on Day 1, Day 2, etc., while review and company alignment land on the final days.
- **Must-Have Guarantee**: Code verifies that every must-have requirement appears in at least one scheduled question.
- **Integer Minutes**: Each day calculates duration as the integer sum of its questions' estimated times (Difficulty 3: 25m, Difficulty 2: 15m, Difficulty 1: 10m), bounded to integer minutes.

---

## 7. Creative Feature: Live Mock Interview Simulator & Cheatsheet Export

### 1. Interactive Mock Interview Simulator with Live Rubric Scoring
- Accessible from any question card in the Builder.
- Candidates type or record their response to the prompt.
- The evaluation engine grades the candidate's answer against the benchmark answer outline and JD requirements across multiple dimensions:
  - **Technical / Domain Accuracy** (0-100)
  - **Communication & Structure** (STAR methodology evaluation, 0-100)
  - **Strengths** (bullet points of what was done well)
  - **Areas for Improvement** (actionable suggestions)
  - **Interviewer Follow-up Probe** (a sharp follow-up question replicating a real senior interviewer)

### 2. One-Click Printable / PDF Cheatsheet
- Formats the entire kit into a high-density, printable reference sheet (`window.print()` / PDF export) for last-minute review before the interview.

---

## 8. Handling Edge Cases & Failure Resilience

1. **Company URL is invalid, returns 404, or times out**:
   - The crawler attempts 3 retries with exponential backoff.
   - If unreachable, it records this honestly in `company_brief.sources` and proceeds using the job description alone, reporting honest gaps rather than failing the run.
2. **Company site has no discoverable hiring or about page**:
   - The brief states honestly: "No dedicated hiring page found on company site." The pipeline proceeds without fabricating hiring practices.
3. **Job description is a two-line stub**:
   - The extractor extracts only explicit facts without inventing requirements, resulting in an honest thin kit that accurately reflects the input.
4. **Public discussion turns up nothing**:
   - Reports: "No public interview discussions found for this company. Relying on company site and job description."
5. **Model rate limits (HTTP 429 / RESOURCE_EXHAUSTED)**:
   - Queued through `LLMRateLimiter` with exponential backoff and jitter (up to 5 retries, 2s..32s delay).
6. **1-Day vs 60-Day schedule**:
   - 1-Day: Schedules all must-have questions in an intensive cram session.
   - 60-Day: Schedules questions across days and allocates later days for spaced repetition drills and mock interviews.
7. **Prompt Injection in Crawled Pages**:
   - Web text is treated purely as passive data strings and isolated within explicit data delimiters. System prompts strictly instruct the model to ignore any instructions embedded in scraped text.

---

## 9. Environment Variables (.env.example)

```bash
# MongoDB Connection URI (e.g. MongoDB Atlas)
MONGODB_URI=mongodb+srv://...

# Application Port & Environment
PORT=5000
NODE_ENV=development
JWT_SECRET=your_jwt_secret_key

# LLM Provider: gemini | groq | mock
LLM_PROVIDER=gemini
GEMINI_API_KEY=your_google_gemini_api_key
GEMINI_MODEL=gemini-2.0-flash

# Optional Groq Provider
GROQ_API_KEY=
GROQ_MODEL=llama-3.3-70b-versatile

# Client Origin
CLIENT_URL=http://localhost:3000
```
