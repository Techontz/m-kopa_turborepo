<?php

use App\Http\Controllers\Api\V1\Customers\CustomerController;
use App\Http\Controllers\Api\V1\Customers\DocumentController;
use App\Http\Controllers\Api\V1\Customers\GuarantorController;
use App\Http\Controllers\Api\V1\Customers\LookupController;
use App\Http\Controllers\Api\V1\Customers\RegistrationController;
use Illuminate\Support\Facades\Route;

Route::prefix('customers')->name('customers.')->group(function (): void {
    Route::controller(LookupController::class)->group(function (): void {
        Route::get('locations/regions', 'regions')->name('locations.regions');
        Route::get('locations/districts', 'districts')->name('locations.districts');
        Route::get('locations/wards', 'wards')->name('locations.wards');
        Route::get('locations/streets', 'streets')->name('locations.streets');
        Route::get('categories', 'categories')->name('categories');
        Route::get('categories/option-trees', 'optionTrees')->name('categories.option-trees');
    });

    Route::controller(RegistrationController::class)->group(function (): void {
        Route::post('nida/lookup', 'lookup')->middleware('throttle:30,1')->name('nida.lookup');
        Route::post('nida/resend-otp', 'resendOtp')->middleware('throttle:10,1')->name('nida.resend');
        Route::post('nida/verify', 'verifyOtp')->middleware('throttle:30,1')->name('nida.verify');
        Route::post('register', 'register')->name('register');
        Route::post('{customer}/face', 'face')->whereNumber('customer')->name('face');
        Route::put('{customer}/additional', 'additional')->whereNumber('customer')->name('additional');
        Route::put('{customer}/category', 'category')->whereNumber('customer')->name('category');
    });

    Route::controller(GuarantorController::class)->group(function (): void {
        Route::post('{customer}/guarantors', 'store')->whereNumber('customer')->name('guarantors.store');
        Route::put('guarantors/{guarantor}', 'update')->name('guarantors.update');
        Route::delete('guarantors/{guarantor}', 'destroy')->name('guarantors.destroy');
    });

    Route::controller(DocumentController::class)->group(function (): void {
        Route::post('{customer}/documents', 'store')->whereNumber('customer')->name('documents.store');
        Route::get('{customer}/documents/{document}/file', 'file')->whereNumber('customer')->name('documents.file');
        Route::delete('{customer}/documents/{document}', 'destroy')->whereNumber('customer')->name('documents.destroy');
    });

    Route::controller(CustomerController::class)->group(function (): void {
        Route::get('/', 'index')->name('index');
        Route::get('{customer}', 'show')->whereNumber('customer')->name('show');
        Route::put('{customer}', 'update')->whereNumber('customer')->name('update');
        Route::delete('{customer}', 'destroy')->whereNumber('customer')->name('destroy');
        Route::get('{customer}/eligibility', 'eligibility')->whereNumber('customer')->name('eligibility');
        Route::get('{customer}/balance', 'balance')->whereNumber('customer')->name('balance');
        Route::get('{customer}/photo', 'photo')->whereNumber('customer')->name('photo');
        Route::post('{customer}/kyc/approve', 'approveKyc')->whereNumber('customer')->name('kyc.approve');
        Route::post('{customer}/mark', 'mark')->whereNumber('customer')->name('mark');
        Route::post('{customer}/sms', 'sendSms')->whereNumber('customer')->name('sms');
    });
});
