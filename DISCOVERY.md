# DISCOVERY

This document defines when discovery is required and what must be produced before planning begins.

Discovery exists to reduce hidden assumptions, surface unknowns, and prevent premature solutioning.

Discovery is a **gate**, not a role.

---

## When Discovery Is Required

A Discovery step is required **before planning** whenever a change is not obviously trivial.

Discovery **must** be run when a change:

- Introduces a new feature or capability
- Refactors or modifies existing behavior
- Touches data models, persistence, or migrations
- Affects authentication, authorization, or security
- Involves infrastructure, background jobs, or integrations
- Impacts multiple components, services, or workflows
- Has a reasonable chance of hidden constraints or side effects

Discovery **may be skipped** only for clearly trivial, mechanical changes, such as:

- Typos or copy edits
- Purely visual tweaks with no behavioral impact
- Obvious one-line fixes with a known, localized cause

When in doubt, discovery is required.

---

## Discovery Output (Required Artifact)

When discovery is run, it must produce **only** the following artifact.

No planning, solutions, or code may be proposed during discovery.

### Discovery Summary

- **Change summary**
  1–2 sentences describing the requested change.

- **System areas involved**
  Files, components, services, or subsystems that may be affected.

- **Known facts**
  Things verified by directly inspecting code, configuration, or documentation
  (facts, not inferences).

- **Assumptions**
  Things believed to be true but not yet verified.
  Assumptions must be explicit and falsifiable.

- **Unknowns**
  Gaps in understanding that could materially affect scope, approach, or risk.

- **Discovery required**
  YES / NO

- **Reason**
  Short justification for the decision above.

---

## Go / No-Go Rules

Discovery is **required** if any of the following are true:

- Initial confidence is not clearly high
- At least one assumption exists
- At least one unknown exists
- The change involves data, security, infrastructure, or user-visible behavior
- More than one subsystem may be affected
- Relevant code or configuration has not been directly inspected

Discovery is **not required** only if all of the following are true:

- Initial confidence is high
- Assumptions = 0
- Unknowns = 0
- The change is local, mechanical, and well understood

---

## Behavioral Constraints

- Discovery produces **only** the Discovery Summary
- Do not propose plans, solutions, or code during discovery
- If Discovery Required = YES, stop and ask whether to proceed
- Planning may begin only after assumptions and unknowns are resolved or explicitly accepted
- If multiple solution paths are plausible, proceed to Approach before Planning

Discovery work consists of inspection, verification, and summarization — not design.
