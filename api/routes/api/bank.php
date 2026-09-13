<?php

use App\Http\Controllers\Api\V1\Bank\BankAccountController;
use App\Http\Controllers\Api\V1\Bank\BankTransferController;
use App\Http\Controllers\Api\V1\Bank\PayrollController;
use Illuminate\Support\Facades\Route;

Route::prefix('bank')->name('bank.')->group(function (): void {
    Route::get('balances', [BankAccountController::class, 'balances'])->name('balances');
    Route::get('options/accounts', [BankAccountController::class, 'options'])->name('options.accounts');
    Route::get('options/branch-accounts', [BankTransferController::class, 'branchAccountOptions'])->name('options.branch-accounts');
    Route::apiResource('accounts', BankAccountController::class)->except('show')->parameters(['accounts' => 'bankAccount']);

    Route::controller(BankTransferController::class)->group(function (): void {
        Route::get('transfers', 'index')->name('transfers.index');
        Route::post('transfers', 'store')->name('transfers.store');
        Route::post('transfers/{bankTransfer}/approve', 'approve')->name('transfers.approve');
        Route::delete('transfers/{bankTransfer}', 'destroy')->name('transfers.destroy');
        Route::get('to-branch', 'toBranchIndex')->name('to-branch.index');
        Route::post('to-branch', 'toBranchStore')->name('to-branch.store');
        Route::get('to-hq', 'toHqIndex')->name('to-hq.index');
        Route::post('to-hq', 'toHqStore')->name('to-hq.store');
    });

    Route::controller(PayrollController::class)->group(function (): void {
        Route::get('payroll', 'index')->name('payroll.index');
        Route::get('payroll/{date}', 'show')->name('payroll.show');
    });
});
