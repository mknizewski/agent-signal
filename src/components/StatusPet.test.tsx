import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StatusPet } from "./StatusPet";

describe("StatusPet motion variants", () => {
  it("keeps compact pets separate from dashboard work animations", () => {
    const markup = renderToStaticMarkup(
      <StatusPet
        agent="codex"
        status="working"
        size="large"
        manager
        motion="compact"
      />
    );

    expect(markup).toContain("status-pet--compact-motion");
    expect(markup).not.toContain("status-pet__work");
    expect(markup).not.toContain("status-pet__manager-clipboard");
    expect(markup).not.toContain("status-pet__wave");
  });

  it("keeps the dashboard tool animation unchanged", () => {
    const markup = renderToStaticMarkup(
      <StatusPet
        agent="codex"
        status="working"
      />
    );

    expect(markup).not.toContain("status-pet--compact-motion");
    expect(markup).toContain("status-pet__work");
    expect(markup).toContain("status-pet__hammer");
  });
});
