import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { mockFetchJson, renderWithProviders } from "@/test/utils";
import { CandidateFormDialog } from "./candidate-form-dialog";

describe("CandidateFormDialog", () => {
  it("validates required fields before calling the API", async () => {
    const fetchMock = mockFetchJson(201, {});
    renderWithProviders(<CandidateFormDialog open onOpenChange={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: "Add candidate" }));
    expect(await screen.findByText("Name is required")).toBeInTheDocument();
    expect(screen.getByText("Email is required")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects an out-of-range experience value", async () => {
    mockFetchJson(201, {});
    renderWithProviders(<CandidateFormDialog open onOpenChange={() => {}} />);
    await userEvent.type(screen.getByLabelText("Full name"), "Ada Lovelace");
    await userEvent.type(screen.getByLabelText("Email"), "ada@example.com");
    await userEvent.type(screen.getByLabelText("Years of experience"), "99");
    await userEvent.click(screen.getByRole("button", { name: "Add candidate" }));
    expect(await screen.findByText("Enter a number between 0 and 60")).toBeInTheDocument();
  });

  it("sends a parsed payload and closes on success", async () => {
    const fetchMock = mockFetchJson(201, { id: "c1" });
    const onOpenChange = vi.fn();
    renderWithProviders(<CandidateFormDialog open onOpenChange={onOpenChange} />);
    await userEvent.type(screen.getByLabelText("Full name"), "  Ada Lovelace ");
    await userEvent.type(screen.getByLabelText("Email"), "ada@example.com");
    await userEvent.type(screen.getByLabelText("Skills"), "Python; SQL, docker");
    await userEvent.type(screen.getByLabelText("Years of experience"), "4");
    await userEvent.click(screen.getByRole("button", { name: "Add candidate" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const call = fetchMock.mock.calls[0];
    expect(call?.[0]).toBe("/api/v1/candidates");
    expect(JSON.parse(String((call?.[1] as RequestInit).body))).toMatchObject({
      full_name: "Ada Lovelace",
      email: "ada@example.com",
      skills: ["Python", "SQL", "docker"],
      years_experience: 4,
      phone: null,
    });
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("shows a duplicate-email error on the email field", async () => {
    mockFetchJson(409, { detail: "A candidate with this email already exists in this workspace" });
    renderWithProviders(<CandidateFormDialog open onOpenChange={() => {}} />);
    await userEvent.type(screen.getByLabelText("Full name"), "Ada");
    await userEvent.type(screen.getByLabelText("Email"), "ada@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Add candidate" }));
    expect(await screen.findByText(/already exists/i)).toBeInTheDocument();
  });
});
