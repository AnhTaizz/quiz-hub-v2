import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Modal } from "./Modal";

function Harness({ onClosed }: { onClosed?: () => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open
      </button>
      {/* A fresh inline onClose on every render, exactly like real callers. */}
      <Modal
        isOpen={open}
        onClose={() => {
          setOpen(false);
          onClosed?.();
        }}
        title="Edit"
      >
        <label>
          Name
          <input value={text} onChange={(event) => setText(event.target.value)} />
        </label>
      </Modal>
    </>
  );
}

describe("Modal", () => {
  it("keeps focus in a field while the parent re-renders on every keystroke (regression: focus was yanked to the first control)", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Open" }));
    await user.click(screen.getByLabelText("Name"));
    await user.keyboard("hello");

    expect(screen.getByLabelText("Name")).toHaveValue("hello");
  });

  it("closes on Escape with the latest handler and returns focus to the opener", async () => {
    const onClosed = vi.fn();
    const user = userEvent.setup();
    render(<Harness onClosed={onClosed} />);
    const opener = screen.getByRole("button", { name: "Open" });
    await user.click(opener);
    expect(screen.getByRole("dialog", { name: "Edit" })).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(onClosed).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it("traps Tab inside the dialog", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Open" }));
    const dialog = screen.getByRole("dialog");
    for (let i = 0; i < 5; i++) {
      await user.tab();
      expect(dialog).toContainElement(document.activeElement as HTMLElement);
    }
  });
});
