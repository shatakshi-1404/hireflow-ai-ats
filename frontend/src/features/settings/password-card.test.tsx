import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { mockFetchJson, renderWithProviders } from "@/test/utils";
import { PasswordCard } from "./password-card";

async function fill(current: string, next: string, confirm: string) {
  await userEvent.type(screen.getByLabelText("Current password"), current);
  await userEvent.type(screen.getByLabelText("New password"), next);
  await userEvent.type(screen.getByLabelText("Confirm new password"), confirm);
  await userEvent.click(screen.getByRole("button", { name: "Change password" }));
}

describe("PasswordCard", () => {
  it("blocks mismatched and unchanged passwords without calling the API", async () => {
    const fetchMock = mockFetchJson(204, {});
    renderWithProviders(<PasswordCard />);
    await fill("old-password-123", "new-password-123", "different-123456");
    expect(await screen.findByText("Passwords don't match")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends the change and clears the form on success", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () => new Response(null, { status: 204 }));
    renderWithProviders(<PasswordCard />);
    await fill("old-password-123", "new-password-123", "new-password-123");

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("/api/v1/auth/change-password");
    expect(JSON.parse(String((init as RequestInit).body))).toEqual({
      current_password: "old-password-123",
      new_password: "new-password-123",
    });
    await waitFor(() => expect(screen.getByLabelText("Current password")).toHaveValue(""));
  });

  it("shows the server's reason, for example for a protected demo account", async () => {
    mockFetchJson(403, { detail: "This is a shared demo account. Its password can't be changed." });
    renderWithProviders(<PasswordCard />);
    await fill("old-password-123", "new-password-123", "new-password-123");
    expect(await screen.findByText(/shared demo account/)).toBeInTheDocument();
  });
});
