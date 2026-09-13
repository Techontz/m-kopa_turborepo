<?php

namespace App\Services\Customers;

use App\Integrations\Face\FaceVerifier;
use App\Models\AuditLog;
use App\Models\Customer;
use App\Models\Employee;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * KYC completion logic (Documents: "Customer anakuwa KYC complete kama: NIDA Verified, OTP Verified,
 * Face Verified, Additional data filled, Category assigned") plus the category's required documents.
 */
class KycService
{
    /** Private disk holding face captures and KYC documents. */
    public const DISK = 'local';

    public function __construct(private FaceVerifier $faces) {}

    /**
     * @return list<array{key: string, label: string, done: bool}>
     */
    public function checklist(Customer $customer): array
    {
        $customer->loadMissing(['kyc', 'residence', 'bankDetail', 'nextOfKin', 'documents', 'customerCategory']);
        $kyc = $customer->kyc;
        $category = $customer->customerCategory;
        $uploadedTypes = $customer->documents->pluck('document_type')->unique();

        return [
            ['key' => 'nida', 'label' => 'NIDA Verified', 'done' => $kyc?->nida_verified_at !== null],
            ['key' => 'otp', 'label' => 'OTP Verified', 'done' => $kyc?->otp_verified_at !== null],
            ['key' => 'face', 'label' => 'Face Verified', 'done' => $kyc?->face_verified_at !== null],
            ['key' => 'details', 'label' => 'Additional data filled', 'done' => filled($customer->marital_status) && $customer->residence !== null && $customer->bankDetail !== null && $customer->nextOfKin !== null],
            ['key' => 'category', 'label' => 'Category assigned', 'done' => $category !== null && $kyc?->category_answers !== null],
            ['key' => 'documents', 'label' => 'Required documents uploaded', 'done' => $category !== null && collect($category->required_documents)->diff($uploadedTypes)->isEmpty()],
        ];
    }

    public function isComplete(Customer $customer): bool
    {
        return collect($this->checklist($customer))->every(fn (array $item): bool => $item['done']);
    }

    /**
     * "completed" (checklist done), "pending" (new registration in progress) or "legacy"
     * (registered before NIDA KYC existed; the live manual KYC approval still applies).
     */
    public function status(Customer $customer): string
    {
        $customer->loadMissing('kyc');

        if ($customer->kyc === null) {
            return 'legacy';
        }

        return $this->isComplete($customer) ? 'completed' : 'pending';
    }

    /**
     * Keep customers.kyc_status / registration_step in line with the checklist.
     */
    public function sync(Customer $customer): void
    {
        $customer->unsetRelation('documents')->unsetRelation('residence')->unsetRelation('bankDetail')->unsetRelation('nextOfKin')->unsetRelation('customerCategory')->unsetRelation('kyc');

        if ($customer->kyc()->doesntExist()) {
            return;
        }

        $kyc = $customer->kyc()->first();
        $complete = $this->isComplete($customer);

        if ($complete && $kyc->completed_at === null) {
            $kyc->update(['completed_at' => now()]);
            $customer->update(['kyc_status' => 'approved', 'registration_step' => Customer::STEP_COMPLETE]);
            $this->audit($customer, 'Customer.kyc_completed');
        } elseif (! $complete && $kyc->completed_at !== null) {
            $kyc->update(['completed_at' => null]);
            $customer->update(['kyc_status' => 'pending']);
            $this->audit($customer, 'Customer.kyc_reopened');
        }

        $customer->unsetRelation('kyc');
    }

    /**
     * Run live liveness on camera frames (data URLs). The best frame becomes the profile photo.
     *
     * @param  list<string>  $frames
     *
     * @throws ValidationException
     */
    public function verifyFace(Customer $customer, array $frames): void
    {
        $kyc = $customer->kyc;
        if ($kyc === null) {
            throw ValidationException::withMessages(['frames' => 'Verify the customer NIDA and OTP first']);
        }

        $binaries = array_map(function (string $frame): string {
            [, $encoded] = array_pad(explode(',', $frame, 2), 2, '');

            return (string) base64_decode($encoded, true);
        }, $frames);

        $reference = null;
        if (! empty($kyc->nida_data['photo']) && str_contains($kyc->nida_data['photo'], ',')) {
            $reference = base64_decode(explode(',', $kyc->nida_data['photo'], 2)[1], true) ?: null;
        }

        $result = $this->faces->verify($binaries, $reference);
        $kyc->increment('face_attempts');

        if (! $result->passed) {
            throw ValidationException::withMessages(['frames' => $result->reason ?? 'Face verification failed']);
        }

        $photo = $binaries[intdiv(count($binaries), 2)];
        $path = 'customers/faces/'.$customer->id.'-'.Str::random(10).'.jpg';
        Storage::disk(self::DISK)->put($path, $photo);

        if ($kyc->face_photo) {
            Storage::disk(self::DISK)->delete($kyc->face_photo);
        }

        $kyc->update([
            'face_verified_at' => now(),
            'face_liveness_score' => $result->livenessScore,
            'face_match_score' => $result->matchScore,
            'face_reference' => $result->reference,
            'face_photo' => $path,
        ]);
        $customer->update(['registration_step' => max($customer->registration_step, Customer::STEP_ADDITIONAL)]);

        $this->audit($customer, 'Customer.face_verified', ['liveness_score' => $result->livenessScore, 'match_score' => $result->matchScore]);
    }

    /**
     * @param  array<string, mixed>  $after
     */
    public function audit(Customer $customer, string $action, array $after = [], array $before = []): void
    {
        /** @var Employee|null $employee */
        $employee = auth()->user();

        AuditLog::create([
            'company_id' => $customer->company_id,
            'employee_id' => $employee?->id,
            'action' => $action,
            'auditable_type' => $customer->getMorphClass(),
            'auditable_id' => $customer->id,
            'before' => $before ?: null,
            'after' => $after ?: null,
            'ip_address' => request()?->ip(),
        ]);
    }
}
