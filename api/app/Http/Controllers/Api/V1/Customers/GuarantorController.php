<?php

namespace App\Http\Controllers\Api\V1\Customers;

use App\Http\Controllers\Api\V1\ApiController;
use App\Http\Requests\Customers\GuarantorRequest;
use App\Models\Customer;
use App\Models\Guarantor;
use Illuminate\Http\JsonResponse;

/**
 * Profile → Guarantors tab ("Gualantors List").
 */
class GuarantorController extends ApiController
{
    public function store(GuarantorRequest $request, Customer $customer): JsonResponse
    {
        $this->authorizeAny('customers.register', 'customers.update');
        $this->assertAccessible($customer);

        $guarantor = $customer->guarantors()->create($this->normalised($request->validated()));

        return $this->message('Guarantor Registered successfully', 201, ['data' => ['id' => $guarantor->id]]);
    }

    public function update(GuarantorRequest $request, Guarantor $guarantor): JsonResponse
    {
        $this->authorizeAny('customers.register', 'customers.update');
        $this->assertAccessible($guarantor->customer);

        $guarantor->update($this->normalised($request->validated()));

        return $this->message('Guarantor Updated successfully');
    }

    public function destroy(Guarantor $guarantor): JsonResponse
    {
        $this->authorizeAny('customers.update');
        $this->assertAccessible($guarantor->customer);

        $guarantor->delete();

        return $this->message('Guarantor Removed successfully');
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function normalised(array $data): array
    {
        return array_merge($data, ['middle_name' => $data['middle_name'] ?? null]);
    }

    private function assertAccessible(Customer $customer): void
    {
        abort_unless($this->scoped(Customer::query())->whereKey($customer->id)->exists(), 404);
    }
}
