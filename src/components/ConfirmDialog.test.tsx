import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ConfirmDialog } from "./ConfirmDialog";

describe("ConfirmDialog", () => {
  it("renders an in-app destructive confirmation", () => {
    const markup = renderToStaticMarkup(
      <ConfirmDialog
        open
        title="Clear the archive?"
        description="The original conversations will not be changed."
        confirmLabel="Clear archive"
        cancelLabel="Cancel"
        busy={false}
        onCancel={() => undefined}
        onConfirm={() => undefined}
      />
    );

    expect(markup).toContain('role="alertdialog"');
    expect(markup).toContain("Clear the archive?");
    expect(markup).toContain("button--danger-solid");
  });

  it("renders nothing while closed", () => {
    expect(
      renderToStaticMarkup(
        <ConfirmDialog
          open={false}
          title=""
          description=""
          confirmLabel=""
          cancelLabel=""
          busy={false}
          onCancel={() => undefined}
          onConfirm={() => undefined}
        />
      )
    ).toBe("");
  });
});
