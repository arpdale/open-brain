# Approach

## Purpose

The Approach phase exists to prevent premature convergence.

Its job is to explicitly explore multiple viable solution paths **before** planning or implementation begins, especially for non-trivial product, UX, or architectural changes.

Approach is about *option evaluation*, not execution.

---

## When Approach Is Used

Approach is recommended when:
- Introducing a new feature or workflow
- Making non-trivial UX or interaction changes
- Refactoring flows that affect user behavior
- Changing data models, persistence, or system boundaries
- Confidence in the "obvious" solution is not clearly high

Approach may be skipped for:
- Small, mechanical changes
- Pure copy edits
- Isolated bug fixes with clear root cause
- Changes where alternatives are not meaningfully different

If Approach is skipped, the reason should be stated explicitly.

---

## What an Approach Must Include

An Approach proposal should include:

1. **Problem Restatement**
   - What is broken, misaligned, or limiting today
   - What outcome we are trying to achieve
   - Key constraints (UX, technical, risk, future flexibility)

2. **Multiple Viable Approaches**
   - At least **two** plausible solution paths
   - Approaches should be meaningfully different (not cosmetic variations)

3. **Tradeoff Analysis**
   For each approach, briefly assess:
   - UX implications (coercion vs agency, clarity vs interruption)
   - Technical complexity and risk
   - Impact on future extensibility
   - Alignment with product values

4. **Provisional Recommendation**
   - Recommend one approach
   - Clearly explain *why* it is preferred
   - Explicitly state why other approaches are not chosen (for now)

5. **Open Questions / Decisions**
   - Unknowns that need resolution before planning
   - Decisions that materially affect the implementation path

---

## What Approach Must NOT Include

Approach should **not** include:
- Task breakdowns
- File-level architecture
- Detailed schemas or APIs
- Code or pseudocode
- Implementation timelines

Those belong in Planning.

---

## Exit Criteria

Approach is complete when:
- A single direction is chosen with awareness of alternatives
- Tradeoffs are understood and accepted
- Remaining unknowns are clearly identified

Only after this should Planning begin.

---

## Relationship to Other Phases

- **Discovery** answers: "Do we understand the problem?"
- **Approach** answers: "What are the reasonable ways to solve it?"
- **Planning** answers: "How do we execute the chosen approach safely?"

Approach may follow Discovery, or may be entered directly if the problem is already understood.

---

## Guiding Principle

If a solution feels "obvious" too quickly, that is often a signal that Approach is needed.
