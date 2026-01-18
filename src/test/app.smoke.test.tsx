import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import App from "@/App";

describe("app smoke", () => {
  it("renders the main SMART tool page", async () => {
    // HashRouter reads from location.hash; ensure we land on the index route.
    window.location.hash = "#/";

    render(<App />);

    // Main page should load via React.lazy + Suspense.
    const heading = await screen.findByText(/create action/i);
    expect(heading).toBeInTheDocument();
  });
});

