# Coursepoint MVP verification — Phase 5F

Verified September 16, 2026 against the existing local React/Vite frontend, Express backend and configured Supabase project.

## Result

The requested Phase 5A–5F MVP flow passed. No blocking integration failures were found. Phase 5F required no backend implementation changes. Earlier uncommitted Phase 5E work was preserved.

## Phase 5F changes

- `client/src/pages/QuestionDetailPage.jsx`: passes the question author's ID to the answers section.
- `client/src/components/answers/AnswersSection.jsx`: author-only acceptance, authenticated POST/DELETE through the existing API helper, one pending lock across answer controls, immediate list/order/question-status updates, failure reconciliation and retry. Late responses cannot update a different question.
- `client/src/components/answers/AnswerCard.jsx`: accept/unaccept buttons for the question author, alongside the existing accepted badge and green highlight.
- `server/test/acceptance.test.js`: isolated HTTP tests for authentication, authorization, validation, switching accepted answers, unaccepting, missing answers and database failures.
- `client/test/acceptance.browser.mjs`: mocked acceptance UI regression tests, including concurrent clicks, failed writes, lost responses, partial backend writes and failed reconciliation.
- `client/test/live-mvp.browser.mjs`: real two-student browser flow.
- `client/test/live-resilience.browser.mjs`: real persisted-data, sorting, loading, network-outage recovery and layout checks.
- This report.

The pre-existing Phase 5E vote service, social components and vote tests remain in the working tree. They were not rebuilt or replaced.

## Real browser → Express → Supabase results

Two dedicated, confirmed test accounts were provisioned in Supabase for this run. Student A belongs to College of Business; Student B belongs to College of Computer Studies. Provisioning used the existing server-side administrative client; all student login/content actions in the full-flow test used the actual browser frontend. No API responses were mocked in that flow.

| Check | Result |
| --- | --- |
| A logs in; Home requests A's department | Passed |
| Explore requests the university-wide feed | Passed |
| Departments browses B's department | Passed |
| Global search, including no-match results | Passed |
| A creates a tagged Markdown question; correct Home card opens its detail | Passed |
| Logout persists on reload; B logs in to a different Home feed | Passed |
| B finds A's question through university-wide search | Passed |
| B posts an answer; answer count updates and form clears | Passed |
| B comments on both question and answer | Passed |
| B upvotes both; both own-vote states survive reload | Passed |
| B removes the question vote; count becomes zero and state clears | Passed |
| A logs back in and accepts B's answer | Passed |
| Accepted state persists after reload | Passed |
| A unaccepts and re-accepts | Passed |
| B sees no acceptance controls; direct authenticated POST and DELETE both return 403 | Passed |
| Markdown and highlighted JavaScript render in question and answer | Passed |
| Desktop (1440px) and mobile (390px); mobile navigation | Passed |
| Protected route redirects; unauthenticated backend request returns 401 | Passed |
| Real missing-question request displays the 404 page | Passed |
| Login persists after reload | Passed |
| Real newest/most-voted/unanswered feed requests and result checks | Passed |
| Delayed real request displays loading | Passed |
| Browser network outage displays feed/detail errors; retry reconnects | Passed |
| Browser JavaScript runtime exceptions | None |

The loading check briefly paused and then continued the original request. Network-failure checks used Chrome's offline mode and then restored connectivity; successful retries reached the real backend. Error-response edge cases were also covered separately by mocked regressions.

### Retained test data

- Question: `07d0c0e0-5786-455c-87e7-b8eec8420155`
- Answer: `63464a46-0596-4ec4-ad93-7df22207f76a`
- Final state: accepted answer, one comment on each target, question vote removed, answer vote retained.
- Run marker: `mu3tdyvn`.
- Accounts and labeled test content were retained for inspection. Credentials are stored only in the local mode-0600 file `/private/tmp/coursepoint-phase5f-accounts.json`; they are not in source control or this report.

## Automated verification

- `node --test server/test/*.test.js`: **13 tests passed**, including the existing vote tests. Database/auth responses in these HTTP tests are mocked. The deliberately injected database failure logs an expected server error.
- `npm run build` from `client/`: **passed**.
- Phase 5A feed regressions: **passed** (scoping, sorting, search, pagination, states, links, mobile).
- Phase 5B Ask Question regressions: **passed** (validation, departments/tags, authenticated submission, duplicate prevention, errors/retry, navigation).
- Phase 5C detail/Markdown regressions: **passed** (safe Markdown, code highlighting/copy, metadata, loading/404/errors, navigation).
- Phase 5D answer regressions: **passed** (loading/empty/errors, submission, Markdown, ordering, stale responses).
- Phase 5E comment/vote regressions: **passed** (both targets, validation, reload/removal, conflicts, lost responses, retries, stale responses).
- New Phase 5F acceptance browser regressions: **passed**.

### Rerunning browser checks

Start the frontend on port 5173 and the backend on port 4000. Start a separate Chrome profile with remote debugging on port 9223. Browser scripts use Node 22's native WebSocket support.

```sh
node client/test/acceptance.browser.mjs
COURSEPOINT_TEST_ACCOUNTS=/private/tmp/coursepoint-phase5f-accounts.json node client/test/live-mvp.browser.mjs
COURSEPOINT_TEST_ACCOUNTS=/private/tmp/coursepoint-phase5f-accounts.json node client/test/live-resilience.browser.mjs
```

The live script creates another real test question, answer, comments and votes. Run browser suites sequentially because they share browser local storage. The account file contains `{ "run": "unique-test-marker", "students": [A, B] }`; each student requires `email`, `password`, `full_name`, and `department.id`. The resilience script uses the test artifacts written by the live script.

Earlier Phase 5A–5E browser scripts remain under `/private/tmp/coursepoint-phase5e-*.mjs` from the existing work; they are local regression artifacts rather than repository test dependencies.

## Known limitations

- Existing authentication does not automatically refresh expired access tokens; a student must log in again when the session expires. Valid-session reload and logout persistence passed; token-expiry duration was not part of this short live run.
- Existing backend acceptance switches use two database writes. A failure between them can clear the previous acceptance. The frontend now re-reads the server state on failure and blocks further acceptance changes when that read also fails. Atomic database switching was not introduced in this frontend integration phase.
- Layouts were verified in desktop Chrome and mobile viewport emulation, not on physical mobile devices.

The MVP is ready for the requested functional scope, with these existing limitations recorded. No post-MVP features were added.
