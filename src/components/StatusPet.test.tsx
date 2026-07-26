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
        motion="compact"
      />
    );

    expect(markup).toContain("status-pet--compact-motion");
    expect(markup).not.toContain("status-pet__work");
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

  it("uses a neutral animation for statusless subagent presence", () => {
    const markup = renderToStaticMarkup(
      <StatusPet
        agent="codex"
        status="idle"
        size="mini"
        presenceOnly
        ariaLabel="Wykryty subagent"
      />
    );

    expect(markup).toContain("status-pet--presence");
    expect(markup).toContain('aria-label="Wykryty subagent"');
    expect(markup).not.toContain("status-pet__work");
    expect(markup).not.toContain("status-pet__wave");
  });
});
