<?php

use App\Http\Controllers\Api\V1\Capital\CapitalController;
use App\Http\Controllers\Api\V1\Capital\CapitalOptionController;
use App\Http\Controllers\Api\V1\Capital\DividendController;
use App\Http\Controllers\Api\V1\Capital\FloatController;
use App\Http\Controllers\Api\V1\Capital\ShareHolderController;
use Illuminate\Support\Facades\Route;

Route::prefix('capital')->name('capital.')->group(function (): void {
    Route::apiResource('share-holders', ShareHolderController::class);
    Route::get('share-holders/{share_holder}/photo', [ShareHolderController::class, 'photo'])->name('share-holders.photo');
    Route::get('share-holders/{shareHolder}/contributions', [CapitalController::class, 'history'])->name('share-holders.contributions');
    Route::get('position', [CapitalController::class, 'position'])->name('position');

    Route::get('capitals', [CapitalController::class, 'index'])->name('capitals.index');
    Route::post('capitals', [CapitalController::class, 'store'])->name('capitals.store');
    Route::post('capitals/{capital}/receipt', [CapitalController::class, 'replaceReceipt'])->name('capitals.receipt.update');
    Route::get('capitals/{capital}/receipt', [CapitalController::class, 'receipt'])->name('capitals.receipt');

    Route::controller(DividendController::class)->group(function (): void {
        Route::get('dividends', 'index')->name('dividends.index');
        Route::get('dividends/summary', 'summary')->name('dividends.summary');
        Route::post('dividends', 'store')->name('dividends.store');
        Route::post('dividends/allocations/{allocation}/pay', 'pay')->name('dividends.pay');
    });

    Route::controller(FloatController::class)->prefix('floats')->name('floats.')->group(function (): void {
        Route::get('/', 'company')->name('company');
        Route::post('/', 'storeCompany')->name('company.store');
        Route::get('balances', 'balances')->name('balances');
        Route::get('branch', 'branch')->name('branch');
        Route::post('branch', 'storeBranch')->name('branch.store');
        Route::post('branch/{floatTransfer}/approve', 'approve')->name('approve');
        Route::delete('branch/{floatTransfer}', 'destroy')->name('destroy');
        Route::get('approved', 'approved')->name('approved');
        Route::get('accounts', 'accounts')->name('accounts');
        Route::post('accounts', 'storeAccounts')->name('accounts.store');
    });

    Route::controller(CapitalOptionController::class)->prefix('options')->name('options.')->group(function (): void {
        Route::get('share-holders', 'shareHolders')->name('share-holders');
        Route::get('bank-accounts', 'bankAccounts')->name('bank-accounts');
    });
});
