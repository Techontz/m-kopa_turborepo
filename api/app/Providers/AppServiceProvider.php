<?php

namespace App\Providers;

use App\Models\Customer;
use App\Models\Employee;
use App\Services\AccessControl;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\RateLimiter;
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
        Gate::before(function (Employee $employee, string $ability): ?bool {
            if (! array_key_exists($ability, config('permissions.permissions'))) {
                return null;
            }

            return app(AccessControl::class)->can($employee, $ability);
        });

        RateLimiter::for('login', fn (Request $request) => Limit::perMinute(10)->by($request->string('phone')->lower()->toString().'|'.$request->ip()));

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
