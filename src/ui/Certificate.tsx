import { fr } from "@/i18n/fr";
import { CERTIFICATE_SIZE, formatCertificateDate, type CertificateData } from "@/ui/drawCertificate";
import { Motif } from "@/ui/Motif";

export type { CertificateMention } from "@/ui/drawCertificate";
export type CertificateProps = CertificateData;

// Print: hide the whole page except the certificate, A4 landscape, backgrounds kept.
const PRINT_CSS =
  "@page{size:A4 landscape;margin:0}" +
  "@media print{body *{visibility:hidden}" +
  "[data-certificate],[data-certificate] *{visibility:visible}" +
  "[data-certificate]{position:fixed;inset:0;width:100vw;height:100vh;max-width:none;border-radius:0;box-shadow:none;print-color-adjust:exact;-webkit-print-color-adjust:exact}}";

const { w: W, h: H } = CERTIFICATE_SIZE;
const CORNER_POS = ["left-[3.7%] top-[5.2%]", "right-[3.7%] top-[5.2%]", "bottom-[5.2%] left-[3.7%]", "bottom-[5.2%] right-[3.7%]"] as const;

// Hero: the pseudo, large, on cream. Same composition as drawCertificate (shared 1754 x 1240 space).
export function Certificate({ pseudo, score, mention, dateIso, noSpeaking }: CertificateProps) {
  const pseudoSize = Math.min(112, Math.floor(1300 / Math.max(1, pseudo.length * 0.62)));
  return (
    <div
      data-certificate=""
      role="img"
      aria-label={fr.exam.certificate.aria(pseudo, score)}
      className="relative aspect-[1754/1240] w-full overflow-hidden rounded-sm bg-bg shadow-raised"
    >
      <style>{PRINT_CSS}</style>
      {CORNER_POS.map((pos) => (
        <div key={pos} aria-hidden="true" className={`absolute aspect-square w-[10.8%] text-gold ${pos}`}>
          <Motif kind="scales" />
        </div>
      ))}
      <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full font-sans" aria-hidden="true" focusable="false">
        <rect x={36} y={36} width={W - 72} height={H - 72} fill="none" strokeWidth={8} className="stroke-gold" />
        <rect x={60} y={60} width={W - 120} height={H - 120} fill="none" strokeWidth={3} className="stroke-gold" />
        <text x={W / 2} y={250} textAnchor="middle" fontSize={96} fontWeight={800} className="fill-primary" lang="vi">
          {fr.exam.certificate.vi}
        </text>
        <text x={W / 2} y={325} textAnchor="middle" fontSize={40} fontWeight={600} className="fill-ink-muted">
          {fr.exam.certificate.title}
        </text>
        <text x={W / 2} y={440} textAnchor="middle" fontSize={32} className="fill-ink-muted">
          {fr.exam.certificate.awardedTo}
        </text>
        <text x={W / 2} y={570} textAnchor="middle" fontSize={pseudoSize} fontWeight={800} className="fill-ink">
          {pseudo}
        </text>
        <text x={W / 2} y={660} textAnchor="middle" fontSize={40} className="fill-ink">
          {fr.exam.certificate.achievement}
        </text>
        <text x={W / 2} y={830} textAnchor="middle" fontSize={96} fontWeight={800} className="fill-gold-ink">
          {fr.exam.certificate.score(score)}
        </text>
        <text x={W / 2} y={900} textAnchor="middle" fontSize={44} fontWeight={700} className="fill-gold-ink">
          {fr.exam.certificate.mention[mention]}
        </text>
        {noSpeaking ? (
          <text x={W / 2} y={960} textAnchor="middle" fontSize={30} className="fill-ink-muted">
            {fr.exam.certificate.noSpeaking}
          </text>
        ) : null}
        <text x={300} y={1080} fontSize={32} className="fill-ink-muted">
          {formatCertificateDate(dateIso)}
        </text>
        <circle cx={W - 330} cy={1040} r={86} className="fill-primary" />
        <circle cx={W - 330} cy={1040} r={72} fill="none" strokeWidth={5} className="stroke-gold" />
        <text x={W - 330} y={1052} textAnchor="middle" fontSize={30} fontWeight={800} className="fill-primary-on">
          {fr.exam.certificate.seal}
        </text>
      </svg>
    </div>
  );
}
