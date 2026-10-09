import { parisDay, addDays, daysBetween, startOfParisWeek, addDaysIso } from "@/services/time";

test("parisDay handles summer time (UTC+2)", () => {
  expect(parisDay("2026-10-09T22:30:00.000Z")).toBe("2026-10-10");
  expect(parisDay("2026-10-09T21:59:00.000Z")).toBe("2026-10-09");
});
test("parisDay handles winter time (UTC+1) and DST switch on 2026-10-25", () => {
  expect(parisDay("2026-10-24T22:30:00.000Z")).toBe("2026-10-25"); // still CEST
  expect(parisDay("2026-10-25T23:30:00.000Z")).toBe("2026-10-26"); // CET
  expect(parisDay("2026-12-31T23:30:00.000Z")).toBe("2027-01-01");
});
test("addDays / daysBetween across month and DST", () => {
  expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
  expect(addDays("2026-10-25", -1)).toBe("2026-10-24");
  expect(daysBetween("2026-10-24", "2026-10-26")).toBe(2);
});
test("startOfParisWeek returns Monday", () => {
  expect(startOfParisWeek("2026-10-09T10:00:00.000Z")).toBe("2026-10-05"); // Friday
  expect(startOfParisWeek("2026-10-11T21:30:00.000Z")).toBe("2026-10-05"); // Sunday 23:30 Paris
  expect(startOfParisWeek("2026-10-11T22:30:00.000Z")).toBe("2026-10-12"); // Monday 00:30 Paris
});
test("addDaysIso adds 24h multiples", () => {
  expect(addDaysIso("2026-10-10T08:00:00.000Z", 2)).toBe("2026-10-12T08:00:00.000Z");
});
