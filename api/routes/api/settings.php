<?php

use App\Http\Controllers\Api\V1\Settings\BranchController;
use Illuminate\Support\Facades\Route;

Route::prefix('settings')->name('settings.')->group(function (): void {
    Route::apiResource('branches', BranchController::class);
});
