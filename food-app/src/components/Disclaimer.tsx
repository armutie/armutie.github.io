import { Info } from "lucide-react";

export function Disclaimer() {
  return (
    <aside className="disclaimer">
      <Info size={16} aria-hidden="true" />
      <p>
        Nutrition values are estimates and may be inaccurate. Review and correct results before
        relying on them. This app does not provide medical or dietary advice.
      </p>
    </aside>
  );
}
