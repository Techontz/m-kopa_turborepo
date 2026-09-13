<?php

namespace App\Providers;

use App\Models\Customer;
use Illuminate\Support\Facades\View;
use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Str;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        View::composer('partials.navbar', function ($view): void {
            $view->with('navbarCustomers', Customer::query()
                ->where('company_id', auth()->user()->company_id)
                ->latest('id')
                ->get(['id', 'first_name', 'middle_name', 'last_name']));
        });

        View::composer('partials.sidebar', function ($view): void {
            $matches = function (array $item, ?string $currentRoute) use (&$matches): bool {
                if ($currentRoute === null) {
                    return false;
                }
                if (isset($item['children'])) {
                    return collect($item['children'])->contains(fn (array $child): bool => $matches($child, $currentRoute));
                }

                return $item['route'] === $currentRoute || Str::is($item['also'] ?? [], $currentRoute);
            };

            $view->with('sidebarMatches', $matches);
        });
    }
}
