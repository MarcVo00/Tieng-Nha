import { DropNumber } from "@/ui/DropNumber";
import { Icon, type IconName } from "@/ui/icons";

type BalanceLineProps = { icon: IconName; value: string; caption: string };

// A compact headline, not a stats tile: the coin, the number on one line, the caption beside it.
export function BalanceLine({ icon, value, caption }: BalanceLineProps) {
  return (
    <div className="flex items-center gap-2">
      <Icon name={icon} size={32} className="shrink-0 text-gold" />
      <p className="tabular whitespace-nowrap text-title text-gold-ink">
        <DropNumber>{value}</DropNumber>
      </p>
      <p className="text-caption text-ink-muted">{caption}</p>
    </div>
  );
}
