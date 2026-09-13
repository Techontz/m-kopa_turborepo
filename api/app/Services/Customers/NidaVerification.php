<?php

namespace App\Services\Customers;

use App\Integrations\Nida\NidaConnector;
use App\Integrations\Nida\NidaIdentity;
use App\Integrations\Sms\SmsGateway;
use App\Models\Customer;
use App\Models\Employee;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * NIDA lookup + OTP to the phone registered at NIDA ("Hakuna registration bila OTP").
 * A verification is held in cache for 10 minutes and may be used once to register a customer.
 */
class NidaVerification
{
    public const TTL_MINUTES = 10;

    public const MAX_ATTEMPTS = 5;

    /** Deterministic code used by the test / log SMS drivers. */
    public const TEST_OTP = '123456';

    public function __construct(private NidaConnector $nida, private SmsGateway $sms) {}

    /**
     * @return array{verification_id: string, identity: array<string, string|null>, expires_in: int}
     */
    public function start(string $nidaNumber, Employee $employee): array
    {
        if (Customer::where('company_id', $employee->company_id)->where('id_number', $nidaNumber)->exists()) {
            throw ValidationException::withMessages(['nida_number' => 'Customer with this NIDA number is already registered']);
        }

        $identity = $this->nida->lookup($nidaNumber);
        if ($identity === null) {
            throw ValidationException::withMessages(['nida_number' => 'NIDA number not found']);
        }

        $id = (string) Str::uuid();
        $this->put($id, [
            'identity' => $identity->toArray(),
            'company_id' => $employee->company_id,
            'employee_id' => $employee->id,
            'attempts' => 0,
            'verified_at' => null,
        ] + $this->newCode($identity));

        return ['verification_id' => $id, 'identity' => $this->display($identity), 'expires_in' => self::TTL_MINUTES * 60];
    }

    public function resend(string $id, Employee $employee): void
    {
        $state = $this->state($id, $employee);
        $identity = NidaIdentity::fromArray($state['identity']);

        $this->put($id, array_merge($state, $this->newCode($identity), ['attempts' => 0]));
    }

    /**
     * @return array<string, string|null>
     */
    public function verify(string $id, string $otp, Employee $employee): array
    {
        $state = $this->state($id, $employee);

        if ($state['attempts'] >= self::MAX_ATTEMPTS) {
            throw ValidationException::withMessages(['otp' => 'Too many wrong attempts. Please resend OTP']);
        }

        if (! Hash::check($otp, $state['code_hash'])) {
            $state['attempts']++;
            $this->put($id, $state);

            throw ValidationException::withMessages(['otp' => 'Invalid OTP code']);
        }

        $state['verified_at'] = now()->toIso8601String();
        $this->put($id, $state);

        return $this->display(NidaIdentity::fromArray($state['identity']));
    }

    /**
     * Consume a verified session and return the NIDA identity with verification times.
     *
     * @return array{identity: NidaIdentity, otp_verified_at: string, otp_phone: string}
     */
    public function consume(string $id, Employee $employee): array
    {
        $state = $this->state($id, $employee);

        if ($state['verified_at'] === null) {
            throw ValidationException::withMessages(['otp' => 'Please verify the OTP sent to the customer first']);
        }

        Cache::forget($this->key($id));

        return ['identity' => NidaIdentity::fromArray($state['identity']), 'otp_verified_at' => $state['verified_at'], 'otp_phone' => $state['identity']['phone']];
    }

    /**
     * @return array<string, mixed>
     */
    private function state(string $id, Employee $employee): array
    {
        $state = Cache::get($this->key($id));

        if (! is_array($state) || $state['company_id'] !== $employee->company_id) {
            throw ValidationException::withMessages(['verification_id' => 'NIDA verification expired. Please search the NIDA number again']);
        }

        return $state;
    }

    /**
     * @return array{code_hash: string}
     */
    private function newCode(NidaIdentity $identity): array
    {
        $code = in_array(config('integrations.sms.driver'), ['log', 'test'], true) ? self::TEST_OTP : (string) random_int(100000, 999999);

        $this->sms->send($identity->phone, "MIKOPOFASTA: Namba yako ya uthibitisho (OTP) ni {$code}. Itaisha baada ya dakika ".self::TTL_MINUTES.'.');

        return ['code_hash' => Hash::make($code)];
    }

    /**
     * @return array<string, string|null>
     */
    private function display(NidaIdentity $identity): array
    {
        return $identity->toArray() + ['phone_masked' => substr($identity->phone, 0, 5).'****'.substr($identity->phone, -3)];
    }

    /**
     * @param  array<string, mixed>  $state
     */
    private function put(string $id, array $state): void
    {
        Cache::put($this->key($id), $state, now()->addMinutes(self::TTL_MINUTES));
    }

    private function key(string $id): string
    {
        return 'nida-verification:'.$id;
    }
}
