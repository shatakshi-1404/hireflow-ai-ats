"""Fictional demo data. All names, emails and companies are invented."""

import argparse
import os
import random
import sys
import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models import (
    ActivityLog,
    Application,
    Candidate,
    Interview,
    Job,
    StageHistory,
    User,
    Workspace,
)
from app.models.enums import (
    ApplicationStage as S,
)
from app.models.enums import (
    EmploymentType,
    InterviewStatus,
    InterviewType,
    JobStatus,
    UserRole,
)

DEMO_WORKSPACE = "Northwind Talent (Demo)"
DEMO_ADMIN = "demo-admin@example.com"
DEMO_RECRUITER = "demo-recruiter@example.com"
DEMO_VIEWER = "demo-viewer@example.com"
DEMO_EMAILS = [DEMO_ADMIN, DEMO_RECRUITER, DEMO_VIEWER]


class SeedError(RuntimeError):
    pass


FIRST = ["Aarav", "Meera", "Rohan", "Isha", "Kabir", "Ananya", "Vikram", "Sana", "Arjun", "Diya",
         "Liam", "Olivia", "Noah", "Emma", "Mateo", "Sofia", "Yuki", "Hana", "Omar", "Leila",
         "Chen", "Mei", "Ivan", "Elena", "Kofi", "Amara", "Lucas", "Chloe", "Ethan", "Zara"]
LAST = ["Sharma", "Iyer", "Kapoor", "Nair", "Verma", "Reddy", "Mehta", "Khan", "Gupta", "Bose",
        "Walker", "Brooks", "Rivera", "Santos", "Tanaka", "Sato", "Haddad", "Rahman", "Wei", "Lin",
        "Petrov", "Rossi", "Mensah", "Okafor", "Dubois", "Martin", "Fischer", "Novak", "Silva", "Ortiz"]
UNIVERSITIES = ["Riverside Institute of Technology", "Lakeview University", "Northfield College",
                "Summit Polytechnic", "Harborview University"]
SOURCES = ["LinkedIn", "Referral", "Careers page", "Job board", "Campus"]
INTERVIEWERS = ["Priya Nair", "Marcus Lee", "Sofia Alvarez", "Daniel Okoye"]

ARCHETYPES: dict[str, dict] = {
    "backend": {
        "titles": ["Backend Developer", "Software Engineer", "API Engineer"],
        "skills": ["python", "fastapi", "django", "postgresql", "sql", "docker", "redis", "aws",
                   "rest apis", "git"],
    },
    "frontend": {
        "titles": ["Frontend Developer", "UI Engineer", "Web Developer"],
        "skills": ["react", "typescript", "javascript", "tailwind css", "html", "css", "next.js",
                   "testing library", "git"],
    },
    "data": {
        "titles": ["Data Analyst", "Data Scientist", "ML Engineer"],
        "skills": ["python", "pandas", "sql", "scikit-learn", "machine learning", "statistics",
                   "airflow", "spark"],
    },
    "devops": {
        "titles": ["DevOps Engineer", "Site Reliability Engineer", "Platform Engineer"],
        "skills": ["docker", "kubernetes", "terraform", "aws", "linux", "ci/cd", "prometheus", "bash"],
    },
    "qa": {
        "titles": ["QA Engineer", "SDET", "Test Automation Engineer"],
        "skills": ["selenium", "pytest", "cypress", "test automation", "python", "api testing",
                   "jira", "sql"],
    },
}

JOBS = [
    dict(title="Senior Backend Engineer", department="Engineering", location="Remote (India)",
         archetype="backend", status=JobStatus.OPEN, min=4, max=9,
         required=["python", "postgresql", "rest apis"], preferred=["fastapi", "docker", "aws"],
         description="Design and operate the APIs behind our hiring products. You will own services end to end, from schema design to production monitoring."),
    dict(title="Frontend Engineer", department="Engineering", location="Bengaluru",
         archetype="frontend", status=JobStatus.OPEN, min=2, max=6,
         required=["react", "typescript", "css"], preferred=["tailwind css", "testing library"],
         description="Build accessible, fast interfaces for recruiters. You will work closely with design on component systems and data-heavy views."),
    dict(title="Data Analyst", department="Analytics", location="Hyderabad",
         archetype="data", status=JobStatus.OPEN, min=1, max=5,
         required=["sql", "python", "statistics"], preferred=["pandas", "airflow"],
         description="Turn recruitment data into decisions. You will build reports, define metrics and partner with product on experiments."),
    dict(title="DevOps Engineer", department="Platform", location="Remote (India)",
         archetype="devops", status=JobStatus.OPEN, min=3, max=8,
         required=["docker", "aws", "ci/cd"], preferred=["kubernetes", "terraform"],
         description="Own our delivery pipeline and cloud infrastructure, with a focus on reliability, cost and developer experience."),
    dict(title="QA Automation Engineer", department="Quality", location="Pune",
         archetype="qa", status=JobStatus.OPEN, min=2, max=6,
         required=["test automation", "python"], preferred=["cypress", "api testing"],
         description="Build and maintain automated test suites across API and UI layers, and help teams ship with confidence."),
    dict(title="Machine Learning Engineer", department="Analytics", location="Remote (India)",
         archetype="data", status=JobStatus.CLOSED, min=3, max=8,
         required=["python", "machine learning", "scikit-learn"], preferred=["spark"],
         description="Prototype and productionise ranking and classification models. This role has been filled."),
]

CHAIN = [S.APPLIED, S.SCREENING, S.SHORTLISTED, S.INTERVIEW, S.OFFER, S.HIRED]
FINAL_WEIGHTS = {
    S.APPLIED: 14, S.SCREENING: 14, S.SHORTLISTED: 10, S.INTERVIEW: 12,
    S.OFFER: 5, S.HIRED: 6, S.REJECTED: 25, S.WITHDRAWN: 6,
}


def _build_path(rng: random.Random, final: S) -> list[S]:
    """A stage path that obeys the workflow rules (single steps, reject/withdraw from active)."""
    if final in CHAIN:
        return CHAIN[: CHAIN.index(final) + 1]
    reached = rng.randint(0, 3)  # APPLIED..INTERVIEW
    return [*CHAIN[: reached + 1], final]


def _wipe_demo(db: Session) -> None:
    ws_ids = select(User.workspace_id).where(User.email.in_(DEMO_EMAILS))
    # Applications reference jobs with RESTRICT, so they must go before jobs.
    db.execute(delete(Application).where(Application.workspace_id.in_(ws_ids)))
    db.execute(delete(Job).where(Job.workspace_id.in_(ws_ids)))
    db.execute(delete(Workspace).where(Workspace.id.in_(ws_ids)))
    db.commit()


def seed(db: Session, *, password: str, reset: bool = False) -> dict[str, int]:
    exists = db.scalar(select(User.id).where(User.email.in_(DEMO_EMAILS)))
    if exists and not reset:
        raise SeedError("Demo data already exists. Re-run with --reset to replace it.")
    if exists:
        _wipe_demo(db)

    rng = random.Random(42)
    now = datetime.now(UTC)

    ws = Workspace(id=uuid.uuid4(), name=DEMO_WORKSPACE)
    db.add(ws)
    db.flush()
    pw_hash = hash_password(password)
    admin = User(workspace_id=ws.id, email=DEMO_ADMIN, full_name="Demo Admin",
                 password_hash=pw_hash, role=UserRole.ADMIN)
    recruiter = User(workspace_id=ws.id, email=DEMO_RECRUITER, full_name="Demo Recruiter",
                     password_hash=pw_hash, role=UserRole.RECRUITER)
    viewer = User(workspace_id=ws.id, email=DEMO_VIEWER, full_name="Demo Viewer",
                  password_hash=pw_hash, role=UserRole.VIEWER)
    db.add_all([admin, recruiter, viewer])
    db.flush()

    jobs: list[tuple[Job, str]] = []
    for spec in JOBS:
        created = now - timedelta(days=rng.randint(60, 95))
        job = Job(
            id=uuid.uuid4(), workspace_id=ws.id, title=spec["title"], department=spec["department"],
            location=spec["location"], employment_type=EmploymentType.FULL_TIME,
            description=spec["description"], required_skills=spec["required"],
            preferred_skills=spec["preferred"], min_experience=spec["min"], max_experience=spec["max"],
            status=spec["status"], created_by_id=admin.id, created_at=created,
            closed_at=now - timedelta(days=5) if spec["status"] == JobStatus.CLOSED else None,
        )
        jobs.append((job, spec["archetype"]))
    db.add_all(j for j, _ in jobs)
    db.flush()

    candidates: list[tuple[Candidate, str]] = []
    used_names: set[tuple[str, str]] = set()
    for i in range(40):
        arch = rng.choice(list(ARCHETYPES))
        while True:
            name = (rng.choice(FIRST), rng.choice(LAST))
            if name not in used_names:
                used_names.add(name)
                break
        pool = ARCHETYPES[arch]["skills"]
        cand = Candidate(
            id=uuid.uuid4(), workspace_id=ws.id, full_name=f"{name[0]} {name[1]}",
            email=f"{name[0]}.{name[1]}{i}@example.com".lower(),
            current_title=rng.choice(ARCHETYPES[arch]["titles"]),
            skills=rng.sample(pool, k=rng.randint(4, min(7, len(pool)))),
            years_experience=round(rng.uniform(0.5, 12), 1),
            experience_summary="Fictional demo profile generated for demonstration purposes.",
            education=[{"institution": rng.choice(UNIVERSITIES),
                        "degree": rng.choice(["B.Tech", "B.Sc", "M.Sc", "MCA"]),
                        "field_of_study": "Computer Science", "year": rng.randint(2008, 2025)}],
            source=rng.choice(SOURCES), created_by_id=recruiter.id,
            created_at=now - timedelta(days=rng.randint(4, 88), hours=rng.randint(0, 23)),
        )
        candidates.append((cand, arch))
    db.add_all(c for c, _ in candidates)
    db.flush()

    plans: list[dict] = []
    applications: list[Application] = []
    for idx, (cand, arch) in enumerate(candidates):
        if idx >= 34:  # the last few stay in the talent pool with no applications
            continue
        matching = [j for j, a in jobs if a == arch]
        chosen = [rng.choice(matching)]
        if rng.random() < 0.3:
            other = rng.choice([j for j, _ in jobs])
            if other.id != chosen[0].id:
                chosen.append(other)
        for job in chosen:
            span = now - cand.created_at
            applied_at = cand.created_at + timedelta(hours=1) + (span - timedelta(hours=1)) * rng.uniform(0.0, 0.8)
            final = rng.choices(list(FINAL_WEIGHTS), weights=list(FINAL_WEIGHTS.values()))[0]
            path = _build_path(rng, final)
            remaining = now - applied_at
            fractions = sorted(rng.uniform(0.05, 0.98) for _ in range(len(path) - 1))
            times = [applied_at] + [applied_at + remaining * f for f in fractions]
            app_ = Application(
                id=uuid.uuid4(), workspace_id=ws.id, candidate_id=cand.id, job_id=job.id,
                stage=final, applied_at=applied_at, stage_changed_at=times[-1],
            )
            applications.append(app_)
            plans.append({"app": app_, "cand": cand, "job": job, "path": path, "times": times})
    db.add_all(applications)
    db.flush()

    interviews = 0
    for cand, _ in candidates:
        db.add(ActivityLog(workspace_id=ws.id, actor_id=recruiter.id, action="candidate.created",
                           entity_type="candidate", entity_id=cand.id, candidate_id=cand.id,
                           created_at=cand.created_at))
    for p in plans:
        app_, cand, job, path, times = p["app"], p["cand"], p["job"], p["path"], p["times"]
        for step, (stage, ts) in enumerate(zip(path, times, strict=True)):
            db.add(StageHistory(
                workspace_id=ws.id, application_id=app_.id,
                from_stage=path[step - 1] if step else None, to_stage=stage,
                changed_by_id=recruiter.id, created_at=ts,
                reason="Not a fit for the current requirements" if stage == S.REJECTED else None,
            ))
            if step == 0:
                db.add(ActivityLog(workspace_id=ws.id, actor_id=recruiter.id,
                                   action="application.created", entity_type="application",
                                   entity_id=app_.id, candidate_id=cand.id, created_at=ts,
                                   details={"job_id": str(job.id), "job_title": job.title}))
            else:
                db.add(ActivityLog(workspace_id=ws.id, actor_id=recruiter.id,
                                   action="application.stage_changed", entity_type="application",
                                   entity_id=app_.id, candidate_id=cand.id, created_at=ts,
                                   details={"from": path[step - 1].value, "to": stage.value,
                                            "job_title": job.title}))

        if S.INTERVIEW in path:
            at = times[path.index(S.INTERVIEW)]
            if app_.stage == S.INTERVIEW and rng.random() < 0.7:
                when = now + timedelta(days=rng.randint(1, 10), hours=rng.randint(1, 8))
                status = InterviewStatus.SCHEDULED
            elif app_.stage == S.INTERVIEW:
                continue
            else:
                when = min(at + timedelta(hours=4), now - timedelta(hours=1))
                status = InterviewStatus.COMPLETED
            db.add(Interview(
                workspace_id=ws.id, application_id=app_.id,
                interviewer_name=rng.choice(INTERVIEWERS),
                interview_type=rng.choice([InterviewType.TECHNICAL, InterviewType.BEHAVIORAL,
                                           InterviewType.HR]),
                status=status, scheduled_at=when, duration_minutes=rng.choice([30, 45, 60]),
                meeting_link="https://meet.example.com/demo-room",
            ))
            interviews += 1
    db.commit()
    return {"users": 3, "jobs": len(jobs), "candidates": len(candidates),
            "applications": len(applications), "interviews": interviews}


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed fictional demo data")
    parser.add_argument("--reset", action="store_true", help="replace existing demo data")
    parser.add_argument("--allow-production", action="store_true")
    args = parser.parse_args()

    if get_settings().environment == "production" and not args.allow_production:
        sys.exit("Refusing to seed ENVIRONMENT=production without --allow-production")
    password = os.environ.get("SEED_PASSWORD", "demo-password-2026")
    with SessionLocal() as db:
        try:
            summary = seed(db, password=password, reset=args.reset)
        except SeedError as exc:
            sys.exit(str(exc))
    print("Seeded:", summary)
    print(f"Logins: {DEMO_ADMIN} / {DEMO_RECRUITER} / {DEMO_VIEWER}  (password: SEED_PASSWORD, "
          "default 'demo-password-2026')")


if __name__ == "__main__":
    main()
