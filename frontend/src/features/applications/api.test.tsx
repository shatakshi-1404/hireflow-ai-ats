import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { json, makeApp } from "@/test/fixtures";
import type { ApplicationRow, Page } from "@/types/api";
import { boardKey, useChangeStage } from "./api";

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const board: Page<ApplicationRow> = { items: [makeApp()], total: 1, page: 1, page_size: 200, pages: 1 };
  client.setQueryData(boardKey(undefined), board);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const stage = () => client.getQueryData<Page<ApplicationRow>>(boardKey(undefined))?.items[0]?.stage;
  return { client, wrapper, stage };
}

describe("useChangeStage", () => {
  it("moves the card optimistically, then adopts the server's version", async () => {
    const { wrapper, stage, client } = setup();
    let respond: (r: Response) => void = () => {};
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(() => new Promise<Response>((resolve) => (respond = resolve)));

    const { result } = renderHook(() => useChangeStage(), { wrapper });
    act(() => result.current.mutate({ id: "a1", to_stage: "SCREENING" }));

    await waitFor(() => expect(stage()).toBe("SCREENING")); // optimistic, server hasn't answered
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("/api/v1/applications/a1/stage");
    expect(JSON.parse(String((init as RequestInit).body))).toEqual({ to_stage: "SCREENING", reason: null });

    act(() => respond(json(makeApp({ stage: "SCREENING", allowed_next_stages: ["SHORTLISTED"] }))));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const item = client.getQueryData<Page<ApplicationRow>>(boardKey(undefined))?.items[0];
    expect(item?.allowed_next_stages).toEqual(["SHORTLISTED"]);
  });

  it("reverts the card when the server rejects the transition", async () => {
    const { wrapper, stage } = setup();
    vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      json({ detail: "Cannot move from APPLIED to OFFER. Allowed: SCREENING" }, 409),
    );
    const { result } = renderHook(() => useChangeStage(), { wrapper });
    act(() => result.current.mutate({ id: "a1", to_stage: "OFFER" }));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toContain("Cannot move");
    expect(stage()).toBe("APPLIED");
  });

  it("reverts on a network failure", async () => {
    const { wrapper, stage } = setup();
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));
    const { result } = renderHook(() => useChangeStage(), { wrapper });
    act(() => result.current.mutate({ id: "a1", to_stage: "SCREENING" }));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toMatch(/cannot reach the server/i);
    expect(stage()).toBe("APPLIED");
  });
});
