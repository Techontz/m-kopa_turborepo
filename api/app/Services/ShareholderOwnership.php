<?php

namespace App\Services;

use App\Models\Capital;
use App\Models\ShareHolder;
use Illuminate\Support\Collection;

/**
 * The single source of shareholder ownership.
 *
 *  - A shareholder's contributed capital is the sum of their own capital contribution rows (`capitals`).
 *  - Ownership % = that shareholder's total historical contributions ÷ all shareholders' total historical
 *    contributions × 100, computed on every read — never stored.
 *
 * Nothing else moves ownership: cash or bank balances, the CAPITAL ACCOUNT ledger balance (which also holds bank
 * opening balances and reinvested profit), assets, revenue, profit, loans, dividends, expenses or valuation are
 * deliberately ignored, so spending, transferring or lending company money leaves ownership unchanged.
 */
class ShareholderOwnership
{
    public const PERCENT_PRECISION = 4;

    /**
     * Total contributed per shareholder id.
     *
     * @return Collection<int, float>
     */
    public function contributedByShareHolder(int $companyId): Collection
    {
        return Capital::where('company_id', $companyId)
            ->selectRaw('share_holder_id, SUM(amount) AS total')
            ->groupBy('share_holder_id')
            ->pluck('total', 'share_holder_id')
            ->map(fn ($total): float => round((float) $total, 2));
    }

    /**
     * All shareholders' total historical contributions.
     */
    public function totalContributed(int $companyId): float
    {
        return round((float) Capital::where('company_id', $companyId)->sum('amount'), 2);
    }

    public function percentOf(float $contributed, float $total): float
    {
        return $total > 0 ? round($contributed / $total * 100, self::PERCENT_PRECISION) : 0.0;
    }

    /**
     * Every shareholder of the company (including those with no contribution: 0 contributed, 0%).
     *
     * @return Collection<int, array{share_holder: ShareHolder, total_contributed: float, ownership_percent: float, contributions_count: int}>
     */
    public function summary(int $companyId): Collection
    {
        $contributed = $this->contributedByShareHolder($companyId);
        $counts = Capital::where('company_id', $companyId)->selectRaw('share_holder_id, COUNT(*) AS contributions')->groupBy('share_holder_id')->pluck('contributions', 'share_holder_id');
        $total = round((float) $contributed->sum(), 2);

        return ShareHolder::where('company_id', $companyId)->orderBy('id')->get()
            ->map(fn (ShareHolder $holder): array => $this->row($holder, (float) ($contributed[$holder->id] ?? 0), $total, (int) ($counts[$holder->id] ?? 0)))
            ->values();
    }

    /**
     * @return array{share_holder: ShareHolder, total_contributed: float, ownership_percent: float, contributions_count: int}
     */
    public function forShareHolder(ShareHolder $holder): array
    {
        $contributions = $holder->capitals();

        return $this->row($holder, round((float) $contributions->sum('amount'), 2), $this->totalContributed((int) $holder->company_id), $holder->capitals()->count());
    }

    /**
     * @return array{share_holder: ShareHolder, total_contributed: float, ownership_percent: float, contributions_count: int}
     */
    private function row(ShareHolder $holder, float $contributed, float $total, int $count): array
    {
        return [
            'share_holder' => $holder,
            'total_contributed' => $contributed,
            'ownership_percent' => $this->percentOf($contributed, $total),
            'contributions_count' => $count,
        ];
    }
}
