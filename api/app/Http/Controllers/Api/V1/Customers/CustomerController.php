<?php

namespace App\Http\Controllers\Api\V1\Customers;

use App\Enums\LoanStatus;
use App\Http\Controllers\Api\V1\ApiController;
use App\Http\Requests\Api\Customers\UpdateCustomerRequest;
use App\Http\Resources\Api\V1\Customers\CustomerProfileResource;
use App\Http\Resources\Api\V1\Customers\CustomerResource;
use App\Integrations\Sms\SmsGateway;
use App\Models\Customer;
use App\Models\SmsLog;
use App\Services\CustomerEligibility;
use App\Services\Customers\KycService;
use App\Services\LoanService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Throwable;

/**
 * Customer → All Customer (admin/all_customer), Customer profile (admin/customer_profile/{id}) and its actions.
 */
class CustomerController extends ApiController
{
    /**
     * Live status filter values (ACTIVE / DEFAULT / CLOSED).
     *
     * @var array<string, string>
     */
    private const STATUS_FILTER = ['ACTIVE' => 'open', 'DEFAULT' => 'out', 'CLOSED' => 'close', 'PENDING' => 'pending'];

    public function __construct(private KycService $kyc) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $this->authorizeAny('customers.view');

        $status = $request->string('customer_status')->upper()->toString();

        $customers = $this->applyFilters($this->scoped(Customer::query()), $request)
            ->with(['branch:id,name', 'customerCategory:id,name'])
            ->when(isset(self::STATUS_FILTER[$status]), fn ($query) => $query->where('status', self::STATUS_FILTER[$status]))
            ->when($request->filled('kyc_status'), fn ($query) => $query->where('kyc_status', $request->string('kyc_status')->toString()))
            ->latest('id')
            ->get();

        return CustomerResource::collection($customers);
    }

    public function show(Customer $customer): CustomerProfileResource
    {
        $this->authorizeAny('customers.view');
        $this->assertAccessible($customer);

        return new CustomerProfileResource($customer->load([
            'branch', 'employee', 'region', 'customerCategory', 'kyc', 'residence', 'bankDetail', 'nextOfKin', 'documents',
            'guarantors.region', 'loans.category',
        ]));
    }

    public function update(UpdateCustomerRequest $request, Customer $customer): JsonResponse
    {
        $this->authorizeAny('customers.update');
        $this->assertAccessible($customer);
        $this->assertBranchAccessible($request->integer('blanch_id'));

        $customer->update($request->customerData());

        return $this->message('Customer information updated successfully');
    }

    /**
     * Rules for the Loans module: allowed loan_category ids, limits, risk level and KYC completion.
     */
    public function eligibility(Customer $customer, CustomerEligibility $eligibility): JsonResponse
    {
        $this->authorizeAny('customers.view', 'loans.view', 'loans.apply');
        $this->assertAccessible($customer);

        return response()->json(['data' => $eligibility->for($customer)]);
    }

    /**
     * Live "KYC status" tab. NIDA-registered customers are approved automatically when the checklist completes,
     * so a manual approval is only accepted for them once the checklist is complete; legacy customers keep the live manual approval.
     */
    public function approveKyc(Customer $customer): JsonResponse
    {
        $this->authorizeAny('customers.update');
        $this->assertAccessible($customer);

        if ($this->kyc->status($customer) === 'pending') {
            return $this->message('KYC checklist is not complete', 422, ['errors' => ['kyc' => ['KYC checklist is not complete']]]);
        }

        $customer->update(['kyc_status' => 'approved']);

        return $this->message('Customer KYC Aproved successfully');
    }

    public function mark(Customer $customer): JsonResponse
    {
        $this->authorizeAny('customers.update');
        $this->assertAccessible($customer);

        $customer->update(['is_marked' => ! $customer->is_marked]);

        return $this->message($customer->is_marked ? 'Customer Marked successfully' : 'Customer Unmarked successfully');
    }

    public function sendSms(Request $request, Customer $customer, SmsGateway $sms): JsonResponse
    {
        $this->authorizeAny('customers.update', 'messages.use');
        $this->assertAccessible($customer);
        $validated = $request->validate(['message' => ['required', 'string', 'max:480']]);

        try {
            $sms->send($customer->phone, $validated['message']);
        } catch (Throwable $exception) {
            report($exception);

            return $this->message('Message could not be sent', 422, ['errors' => ['message' => ['Message could not be sent']]]);
        }

        SmsLog::create(['company_id' => $customer->company_id, 'customer_id' => $customer->id, 'phone' => $customer->phone, 'message' => $validated['message']]);

        return $this->message('Message sent successfully');
    }

    /**
     * Live Balance modal: deductions against the latest loan.
     */
    public function balance(Customer $customer, LoanService $loans): JsonResponse
    {
        $this->authorizeAny('customers.view');
        $this->assertAccessible($customer);

        $latestLoan = $customer->loans()->latest('id')->first();
        $empty = ['remain_loan' => 0, 'salary_advance' => 0, 'penalty' => 0, 'loan_fee' => 0, 'total' => 0, 'remain_cash' => 0];

        return response()->json(['data' => $latestLoan ? $loans->deductions($latestLoan) : $empty]);
    }

    public function photo(Customer $customer): StreamedResponse
    {
        $this->authorizeAny('customers.view');
        $this->assertAccessible($customer);

        $path = $customer->kyc?->face_photo;
        abort_unless($path && Storage::disk(KycService::DISK)->exists($path), 404);

        return Storage::disk(KycService::DISK)->response($path, null, ['Content-Type' => 'image/jpeg', 'Cache-Control' => 'private, max-age=300']);
    }

    public function destroy(Customer $customer): JsonResponse
    {
        $this->authorizeAny('customers.update');
        $this->assertAccessible($customer);

        if ($customer->loans()->whereNotIn('status', [LoanStatus::Rejected->value, LoanStatus::Cancelled->value])->exists()) {
            return $this->message('Customer has loans and cannot be deleted', 422);
        }

        $files = array_filter([$customer->kyc?->face_photo, ...$customer->documents()->pluck('file_path')->all()]);
        $customer->delete();
        Storage::disk(KycService::DISK)->delete($files);

        return $this->message('Customer Deleted successfully');
    }

    private function assertAccessible(Customer $customer): void
    {
        abort_unless($this->scoped(Customer::query())->whereKey($customer->id)->exists(), 404);
    }
}
