import { render, screen } from "@testing-library/react";
import { SyllableDiffView } from "./SyllableDiff";
import { grade } from "./grade";

const ex = { id: "e", type: "speak" as const, vi: "Cho tui một ly trà đá.", fr: "…", vocabIds: [] };
const ctx = { vocabIndex: new Map() };

test("marks a wrong tone and shows what was heard", () => {
  const result = grade(ex, { kind: "speech", alternatives: ["cho tui một ly trà đà"] }, ctx);
  render(<SyllableDiffView exercise={ex} result={result} />);
  expect(screen.getByText("đá")).toBeInTheDocument();
  expect(screen.getByText(/\(ton\)/)).toBeInTheDocument();
  expect(screen.getByText("cho tui một ly trà đà")).toHaveAttribute("lang", "vi");
});

test("renders nothing for self-assessed and skipped results", () => {
  const { container, rerender } = render(<SyllableDiffView exercise={ex} result={grade(ex, { kind: "self", ok: true }, ctx)} />);
  expect(container).toBeEmptyDOMElement();
  rerender(<SyllableDiffView exercise={ex} result={grade(ex, { kind: "skip" }, ctx)} />);
  expect(container).toBeEmptyDOMElement();
});

test("Tagalog shows a neutral diff: no tone mark, no tone underline", () => {
  const tl = { id: "t", type: "speak" as const, vi: "Salamat po.", fr: "Merci.", vocabIds: [] };
  const result = grade(tl, { kind: "speech", alternatives: ["salámat po"] }, ctx);
  render(<SyllableDiffView exercise={tl} result={result} lang="tl" />);
  expect(screen.queryByText(/\(ton\)/)).not.toBeInTheDocument();
  expect(screen.getByText("salámat po")).toHaveAttribute("lang", "tl");
});
