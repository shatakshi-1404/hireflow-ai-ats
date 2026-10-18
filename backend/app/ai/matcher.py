"""Deterministic, explainable candidate-to-job matching.

score = 100 * sum(value_i * w_i) / sum(w_i), over components that could be assessed:
  required skills   share of required skills evidenced in the resume text or profile
  preferred skills  same, for preferred skills
  text relevance    TF-IDF cosine(job text, resume text), divided by a saturation constant, capped at 1
  experience fit    1.0 inside or above the job's range; years/min below it
Components that cannot be assessed are excluded and the remaining weights renormalised.
Missing information lowers confidence, never the candidate: it is reported as unverified."""

from dataclasses import dataclass

from app.ai.skills import canonical, find_skill
from app.core.config import get_settings
from app.schemas.ai import (
    CandidateInput,
    ExperienceEvidence,
    JobInput,
    MatchComponent,
    MatchDetail,
    SkillEvidence,
    UnverifiedSkill,
)

UNVERIFIED_NOTE = (
    "Not found in the profile skills or resume text. This does not mean the candidate lacks it."
)
DISCLAIMER = (
    "This is a keyword and text-similarity heuristic to help you prioritise review. "
    "It is not a prediction of job performance, and the hiring decision stays with you."
)
METHOD = (
    "Weighted average of up to four components: required-skill coverage, preferred-skill coverage, "
    "TF-IDF text similarity between the job and the resume (scaled by a saturation constant), and "
    "experience fit. Components that cannot be assessed are left out and the remaining weights are "
    "renormalised. Experience above the job's range is not penalised. No personal attributes "
    "(name, photo, gender, age, etc.) are used as inputs."
)


@dataclass(frozen=True)
class MatchWeights:
    required: float
    preferred: float
    text: float
    experience: float
    text_saturation: float


def weights_from_settings() -> MatchWeights:
    s = get_settings()
    return MatchWeights(
        required=s.match_weight_required,
        preferred=s.match_weight_preferred,
        text=s.match_weight_text,
        experience=s.match_weight_experience,
        text_saturation=s.match_text_saturation,
    )


def _text_similarity(a: str, b: str) -> float | None:
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity

    try:
        matrix = TfidfVectorizer(stop_words="english", sublinear_tf=True).fit_transform([a, b])
    except ValueError:  # empty vocabulary
        return None
    return float(cosine_similarity(matrix[0], matrix[1])[0][0])


def _experience_fit(years: float | None, lo: float | None, hi: float | None) -> float | None:
    if years is None or (lo is None and hi is None):
        return None
    if lo is not None and lo > 0 and years < lo:
        return max(0.0, years / lo)
    return 1.0


def compute_match(candidate: CandidateInput, job: JobInput, weights: MatchWeights) -> MatchDetail:
    warnings: list[str] = []
    resume_text = (candidate.resume_text or "").strip()
    if not resume_text:
        warnings.append(
            "No resume text is on file for this candidate. Skills are matched against the "
            "recruiter-entered profile only, so missing skills are unverified, not absent."
        )
    profile_skills = {canonical(s) for s in candidate.skills}

    def assess(skills: list[str]) -> tuple[list[SkillEvidence], list[UnverifiedSkill]]:
        matched: list[SkillEvidence] = []
        unverified: list[UnverifiedSkill] = []
        seen: set[str] = set()
        for raw in skills:
            skill = canonical(raw)
            if not skill or skill in seen:
                continue
            seen.add(skill)
            snip = find_skill(resume_text, skill) if resume_text else None
            if snip:
                matched.append(SkillEvidence(skill=skill, source="resume", evidence=snip))
            elif skill in profile_skills:
                matched.append(SkillEvidence(skill=skill, source="profile"))
            else:
                unverified.append(UnverifiedSkill(skill=skill, note=UNVERIFIED_NOTE))
        return matched, unverified

    m_req, u_req = assess(job.required_skills)
    m_pref, u_pref = assess(job.preferred_skills)

    def coverage(m: list[SkillEvidence], u: list[UnverifiedSkill]) -> tuple[float | None, str]:
        total = len(m) + len(u)
        if total == 0:
            return None, "The job lists none"
        return len(m) / total, f"{len(m)} of {total} evidenced"

    req_value, req_detail = coverage(m_req, u_req)
    pref_value, pref_detail = coverage(m_pref, u_pref)

    profile_text = " ".join(filter(None, [candidate.current_title, candidate.summary])).strip()
    cand_text = resume_text or profile_text
    text_value: float | None = None
    text_detail = "No candidate text is available to compare"
    if len(cand_text) >= 20:
        job_text = " ".join(
            [job.title, job.description, *job.required_skills, *job.preferred_skills]
        )
        sim = _text_similarity(job_text, cand_text)
        if sim is not None:
            text_value = min(1.0, sim / weights.text_saturation)
            source = "resume" if resume_text else "profile summary"
            text_detail = (
                f"TF-IDF cosine {sim:.2f} against the {source}, scaled by {weights.text_saturation}"
            )
    if cand_text and not resume_text and text_value is not None:
        warnings.append("Text relevance used the profile summary because no resume text is on file.")

    exp_value = _experience_fit(candidate.years_experience, job.min_experience, job.max_experience)
    if candidate.years_experience is None:
        exp_note = "Years of experience are not recorded, so experience was not assessed."
    elif job.min_experience is None and job.max_experience is None:
        exp_note = "The job sets no experience range."
    else:
        exp_note = f"Candidate: {candidate.years_experience} yrs. Job range: {job.min_experience}–{job.max_experience}."

    raw = [
        ("required_skills", "Required skills", req_value, weights.required, req_detail),
        ("preferred_skills", "Preferred skills", pref_value, weights.preferred, pref_detail),
        ("text_relevance", "Text relevance", text_value, weights.text, text_detail),
        ("experience", "Experience fit", exp_value, weights.experience, exp_note),
    ]
    active = sum(w for _, _, v, w, _ in raw if v is not None)
    components = [
        MatchComponent(
            key=k,
            label=label,
            value=None if v is None else round(v, 4),
            weight=round(w / active, 4) if v is not None and active > 0 else 0.0,
            detail=d,
        )
        for k, label, v, w, d in raw
    ]
    score = (
        round(100 * sum(v * w for _, _, v, w, _ in raw if v is not None) / active, 1)
        if active > 0
        else None
    )
    return MatchDetail(
        score=score,
        components=components,
        matched_required=m_req,
        matched_preferred=m_pref,
        unverified_required=u_req,
        unverified_preferred=u_pref,
        experience=ExperienceEvidence(
            candidate_years=candidate.years_experience,
            job_min=job.min_experience,
            job_max=job.max_experience,
            fit=None if exp_value is None else round(exp_value, 4),
            note=exp_note,
        ),
        method=METHOD,
        warnings=warnings,
        disclaimer=DISCLAIMER,
    )
