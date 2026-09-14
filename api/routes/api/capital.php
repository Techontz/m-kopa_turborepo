<?php

use App\Http\Controllers\Api\V1\Capital\AssetController;
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

    Route::controller(AssetController::class)->prefix('assets')->name('assets.')->group(function (): void {
        Route::get('config', 'config')->name('config');
        Route::get('scan/{token}', 'scan')->where('token', '[A-Za-z0-9-]{1,64}')->name('scan');
        Route::get('/', 'index')->name('index');
        Route::post('/', 'store')->name('store');
        Route::get('{asset}', 'show')->whereNumber('asset')->name('show');
        Route::patch('{asset}', 'update')->whereNumber('asset')->name('update');
        Route::post('{asset}/transfer', 'transfer')->whereNumber('asset')->name('transfer');
        Route::post('{asset}/status', 'status')->whereNumber('asset')->name('status');
        Route::post('{asset}/revaluations', 'revalue')->whereNumber('asset')->name('revaluations.store');
        Route::post('{asset}/reverse', 'reverse')->whereNumber('asset')->name('reverse');
        Route::get('{asset}/qr', 'qr')->whereNumber('asset')->name('qr');
        Route::post('{asset}/documents', 'storeDocument')->whereNumber('asset')->name('documents.store');
        Route::get('{asset}/documents/{document}', 'document')->whereNumber(['asset', 'document'])->name('documents.show');
        Route::delete('{asset}/documents/{document}', 'destroyDocument')->whereNumber(['asset', 'document'])->name('documents.destroy');
    });

    Route::controller(DividendController::class)->group(function (): void {
        Route::get('dividends', 'index')->name('dividends.index');
        Route::get('dividends/summary', 'summary')->name('dividends.summary');
        Route::get('dividends/available-profit', 'availableProfit')->name('dividends.available-profit');
        Route::get('dividends/preview', 'preview')->name('dividends.preview');
        Route::post('dividends/preview', 'preview')->name('dividends.preview.post');
        Route::get('dividends/payments', 'payments')->name('dividends.payments');
        Route::post('dividends', 'store')->name('dividends.store');
        Route::get('dividends/{declaration}/allocations', 'allocations')->whereNumber('declaration')->name('dividends.allocations');
        Route::get('dividends/allocations/{allocation}/payments', 'allocationPayments')->name('dividends.allocations.payments');
        Route::post('dividends/allocations/{allocation}/pay', 'pay')->name('dividends.pay');
        Route::get('dividends/{declaration}/pay-all/preview', 'payAllPreview')->whereNumber('declaration')->name('dividends.pay-all.preview');
        Route::post('dividends/{declaration}/pay-all', 'payAll')->whereNumber('declaration')->name('dividends.pay-all');
        Route::post('dividends/payments/{payment}/reverse', 'reverse')->name('dividends.payments.reverse');
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
