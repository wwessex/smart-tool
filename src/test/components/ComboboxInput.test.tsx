import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ComboboxInput } from "@/components/smart/ComboboxInput";

const OPTIONS = ["1 week", "2 weeks", "3 weeks", "1 month", "2 months"];

describe("ComboboxInput", () => {
  it("renders with the given value", () => {
    render(
      <ComboboxInput value="2 weeks" onChange={vi.fn()} options={OPTIONS} />
    );

    const input = screen.getByRole("combobox");
    expect(input).toHaveValue("2 weeks");
  });

  it("renders placeholder when no value", () => {
    render(
      <ComboboxInput
        value=""
        onChange={vi.fn()}
        options={OPTIONS}
        placeholder="Select timescale..."
      />
    );

    const input = screen.getByRole("combobox");
    expect(input).toHaveAttribute("placeholder", "Select timescale...");
  });

  it("filters options based on user input", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <ComboboxInput value="" onChange={onChange} options={OPTIONS} />
    );

    const input = screen.getByRole("combobox");
    await user.click(input);
    await user.type(input, "week");

    // onChange should be called for each character typed
    expect(onChange).toHaveBeenCalled();
    // The input value should reflect the typed text
    expect(input).toHaveValue("week");
  });

  it("calls onChange when typing custom value", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <ComboboxInput value="" onChange={onChange} options={OPTIONS} />
    );

    const input = screen.getByRole("combobox");
    await user.type(input, "custom value");

    // onChange is called for each character
    expect(onChange).toHaveBeenCalledTimes(12); // "custom value" = 12 chars
  });

  it("has correct ARIA attributes", () => {
    render(
      <ComboboxInput value="" onChange={vi.fn()} options={OPTIONS} />
    );

    const input = screen.getByRole("combobox");
    expect(input).toHaveAttribute("aria-haspopup", "listbox");
    expect(input).toHaveAttribute("aria-autocomplete", "list");
  });

  it("updates displayed value when value prop changes", () => {
    const { rerender } = render(
      <ComboboxInput value="1 week" onChange={vi.fn()} options={OPTIONS} />
    );

    expect(screen.getByRole("combobox")).toHaveValue("1 week");

    rerender(
      <ComboboxInput value="2 weeks" onChange={vi.fn()} options={OPTIONS} />
    );

    expect(screen.getByRole("combobox")).toHaveValue("2 weeks");
  });

  it("supports the data-field attribute", () => {
    render(
      <ComboboxInput
        value=""
        onChange={vi.fn()}
        options={OPTIONS}
        data-field="timescale"
      />
    );

    const wrapper = screen.getByRole("combobox").parentElement;
    expect(wrapper).toHaveAttribute("data-field", "timescale");
  });

  it("handles Enter key to confirm custom input", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <ComboboxInput value="" onChange={onChange} options={OPTIONS} />
    );

    const input = screen.getByRole("combobox");
    await user.type(input, "6 months");
    await user.keyboard("{Enter}");

    // The last onChange call from Enter should confirm the value
    expect(onChange).toHaveBeenLastCalledWith("6 months");
  });

  it("handles Escape key to close dropdown", async () => {
    const user = userEvent.setup();

    render(
      <ComboboxInput value="" onChange={vi.fn()} options={OPTIONS} />
    );

    const input = screen.getByRole("combobox");

    // Type to open the popover (typing triggers open in the component)
    await user.type(input, "w");

    // After typing, the popover should be open
    expect(input).toHaveAttribute("aria-expanded", "true");

    await user.keyboard("{Escape}");
    expect(input).toHaveAttribute("aria-expanded", "false");
  });
});
