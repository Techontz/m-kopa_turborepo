<?php

namespace App\Http\Controllers\Hrm\Concerns;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;

/**
 * Applies the "branch + from/to" filter modal (submitted as GET query params).
 */
trait FiltersByBranchAndDate
{
    /**
     * @template TModel of \Illuminate\Database\Eloquent\Model
     *
     * @param  Builder<TModel>  $query
     * @return Builder<TModel>
     */
    protected function applyBranchDateFilter(Builder $query, Request $request): Builder
    {
        $branch = $request->query('blanch_id');

        return $query
            ->when($branch !== null && $branch !== '' && $branch !== 'all', fn (Builder $query) => $query->where('branch_id', (int) $branch))
            ->when($request->date('from'), fn (Builder $query, $from) => $query->whereDate('created_at', '>=', $from->toDateString()))
            ->when($request->date('to'), fn (Builder $query, $to) => $query->whereDate('created_at', '<=', $to->toDateString()));
    }
}
