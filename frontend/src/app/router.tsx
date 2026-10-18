import { createBrowserRouter } from "react-router-dom";
import { AppLayout } from "@/components/layout/app-layout";
import { LoginPage } from "@/features/auth/login-page";
import { RegisterPage } from "@/features/auth/register-page";
import { PublicOnly, RequireAuth } from "@/features/auth/route-guards";
import { DashboardPage } from "@/features/dashboard/dashboard-page";
import { CandidateDetailPage } from "@/features/candidates/candidate-detail-page";
import { CandidatesPage } from "@/features/candidates/candidates-page";
import { JobDetailPage } from "@/features/jobs/job-detail-page";
import { JobsPage } from "@/features/jobs/jobs-page";
import { AnalyticsPage } from "@/features/analytics/analytics-page";
import { InterviewsPage } from "@/features/interviews/interviews-page";
import { PipelinePage } from "@/features/pipeline/pipeline-page";
import { AiAssistantPage } from "@/features/ai/ai-assistant-page";
import { SettingsPage } from "@/features/settings/settings-page";
import { NotFoundPage } from "./not-found";
import { RouteError } from "./route-error";

export const router = createBrowserRouter([
  {
    element: <PublicOnly />,
    children: [
      { path: "/login", element: <LoginPage /> },
      { path: "/register", element: <RegisterPage /> },
    ],
  },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          {
            // Page-level errors render inside the shell instead of blanking the app.
            errorElement: <RouteError />,
            children: [
              { index: true, element: <DashboardPage /> },
              { path: "candidates", element: <CandidatesPage /> },
              { path: "candidates/:id", element: <CandidateDetailPage /> },
              { path: "jobs", element: <JobsPage /> },
              { path: "jobs/:id", element: <JobDetailPage /> },
              { path: "pipeline", element: <PipelinePage /> },
              { path: "interviews", element: <InterviewsPage /> },
              { path: "analytics", element: <AnalyticsPage /> },
              { path: "ai", element: <AiAssistantPage /> },
              { path: "settings", element: <SettingsPage /> },
              { path: "*", element: <NotFoundPage /> },
            ],
          },
        ],
      },
    ],
  },
]);
