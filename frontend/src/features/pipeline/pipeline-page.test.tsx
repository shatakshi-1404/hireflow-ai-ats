import { screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { UserContext } from "@/features/auth/user-context";
import { json, makeApp } from "@/test/fixtures";
import { renderWithProviders } from "@/test/utils";
import type { User, UserRole } from "@/types/api";
import { PipelinePage } from "./pipeline-page";

const user = (role: UserRole): User => ({
  id: "u1",
  workspace_id: "w1",
  email: "u@example.com",
  full_name: "Test User",
  role,
  is_active: true,
  created_at: "2026-01-01T00:00:00Z",
});

function mockApi(applicationsStatus = 200) {
  const items = [
    makeApp(),
    makeApp({
      id: "a2",
      candidate_id: "c2",
      candidate_name: "Grace Hopper",
      stage: "SCREENING",
      allowed_next_stages: ["APPLIED", "SHORTLISTED", "REJECTED", "WITHDRAWN"],
    }),
  ];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = String(input);
    if (url.startsWith("/api/v1/jobs")) return json({ items: [], total: 0, page: 1, page_size: 100, pages: 1 });
    if (url.startsWith("/api/v1/applications")) {
      return applicationsStatus === 200
        ? json({ items, total: items.length, page: 1, page_size: 200, pages: 1 })
        : json({ detail: "boom" }, applicationsStatus);
    }
    return json({}, 404);
  });
}

function renderPage(role: UserRole) {
  return renderWithProviders(
    <UserContext.Provider value={user(role)}>
      <PipelinePage />
    </UserContext.Provider>,
  );
}

describe("PipelinePage", () => {
  it("places each application in its stage column", async () => {
    mockApi();
    renderPage("RECRUITER");
    await screen.findByText("Ada Lovelace");
    expect(within(screen.getByRole("region", { name: "Applied stage" })).getByText("Ada Lovelace")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Screening stage" })).getByText("Grace Hopper")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Offer stage" })).getByText("No candidates")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Drag Ada Lovelace" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Move options for Ada Lovelace" })).toBeInTheDocument();
  });

  it("is read-only for viewers", async () => {
    mockApi();
    renderPage("VIEWER");
    await screen.findByText("Ada Lovelace");
    expect(screen.queryByRole("button", { name: /^Drag / })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Move options/ })).not.toBeInTheDocument();
  });

  it("shows an error state with a retry button when loading fails", async () => {
    mockApi(500);
    renderPage("RECRUITER");
    expect(await screen.findByText("Couldn't load the pipeline")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });
});
