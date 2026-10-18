export type UserRole = "ADMIN" | "RECRUITER" | "VIEWER";

export interface User {
  id: string;
  workspace_id: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface Kpis {
  total_candidates: number;
  active_jobs: number;
  active_applications: number;
  upcoming_interviews: number;
  offers: number;
  hires: number;
}

export interface TimePoint {
  period: string;
  count: number;
}

export interface RecentActivity {
  id: string;
  action: string;
  entity_type: string;
  actor_name: string | null;
  candidate_name: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

export interface Overview {
  kpis: Kpis;
  granularity: "day" | "week" | "month";
  date_from: string;
  date_to: string;
  applications_over_time: TimePoint[];
  recent_activity: RecentActivity[];
  definitions: Record<string, string>;
}

export type ApplicationStage =
  | "APPLIED"
  | "SCREENING"
  | "SHORTLISTED"
  | "INTERVIEW"
  | "OFFER"
  | "HIRED"
  | "REJECTED"
  | "WITHDRAWN";
export type JobStatus = "DRAFT" | "OPEN" | "ON_HOLD" | "CLOSED";
export type EmploymentType = "FULL_TIME" | "PART_TIME" | "CONTRACT" | "INTERNSHIP";

export interface EducationItem {
  institution: string;
  degree?: string | null;
  field_of_study?: string | null;
  year?: number | null;
}

export interface Candidate {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  current_title: string | null;
  skills: string[];
  years_experience: number | null;
  experience_summary: string | null;
  education: EducationItem[] | null;
  source: string | null;
  resume_filename: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface ApplicationBrief {
  id: string;
  job_id: string;
  job_title: string;
  stage: ApplicationStage;
  applied_at: string;
  match_score: number | null;
}

export interface CandidateDetail extends Candidate {
  applications: ApplicationBrief[];
}

export interface Note {
  id: string;
  author_name: string | null;
  body: string;
  created_at: string;
}

export interface Activity {
  id: string;
  action: string;
  entity_type: string;
  actor_name: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

export interface Job {
  id: string;
  title: string;
  department: string | null;
  location: string | null;
  employment_type: EmploymentType;
  description: string;
  required_skills: string[];
  preferred_skills: string[];
  min_experience: number | null;
  max_experience: number | null;
  status: JobStatus;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
  applicant_count: number;
}

export interface JobDetail extends Job {
  stage_counts: Record<string, number>;
}

export interface ApplicationRow {
  id: string;
  candidate_id: string;
  candidate_name: string;
  candidate_skills: string[];
  candidate_years_experience: number | null;
  job_id: string;
  job_title: string;
  stage: ApplicationStage;
  applied_at: string;
  stage_changed_at: string;
  match_score: number | null;
  allowed_next_stages: ApplicationStage[];
}

export interface ImportRowError {
  row: number;
  email: string | null;
  error: string;
}

export interface ImportResult {
  total_rows: number;
  created: number;
  skipped: number;
  dry_run: boolean;
  errors: ImportRowError[];
}

export interface FunnelStep {
  stage: ApplicationStage;
  reached: number;
  conversion_from_previous: number | null;
  conversion_from_start: number | null;
}

export interface PipelineStats {
  date_from: string | null;
  date_to: string | null;
  cohort_size: number;
  stage_distribution: { stage: ApplicationStage; count: number }[];
  funnel: FunnelStep[];
  definitions: Record<string, string>;
}

export type InterviewType = "TECHNICAL" | "BEHAVIORAL" | "HR" | "PANEL" | "OTHER";
export type InterviewStatus = "SCHEDULED" | "COMPLETED" | "CANCELLED" | "NO_SHOW";

export interface Interview {
  id: string;
  application_id: string;
  candidate_id: string;
  candidate_name: string;
  job_title: string;
  interviewer_id: string | null;
  interviewer_name: string;
  interview_type: InterviewType;
  status: InterviewStatus;
  scheduled_at: string;
  duration_minutes: number;
  meeting_link: string | null;
  notes: string | null;
  created_at: string;
}

export interface AiStatus {
  configured: boolean;
  provider: string;
  model: string | null;
  mode: "deterministic" | "llm";
}

export interface ExtractedEducation {
  institution: string | null;
  degree: string | null;
  field_of_study: string | null;
  year: number | null;
  evidence: string | null;
}

export interface WorkItem {
  title: string | null;
  company: string | null;
  period: string | null;
  description: string | null;
}

export interface ProjectItem {
  name: string | null;
  description: string | null;
  technologies: string[];
}

export interface ResumeExtraction {
  skills: string[];
  years_experience: number | null;
  years_experience_evidence: string | null;
  summary: string | null;
  education: ExtractedEducation[];
  work_experience: WorkItem[];
  projects: ProjectItem[];
  uncertainties: string[];
  skill_evidence: Record<string, string>;
}

export interface ResumeAnalysis {
  analysis_id: string;
  candidate_id: string;
  provider: string;
  model: string | null;
  is_confirmed: boolean;
  filename: string;
  pages: number;
  text_chars: number;
  extraction: ResumeExtraction;
  warnings: string[];
  created_at: string;
}

export interface ConfirmedProfilePayload {
  skills: string[];
  years_experience: number | null;
  summary: string | null;
  education: EducationItem[];
  work_experience: WorkItem[];
  projects: ProjectItem[];
}

export interface SkillEvidence {
  skill: string;
  source: "resume" | "profile";
  evidence: string | null;
}

export interface UnverifiedSkill {
  skill: string;
  note: string;
}

export interface MatchComponent {
  key: string;
  label: string;
  value: number | null;
  weight: number;
  detail: string;
}

export interface MatchDetail {
  provider: "deterministic";
  score: number | null;
  components: MatchComponent[];
  matched_required: SkillEvidence[];
  matched_preferred: SkillEvidence[];
  unverified_required: UnverifiedSkill[];
  unverified_preferred: UnverifiedSkill[];
  experience: {
    candidate_years: number | null;
    job_min: number | null;
    job_max: number | null;
    fit: number | null;
    note: string;
  };
  method: string;
  warnings: string[];
  disclaimer: string;
}

export interface MatchResult extends MatchDetail {
  analysis_id: string;
  candidate_id: string;
  job_id: string;
  application_id: string | null;
  created_at: string;
}

export type Difficulty = "easy" | "medium" | "hard";
export type QuestionCategory = "technical" | "behavioral";

export interface InterviewQuestion {
  question: string;
  category: QuestionCategory;
  difficulty: Difficulty;
  competencies: string[];
  evaluation_criteria: string[];
  follow_up: string | null;
}

export interface QuestionsRequest {
  candidate_id: string;
  job_id: string;
  duration_minutes: number;
  difficulty: Difficulty;
  category: QuestionCategory | "mixed";
  variant: number;
}

export interface QuestionsResult {
  candidate_id: string;
  job_id: string;
  provider: string;
  model: string | null;
  questions: InterviewQuestion[];
  warnings: string[];
  disclaimer: string;
}

export type AnalysisKind = "RESUME_ANALYSIS" | "JOB_MATCH" | "INTERVIEW_QUESTIONS";

export interface AnalysisRecord {
  id: string;
  kind: AnalysisKind;
  candidate_id: string;
  job_id: string | null;
  provider: string;
  model: string | null;
  is_confirmed: boolean;
  created_at: string;
  result: Record<string, unknown>;
}
