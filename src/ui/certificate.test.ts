import { certificateToBlob, drawCertificate, formatCertificateDate, type CertificateData } from "@/ui/drawCertificate";

const DATA: CertificateData = { pseudo: "Linh Nguyễn", score: 92, mention: "tres_bien", dateIso: "2026-11-09T10:00:00.000Z", noSpeaking: false };

function mockContext() {
  const calls: Array<[string, ...unknown[]]> = [];
  const target = { canvas: {}, fillStyle: "", strokeStyle: "", lineWidth: 0, font: "", textAlign: "", textBaseline: "", globalAlpha: 1 };
  const ctx = new Proxy(target, {
    get(t, prop: string) {
      if (prop in t) return (t as Record<string, unknown>)[prop];
      return (...args: unknown[]) => {
        calls.push([prop, ...args]);
      };
    },
    set(t, prop: string, value: unknown) {
      (t as Record<string, unknown>)[prop] = value;
      return true;
    },
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
}

const textsOf = (calls: Array<[string, ...unknown[]]>) => calls.filter(([n]) => n === "fillText").map(([, t]) => t);

afterEach(() => {
  vi.restoreAllMocks();
  Reflect.deleteProperty(document, "fonts");
});

test("draws the pseudo, the score and the mention with the border and seal", async () => {
  const { ctx, calls } = mockContext();
  await drawCertificate(ctx, DATA);
  const texts = textsOf(calls);
  expect(texts).toContain("Linh Nguyễn");
  expect(texts).toContain("92 / 100");
  expect(texts).toContain("Très bien");
  expect(texts).toContain("Chứng nhận");
  expect(texts).toContain("Tiếng Nhà");
  expect(texts).not.toContain("Sans épreuve orale");
  expect(calls.filter(([n]) => n === "strokeRect")).toHaveLength(2); // double border
  expect(calls.some(([n]) => n === "fillRect")).toBe(true);
});

test("adds the no-speaking line when the oral part was skipped", async () => {
  const { ctx, calls } = mockContext();
  await drawCertificate(ctx, { ...DATA, noSpeaking: true });
  expect(textsOf(calls)).toContain("Sans épreuve orale");
});

test("waits for the display font before drawing when the browser provides it", async () => {
  const load = vi.fn().mockResolvedValue([]);
  Object.defineProperty(document, "fonts", { value: { load }, configurable: true });
  const { ctx, calls } = mockContext();
  await drawCertificate(ctx, DATA);
  expect(load).toHaveBeenCalledWith("800 96px 'Be Vietnam Pro'");
  expect(calls.length).toBeGreaterThan(0);
});

test("the French date is formatted in the Paris calendar", () => {
  expect(formatCertificateDate("2026-11-08T23:30:00.000Z")).toBe("9 novembre 2026");
});

test("certificateToBlob returns null when the canvas API is missing", async () => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  expect(await certificateToBlob(DATA)).toBeNull();
});

test("certificateToBlob exports a PNG blob from the canvas", async () => {
  const { ctx } = mockContext();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(ctx as never);
  const blob = new Blob(["png"], { type: "image/png" });
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((cb) => cb(blob));
  expect(await certificateToBlob(DATA)).toBe(blob);
});
