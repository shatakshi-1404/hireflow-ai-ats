import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { UserContext } from "@/features/auth/user-context";
import { json } from "@/test/fixtures";
import { renderWithProviders } from "@/test/utils";
import type { Candidate, User } from "@/types/api";
import { CandidatesPage } from "./candidates-page";

const user: User = {
  id: "u1",
  workspace_id: "w1",
  email: "u@example.com",
  full_name: "Test User",
  role: "RECRUITER",
  is_active: true,
  created_at: "2026-01-01T00:00:00Z",
};

const ada: Candidate = {
  id: "c1",
  full_name: "Ada Lovelace",
  email: "ada@example.com",
  phone: null,
  current_title: "Engineer",
  skills: ["python"],
  years_experience: 4,
  experience_summary: null,
  education: null,
  source: null,
  resume_filename: null,
  is_archived: false,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

function mockApi(items: Candidate[]) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = String(input);
    if (url.startsWith("/api/v1/jobs")) return json({ items: [], total: 0, page: 1, page_size: 100, pages: 1 });
    return json({ items, total: items.length, page: 1, page_size: 15, pages: 1 });
  });
}

const candidateCalls = (spy: ReturnType<typeof mockApi>) =>
  spy.mock.calls.map((c) => String(c[0])).filter((u) => u.startsWith("/api/v1/candidates"));

function renderPage() {
  return renderWithProviders(
    <UserContext.Provider value={user}>
      <CandidatesPage />
    </UserContext.Provider>,
  );
}

describe("CandidatesPage filters", () => {
  it("lists candidates, then sends the debounced search term to the API", async () => {
    const spy = mockApi([ada]);
    renderPage();
    expect(await screen.findByText("Ada Lovelace")).toBeInTheDocument();
    expect(candidateCalls(spy)[0]).not.toContain("q=");

    await userEvent.type(screen.getByLabelText("Search candidates"), "ada");
    await waitFor(() => expect(candidateCalls(spy).some((u) => u.includes("q=ada") && u.includes("page=1"))).toBe(true));
  });

  it("sends the archived toggle and shows a clear empty state with a way out", async () => {
    const spy = mockApi([]);
    renderPage();
    await userEvent.click(await screen.findByLabelText("Include archived"));
    await waitFor(() => expect(candidateCalls(spy).some((u) => u.includes("include_archived=true"))).toBe(true));
    expect(await screen.findByText("No candidates match")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Clear filters" }).length).toBeGreaterThan(0);
  });

  it("shows an error state with retry when the list fails", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) =>
      String(input).startsWith("/api/v1/jobs")
        ? json({ items: [], total: 0, page: 1, page_size: 100, pages: 1 })
        : json({ detail: "boom" }, 500),
    );
    renderPage();
    expect(await screen.findByText("Couldn't load candidates")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });
});
