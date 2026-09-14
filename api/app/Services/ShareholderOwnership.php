<?php

namespace App\Services;

use App\Models\Capital;
use App\Models\ShareHolder;
use App\Services\Shares\ShareRegister;
use Carbon\CarbonInterface;
use Illuminate\Support\Collection;

/**
 * Shareholder ownership next to their capital contributions.
 *
 *  - OWNERSHIP comes only from the share register ({@see ShareRegister}): shareholder shares ÷ total issued shares × 100.
 *  - CONTRIBUTIONS stay financial transactions: a shareholder's contributed capital is the sum of their own `capitals`
 *    rows. Their ratio is never used as ownership.
 *
 * Cash or bank balances, the CAPITAL ACCOUNT ledger balance, profit, loans, dividends and expenses never move ownership.
 */
class ShareholderOwnership
{
    public const PERCENT_PRECISION = ShareRegister::PERCENT_PRECISION;

    public function __construct(private readonly ShareRegister $register) {}

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

    /**
     * Every shareholder of the company with their contributions and their share-register ownership (now or as of a date).
     *
     * @return Collection<int, array{share_holder: ShareHolder, total_contributed: float, contributions_count: int, shares: int, total_shares: int, ownership_percent: float, share_value: float, holding_value: float}>
     */
    public function summary(int $companyId, ?CarbonInterface $asOf = null): Collection
    {
        $contributed = $this->contributedByShareHolder($companyId);
        $counts = Capital::where('company_id', $companyId)->selectRaw('share_holder_id, COUNT(*) AS contributions')->groupBy('share_holder_id')->pluck('contributions', 'share_holder_id');

        return $this->register->register($companyId, $asOf)
            ->map(fn (array $row): array => $this->row($row, (float) ($contributed[$row['share_holder']->id] ?? 0), (int) ($counts[$row['share_holder']->id] ?? 0)))
            ->values();
    }

    /**
     * @return array{share_holder: ShareHolder, total_contributed: float, contributions_count: int, shares: int, total_shares: int, ownership_percent: float, share_value: float, holding_value: float}
     */
    public function forShareHolder(ShareHolder $holder): array
    {
        $row = $this->register->register((int) $holder->company_id)->first(fn (array $row): bool => $row['share_holder']->id === $holder->id)
            ?? ['share_holder' => $holder, 'shares' => 0, 'total_shares' => 0, 'ownership_percent' => 0.0, 'share_value' => 0.0, 'holding_value' => 0.0];

        return $this->row(['share_holder' => $holder] + $row, round((float) $holder->capitals()->sum('amount'), 2), $holder->capitals()->count());
    }

    /**
     * @param  array{share_holder: ShareHolder, shares: int, total_shares: int, ownership_percent: float, share_value: float, holding_value: float}  $register
     * @return array{share_holder: ShareHolder, total_contributed: float, contributions_count: int, shares: int, total_shares: int, ownership_percent: float, share_value: float, holding_value: float}
     */
    private function row(array $register, float $contributed, int $count): array
    {
        return [
            'share_holder' => $register['share_holder'],
            'total_contributed' => round($contributed, 2),
            'contributions_count' => $count,
            'shares' => $register['shares'],
            'total_shares' => $register['total_shares'],
            'ownership_percent' => $register['ownership_percent'],
            'share_value' => $register['share_value'],
            'holding_value' => $register['holding_value'],
        ];
    }
}
