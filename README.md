# The AI Interview Prep Kit

> **Assessment ID**: FS-AI-INTERVIEW-01 | **Candidate Submission**  
> An autonomous interview preparation platform that extracts verified job requirements, crawls target company hiring intelligence, validates question coverage through a deterministic second-pass loop, and generates an arithmetic day-by-day study schedule.

---

## 1. Project Overview & Tech Stack

| Tier | Technology | Rationale & Justification |
| :--- | :--- | :--- |
| **Frontend** | **Next.js 14 (App Router) + Tailwind CSS** | Server & Client component separation, zero-bloat modern UI, high responsiveness, and native keyboard navigation. |
| **Backend** | **Node.js + Express (TypeScript)** | Clean layered architecture separating crawler retrieval, LLM generation, deterministic calculations, and storage. |
| **Database** | **MongoDB (Mongoose) + Resilient In-Memory/JSON Fallback** | Production MongoDB schema support paired with a zero-config local storage fallback (`fallbackStore.ts`) so that `npm run evaluate`, CI/CD, and local runs execute with zero external database dependencies. |
| **Web Crawler** | **Native Fetch + Cheerio + RobotsParser** | Custom crawler enforcing SSRF IP blocking, `robots.txt` compliance, link-ranking heuristics for hiring pages, and 2MB payload limits. |
| **LLM Engine** | **Google Gemini 2.0 Flash (Free Tier) / Groq / OpenAI Compatible** | Lightning-fast inference on Google's free tier, token-bucket rate limiting with exponential backoff on HTTP 429 ("slow down"), and an offline deterministic fallback engine. |

---

## 2. Setup & Execution Instructions

### Prerequisites
- Node.js `v20+` or `v22+`
- npm `v10+`

### Local Installation
```bash
# 1. Clone repository
git clone <repository-url>
cd interview-ai

# 2. Install all workspace dependencies
npm install

# 3. Configure environment variables (optional; works out of the box with defaults)
cp .env.example .env
```

### Running the Mandatory Batch Entry Point (Section 9)
Run the evaluator over any batch test cases file:
```bash
npm run evaluate -- --input test_cases.json --output test_kits.json
```
- Reads an array of `{ id, jd, company_url, days }`.
- Permitted to access local hosts (e.g., `http://localhost:8099/acme/`).
- Outputs an exact Appendix B JSON document with `version: "1.0"`, `generated_at`, and `kits`.
- Continues past individual failures, recording failure status without aborting.

### Running Automated Test Suite (Section 14)
```bash
npm test
```
Runs 15+ automated unit tests covering:
- Deterministic arithmetic day allocation (1-day crunch to 60-day horizons, integer minutes).
- Deterministic coverage checker & second-pass loop gap closure.
- Appendix A schema validation (Zod).
- Honest extraction of 2-line stub JDs without hallucinations.
- SSRF prevention & heuristic link ranker.

### Running the Full-Stack Application
```bash
# Start both Backend (:5000) and Frontend (:3000) concurrently:
npm run dev

# Or run separately:
npm run dev:server    # http://localhost:5000
npm run dev:client    # http://localhost:3000
```

---

## 3. High-Level Architecture & Pipeline Sequencing

```
                  ┌──────────────────────────────────────────────┐
                  │          Pasted JD & Company URL             │
                  └──────────────────────┬───────────────────────┘
                                         │
                 ┌───────────────────────┴───────────────────────┐
                 │                                               │
                 ▼                                               ▼
   [Step 1: Role Extraction]                       [Step 2: Intelligent Crawler]
   Extracts title, seniority,                      Validates SSRF & checks robots.txt,
   must vs nice requirements                      crawls domain, heuristic link ranker
   (r1, r2, ... no hallucinations)                 for /careers, /jobs, /handbook
                 │                                               │
                 └───────────────────────┬───────────────────────┘
                                         ▼
                          [Step 3: Public Discussion]
                          Glassdoor & community review retrieval
                                         │
                                         ▼
                          [Step 4: Company Brief Synthesis]
                          Summary, what they do, and hiring culture
                                         │
                                         ▼
                          [Step 5: Multi-Category Questions]
                          Distinct prompts & criteria for Technical,
                          System Design, Behavioural, Company Fit
                                         │
                                         ▼
                          [Step 6: Flashcards Generation]
                          High-yield concept checks linked to req IDs
                                         │
                                         ▼
                       [Step 7: Deterministic Coverage Check]
                       Code-based comparison (NOT model opinion).
                       Are any "must" requirements uncovered?
                                  │               ▲
                         [Gap Found]              │ [Second Pass: Max 2]
                                  ▼               │
                       [Targeted Question Generation for Gaps]
                                  │
                           [All Musts Covered]
                                  ▼
                       [Step 8: Deterministic Arithmetic Schedule]
                       Harder & must-haves earlier, integer minutes,
                       exactly matches days_available requested.
                                  │
                                  ▼
                       [Step 9: Appendix A Validation (Zod)]
```

### Why Deliberate Sequencing Matters (Section 3)
1. **Pasted text needs no retrieval**: The job description is already present. Parsing it first yields the exact list of requirements before touching the network.
2. **Company homepage requires crawling**: A single homepage rarely describes interview questions. The crawler scores discovered links using regex heuristics (`/careers`, `/hiring-process`, `/engineering-handbook`) and fetches high-value pages.
3. **Company context shapes question categories**: A company with public hiring notes detailing take-homes or architecture reviews dictates more system design emphasis.
4. **Separate prompts for separate concerns**: Technical requirements like *5+ years with React* need deep coding and concurrency questions, whereas *mentoring junior engineers* requires STAR-method behavioural prompts. They are never conflated into a single monolithic call.
5. **Deterministic Steps**: Coverage gap analysis and day-by-day arithmetic allocation are written **purely in code**. The LLM is never allowed to guess dates or determine whether requirements are mathematically satisfied.

---

## 4. The Builder: State Representation & Preservation (Section 6)

### The Problem
When a user customizes their prep kit (edits a prompt, rewrites an outline, moves a question to another category, pins a card, or adds a custom question), clicking **"Regenerate Category"** must **NOT** clobber their work.

### The Solution: Origin State Tracking
Every question and flashcard maintains an explicit `origin` attribute:
```typescript
origin: 'generated' | 'edited' | 'pinned' | 'custom'
```
- **`generated`**: Fresh question produced by the AI pipeline.
- **`edited`**: User clicked inline and modified the prompt, outline, or difficulty.
- **`pinned`**: User explicitly locked the question.
- **`custom`**: User added the question manually.

When the user regenerates a category (e.g., `questions:technical`):
```typescript
const preservedQuestions = kit.questions.filter(q =>
  q.category !== targetCategory ||
  q.origin === 'edited' ||
  q.origin === 'pinned' ||
  q.origin === 'custom'
);
```
Only unedited `generated` questions in that specific category are replaced. All manual edits, pins, custom additions, other question categories, flashcards, and the company brief remain **100% intact**. After regeneration, the deterministic coverage checker and schedule allocator re-run to maintain kit integrity.

---

## 5. Arithmetic Schedule Allocation Algorithm (Section 8)

The schedule is allocated purely through arithmetic in [`scheduleAllocator.ts`](server/src/services/pipeline/scheduleAllocator.ts):

1. **Question Weighting**:
   $$\text{Weight} = (\text{isMust} ? 20 : 5) + (\text{difficulty} \times 10)$$
   Questions targeting must-have requirements and difficulty 3 land on earlier days.
2. **Day Partitioning**:
   - For $N$ days, the questions are partitioned such that earlier days receive high-weight questions.
   - For 1-day crunches, all questions are concentrated into an intensive review block.
   - For long horizons (e.g., 60 days), core topics are scheduled first, followed by revision and mock drills.
3. **Integer Durations**:
   Each question contributes an integer minute duration (15m for diff 1, 25m for diff 2, 35m for diff 3). No floats or vague text.
4. **Must-Have Invariant**:
   A deterministic check ensures that every must-have requirement has at least one associated question scheduled.

---

## 6. Practice Mode & Spaced Repetition (Section 7)

Flashcards can be reviewed in an interactive 3D study interface with full keyboard controls (`Space` to flip, `1` Again/Hard, `2` Good, `3` Easy, `← / →` Navigate).

### Next Session Ordering Defense
Subsequent practice sessions order the deck by **weakest spots first**:
$$\text{Priority} = \text{Confidence Score (1 = Hard, 2 = Good, 2.5 = Unseen, 3 = Mastered)}$$
This ensures the candidate immediately spends their limited preparation time drilling concepts they rated lowest, rather than wasting time re-reading material they have already mastered.

---

## 7. Creative Features

### Feature 1: AI Mock Interview Simulator Drill
Candidates don't just read questions—they practice answering them. In the Kit Builder, clicking **"AI Mock Drill"** opens an interactive simulator where the candidate types or speaks their response. The backend evaluates their answer against the generated `answer_outline`, providing:
- A numerical score (0 to 100) and rating (Strong / Adequate / Needs Work).
- Explicit strengths identified.
- Key missing technical points or unaddressed trade-offs.
- A concise "Coach Tip" for how to deliver the answer.

### Feature 2: Printable One-Pager Interview Cheatsheet
Clicking **"Cheatsheet"** formats the entire kit into a clean, printable PDF / HTML document ready for review 30 minutes before the interview begins.

---

## 8. Edge Cases, Failure Handling & Security

| Scenario | Handling Strategy |
| :--- | :--- |
| **Invalid Company URL / 404 / Timeout** | Crawler records failure in `crawlerResult.errors` without crashing; pipeline continues with an honest brief stating limited domain data was discoverable. |
| **No Discoverable Hiring Page** | Honest fallback brief; does not invent interview stages. |
| **Two-Line Stub JD** | Requirement extractor extracts only the literal requirements present and produces a thin kit rather than hallucinating competencies. |
| **LLM Rate Limits (HTTP 429)** | `RateLimiter` enforces exponential backoff with random jitter across 4 retry attempts. If provider is offline, deterministic rule-based extractor steps in. |
| **Invalid JSON from LLM** | Zod validator catches missing fields; markdown code fences are automatically stripped; fallback generator triggers on syntax failure. |
| **SSRF Security (Section 11)** | `urlGuard.ts` parses URLs and blocks loopback, link-local metadata (`169.254.169.254`), and private subnets (`10.0.0.0/8`, `192.168.0.0/16`) in production while allowing local test servers in evaluation mode. |
| **Prompt Injection Defense** | All scraped web text and pasted JDs are wrapped inside `<UNTRUSTED_CONTENT>` tags with explicit system directives treating them purely as data. |
| **1-Day vs 60-Day Schedules** | Scaled arithmetically: 1 day concentrates topics into an intensive review block; 60 days distributes topics with revision cycles. |

---

## 9. Appendix Compliance

- **Appendix A**: Strict Zod schema validation in [`kitValidator.ts`](server/src/services/pipeline/kitValidator.ts) guarantees matching keys (`source`, `company_brief`, `role`, `questions`, `flashcards`, `schedule`, `coverage`), integer minutes, and valid difficulty levels (1..3).
- **Appendix B**: Batch evaluator produces exact JSON shape with `version: "1.0"`, `generated_at`, and `kits` array.
