<?php

use App\Http\Controllers\Api\V1\Agent\AgentTransactionController;
use App\Http\Controllers\Api\V1\Agent\PaymentModeController;
use Illuminate\Support\Facades\Route;

Route::prefix('agent')->name('agent.')->group(function (): void {
    Route::apiResource('payment-modes', PaymentModeController::class)->only(['index', 'store', 'destroy']);

    Route::controller(AgentTransactionController::class)->group(function (): void {
        Route::get('transactions', 'index')->name('transactions.index');
        Route::post('transactions', 'store')->name('transactions.store');
        Route::post('transactions/{agentTransaction}/reverse', 'reverse')->name('transactions.reverse');
        Route::get('deposits', 'deposits')->name('deposits');
        Route::get('balances', 'balances')->name('balances');
    });
});
