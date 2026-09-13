<?php

/*
|--------------------------------------------------------------------------
| External integrations
|--------------------------------------------------------------------------
|
| Every external provider is accessed through a contract in app/Integrations/<Provider>
| with a "test" driver (realistic simulated behaviour, including failures) and a real
| driver selected by environment. No credentials are committed.
|
*/

return [
    'nida' => [
        'driver' => env('NIDA_DRIVER', 'test'),
        'base_url' => env('NIDA_BASE_URL'),
        'api_key' => env('NIDA_API_KEY'),
    ],
    'face' => [
        'driver' => env('FACE_DRIVER', 'test'),
        'base_url' => env('FACE_BASE_URL'),
        'api_key' => env('FACE_API_KEY'),
    ],
    'vodacom' => [
        'driver' => env('VODACOM_DRIVER', 'test'),
        'base_url' => env('VODACOM_BASE_URL'),
        'api_key' => env('VODACOM_API_KEY'),
        'callback_secret' => env('VODACOM_CALLBACK_SECRET'),
    ],
    'bank_mandate' => [
        'driver' => env('BANK_MANDATE_DRIVER', 'test'),
        'base_url' => env('BANK_MANDATE_BASE_URL'),
        'api_key' => env('BANK_MANDATE_API_KEY'),
    ],
    'payments' => [
        'webhook_secret' => env('PAYMENTS_WEBHOOK_SECRET'),
    ],
    'sms' => [
        'driver' => env('SMS_DRIVER', 'log'),
        'sender_id' => env('SMS_SENDER_ID', 'MIKOPOFASTA'),
        'api_key' => env('SMS_API_KEY'),
    ],
];
