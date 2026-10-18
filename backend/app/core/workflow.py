from app.models.enums import ApplicationStage as S

TRANSITIONS: dict[S, frozenset[S]] = {
    S.APPLIED: frozenset({S.SCREENING, S.REJECTED, S.WITHDRAWN}),
    S.SCREENING: frozenset({S.APPLIED, S.SHORTLISTED, S.REJECTED, S.WITHDRAWN}),
    S.SHORTLISTED: frozenset({S.SCREENING, S.INTERVIEW, S.REJECTED, S.WITHDRAWN}),
    S.INTERVIEW: frozenset({S.SHORTLISTED, S.OFFER, S.REJECTED, S.WITHDRAWN}),
    S.OFFER: frozenset({S.INTERVIEW, S.HIRED, S.REJECTED, S.WITHDRAWN}),
    S.HIRED: frozenset(),
    S.REJECTED: frozenset({S.SCREENING}),
    S.WITHDRAWN: frozenset({S.SCREENING}),
}

# "Active" = still moving through the funnel. HIRED/REJECTED/WITHDRAWN are closed.
ACTIVE_STAGES = frozenset({S.APPLIED, S.SCREENING, S.SHORTLISTED, S.INTERVIEW, S.OFFER})
REOPEN_FROM = frozenset({S.REJECTED, S.WITHDRAWN})


def allowed_next(stage: S) -> list[S]:
    return [s for s in S if s in TRANSITIONS[stage]]
