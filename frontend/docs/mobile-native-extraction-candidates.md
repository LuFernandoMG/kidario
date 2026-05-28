# Mobile Native Extraction Candidates

This document defines the first selective native extraction candidates for the WebView-first mobile roadmap.

## Candidate Matrix

| Flow | Value | Shell Pain | Native Complexity | Recommendation |
| --- | --- | --- | --- | --- |
| Unauthenticated entry / welcome surface | High | Medium | Low | Extract first |
| Password reset flow | Medium | Medium | Medium | Keep in shell for now |
| Parent chat thread | High | High | High | Defer until native auth/session exists |
| Teacher profile photo upload | High | Medium | Medium | Keep shell + native upload bridge |
| Parent explore discovery | High | Medium | High | Defer until there is evidence the shell is insufficient |
| Teacher control center | High | Medium | High | Defer |

## Selection Criteria

The first extracted native flow should:

- have high user visibility
- avoid duplicating backend contracts or auth/session logic
- improve mobile UX immediately
- reduce App Store review risk by giving the shell more native value
- remain reversible if the roadmap changes

## Current Recommendation

Extract the unauthenticated entry surface first.

Reason:

- it is the first impression of the mobile app
- it can route into the wrapped frontend without rebuilding product logic
- it does not require a native data layer
- it creates a clear boundary between native shell ownership and wrapped frontend ownership
