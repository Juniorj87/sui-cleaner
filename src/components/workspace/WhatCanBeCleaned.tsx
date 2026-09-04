import { useMemo } from "react";
import { Trash2, Coins, ShieldCheck, ArrowRight } from "lucide-react";
import type { WalletObject } from "../../scanner/objectClassifier";

interface WhatCanBeCleanedProps {
  objects: WalletObject[];
  onReviewEmpty: () => void;
  onSweepDust: () => void;
  onReviewSecurity: () => void;
}

export default function WhatCanBeCleaned({
  objects,
  onReviewEmpty,
  onSweepDust,
  onReviewSecurity,
}: WhatCanBeCleanedProps) {
  const { emptyCount, emptyRebate, dustCount, dustRebate, reviewCount, protectedCount } = useMemo(() => {
    const empty = objects.filter((o) => o.coinBalance === "0" && o.cleanupAction === "delete");
    const dust = objects.filter((o) => !!o.dust && !o.protected);
    const review = objects.filter((o) => o.classification === "review" || o.classification === "suspicious");
    const prot = objects.filter((o) => o.protected);

    const emptyRebateVal = (empty.length * 0.0028).toFixed(3);
    const dustRebateVal = (dust.length * 0.0020).toFixed(3);

    return {
      emptyCount: empty.length,
      emptyRebate: emptyRebateVal,
      dustCount: dust.length,
      dustRebate: dustRebateVal,
      reviewCount: review.length,
      protectedCount: prot.length,
    };
  }, [objects]);

  return (
    <section className="what-can-clean-section" aria-label="What can be cleaned">
      <h2 className="what-can-clean-title">WHAT CAN BE CLEANED?</h2>

      <div className="what-can-clean-grid">
        {/* Card 1: Empty Objects */}
        <div className="clean-category-card cat-empty">
          <div className="cat-card-header">
            <div className="cat-icon-wrap cat-icon-green" aria-hidden="true">
              <Trash2 size={18} strokeWidth={2} />
            </div>
            <div className="cat-header-text">
              <div className="cat-title">Empty Objects</div>
              <div className="cat-count cat-count-green">{emptyCount} objects</div>
            </div>
          </div>

          <p className="cat-description">
            Objects with zero balance that may no longer be needed and can return storage rebate.
          </p>

          <div className="cat-footer">
            <div className="cat-recovery">
              <span className="cat-recovery-label">Estimated recovery</span>
              <span className="cat-recovery-val green">+{emptyRebate} SUI</span>
            </div>
            <button
              type="button"
              className="cat-action-btn btn-green"
              onClick={onReviewEmpty}
              title="Review empty 0-balance objects"
            >
              <span>Review objects</span>
              <ArrowRight size={13} strokeWidth={2.2} />
            </button>
          </div>
        </div>

        {/* Card 2: Dust Tokens */}
        <div className="clean-category-card cat-dust">
          <div className="cat-card-header">
            <div className="cat-icon-wrap cat-icon-amber" aria-hidden="true">
              <Coins size={18} strokeWidth={2} />
            </div>
            <div className="cat-header-text">
              <div className="cat-title">Dust Tokens</div>
              <div className="cat-count cat-count-amber">{dustCount} objects</div>
            </div>
          </div>

          <p className="cat-description">
            Very small token balances that may be consolidated or cleaned for storage rebate.
          </p>

          <div className="cat-footer">
            <div className="cat-recovery">
              <span className="cat-recovery-label">Estimated recovery</span>
              <span className="cat-recovery-val amber">+{dustRebate} SUI</span>
            </div>
            <button
              type="button"
              className="cat-action-btn btn-amber"
              onClick={onSweepDust}
              title="Review and sweep dust tokens"
            >
              <span>Sweep dust</span>
              <ArrowRight size={13} strokeWidth={2.2} />
            </button>
          </div>
        </div>

        {/* Card 3: Review / Protected */}
        <div className="clean-category-card cat-review">
          <div className="cat-card-header">
            <div className="cat-icon-wrap cat-icon-purple" aria-hidden="true">
              <ShieldCheck size={18} strokeWidth={2} />
            </div>
            <div className="cat-header-text">
              <div className="cat-title">Review Objects</div>
              <div className="cat-count cat-count-purple">
                {reviewCount} review · {protectedCount} protected
              </div>
            </div>
          </div>

          <p className="cat-description">
            Objects that require additional review or are protected from automatic cleanup.
          </p>

          <div className="cat-footer">
            <div className="cat-recovery">
              <span className="cat-recovery-label">Security Shield</span>
              <span className="cat-recovery-val neutral">Protected</span>
            </div>
            <button
              type="button"
              className="cat-action-btn btn-purple"
              onClick={onReviewSecurity}
              title="Review security and protected items"
            >
              <span>Review security</span>
              <ArrowRight size={13} strokeWidth={2.2} />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
