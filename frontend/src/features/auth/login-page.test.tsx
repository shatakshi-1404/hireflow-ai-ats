import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { mockFetchJson, renderWithProviders } from "@/test/utils";
import { LoginPage } from "./login-page";

describe("LoginPage", () => {
  it("shows field errors and does not call the API when empty", async () => {
    const fetchMock = mockFetchJson(200, {});
    renderWithProviders(<LoginPage />);
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("Email is required")).toBeInTheDocument();
    expect(screen.getByText("Password is required")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("submits credentials", async () => {
    const fetchMock = mockFetchJson(200, { id: "1", email: "a@example.com" });
    renderWithProviders(<LoginPage />);
    await userEvent.type(screen.getByLabelText("Email"), "a@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "correct-horse-battery");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const call = fetchMock.mock.calls[0];
    expect(call?.[0]).toBe("/api/v1/auth/login");
    expect(JSON.parse(String((call?.[1] as RequestInit).body))).toEqual({
      email: "a@example.com",
      password: "correct-horse-battery",
    });
  });

  it("shows the server error on bad credentials", async () => {
    mockFetchJson(401, { detail: "Invalid email or password" });
    renderWithProviders(<LoginPage />);
    await userEvent.type(screen.getByLabelText("Email"), "a@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "wrong-password");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("Invalid email or password")).toBeInTheDocument();
  });
});
