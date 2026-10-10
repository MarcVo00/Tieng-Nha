import { fr } from "@/i18n/fr";

export type CertificateMention = "excellent" | "tres_bien" | "bien";
export type CertificateData = {
  pseudo: string;
  score: number;
  mention: CertificateMention;
  dateIso: string;
  noSpeaking: boolean;
};

/** A4 landscape at 150 dpi; the SVG certificate uses the same coordinate space. */
export const CERTIFICATE_SIZE = { w: 1754, h: 1240 } as const;

// The PNG is a paper object: it keeps the light "Papier dó" palette whatever the app theme is.
const PAPER = {
  bg: "#F6F0E4",
  ink: "#1F1A17",
  muted: "#5E544B",
  primary: "#A3201C",
  onPrimary: "#FFF8EE",
  gold: "#C8962E",
  goldInk: "#8A6416",
} as const;

const FONT = "'Be Vietnam Pro', system-ui, sans-serif";
const CORNER = 190;

export function formatCertificateDate(dateIso: string): string {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "Europe/Paris" }).format(new Date(dateIso));
}

/** Lacquer scale pattern in a square corner, same motif as `Motif kind="scales"` (low opacity). */
function drawScales(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, size, size);
  ctx.clip();
  ctx.globalAlpha = 0.18;
  ctx.strokeStyle = PAPER.gold;
  ctx.lineWidth = 3;
  const step = 40;
  for (let row = 0; row * step * 0.5 <= size + step; row++) {
    for (let col = -1; col * step <= size + step; col++) {
      const cx = x + col * step + (row % 2 === 0 ? 0 : step / 2);
      const cy = y + row * (step / 2) + step / 2;
      ctx.beginPath();
      ctx.arc(cx, cy, step / 2, Math.PI, 0);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function text(
  ctx: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  font: string,
  color: string,
  align: CanvasTextAlign = "center",
  maxWidth?: number,
): void {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = "alphabetic";
  if (maxWidth === undefined) ctx.fillText(value, x, y);
  else ctx.fillText(value, x, y, maxWidth);
}

/**
 * Draws the certificate on a canvas. Waits for the display font when the browser can load it,
 * so the PNG never falls back to a system face.
 */
export async function drawCertificate(
  ctx: CanvasRenderingContext2D,
  data: CertificateData,
  size: { w: number; h: number } = CERTIFICATE_SIZE,
): Promise<void> {
  if (typeof document !== "undefined" && document.fonts && typeof document.fonts.load === "function") {
    await Promise.all([
      document.fonts.load("800 96px 'Be Vietnam Pro'"),
      document.fonts.load("400 40px 'Be Vietnam Pro'"),
      document.fonts.load("700 40px 'Be Vietnam Pro'"),
    ]).catch(() => undefined);
  }
  const { w, h } = size;
  const cx = w / 2;
  const k = w / CERTIFICATE_SIZE.w;
  const at = (n: number) => n * k;

  ctx.fillStyle = PAPER.bg;
  ctx.fillRect(0, 0, w, h);

  // Double gold border.
  ctx.strokeStyle = PAPER.gold;
  ctx.lineWidth = at(8);
  ctx.strokeRect(at(36), at(36), w - at(72), h - at(72));
  ctx.lineWidth = at(3);
  ctx.strokeRect(at(60), at(60), w - at(120), h - at(120));

  // Scale-pattern corners inside the inner border.
  const c = at(CORNER);
  const inset = at(64);
  drawScales(ctx, inset, inset, c);
  drawScales(ctx, w - inset - c, inset, c);
  drawScales(ctx, inset, h - inset - c, c);
  drawScales(ctx, w - inset - c, h - inset - c, c);

  const maxW = w - at(2 * (CORNER + 40));
  text(ctx, fr.exam.certificate.vi, cx, at(250), `800 ${at(96)}px ${FONT}`, PAPER.primary);
  text(ctx, fr.exam.certificate.title, cx, at(325), `600 ${at(40)}px ${FONT}`, PAPER.muted);
  text(ctx, fr.exam.certificate.awardedTo, cx, at(440), `400 ${at(32)}px ${FONT}`, PAPER.muted);
  text(ctx, data.pseudo, cx, at(570), `800 ${at(112)}px ${FONT}`, PAPER.ink, "center", maxW);
  text(ctx, fr.exam.certificate.achievement, cx, at(660), `400 ${at(40)}px ${FONT}`, PAPER.ink, "center", maxW);
  text(ctx, fr.exam.certificate.score(data.score), cx, at(830), `800 ${at(96)}px ${FONT}`, PAPER.goldInk);
  text(ctx, fr.exam.certificate.mention[data.mention], cx, at(900), `700 ${at(44)}px ${FONT}`, PAPER.goldInk);
  if (data.noSpeaking) text(ctx, fr.exam.certificate.noSpeaking, cx, at(960), `400 ${at(30)}px ${FONT}`, PAPER.muted);

  text(ctx, formatCertificateDate(data.dateIso), at(300), at(1080), `400 ${at(32)}px ${FONT}`, PAPER.muted, "left");

  // Seal: red disc with the app name.
  ctx.fillStyle = PAPER.primary;
  ctx.beginPath();
  ctx.arc(w - at(330), at(1040), at(86), 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = PAPER.gold;
  ctx.lineWidth = at(5);
  ctx.beginPath();
  ctx.arc(w - at(330), at(1040), at(72), 0, Math.PI * 2);
  ctx.stroke();
  text(ctx, fr.exam.certificate.seal, w - at(330), at(1052), `800 ${at(30)}px ${FONT}`, PAPER.onPrimary);
}

/** Renders the certificate to a PNG blob; null when the canvas API is unavailable. */
export async function certificateToBlob(data: CertificateData, size = CERTIFICATE_SIZE): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = size.w;
  canvas.height = size.h;
  const ctx = typeof canvas.getContext === "function" ? canvas.getContext("2d") : null;
  if (!ctx) return null;
  await drawCertificate(ctx, data, size);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
}

/** Downloads the certificate as `vietlearn-certificat.png`. Returns false when it could not be created. */
export async function downloadCertificate(data: CertificateData): Promise<boolean> {
  const blob = await certificateToBlob(data);
  if (!blob) return false;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "vietlearn-certificat.png";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}
