<?php

namespace App\Http\Controllers\Api\V1\Customers;

use App\Http\Controllers\Api\V1\ApiController;
use App\Models\Customer;
use App\Models\CustomerDocument;
use App\Services\Customers\KycService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Required documents per customer category ("Required documents — Fomu gani ajaze"). Stored on the private disk.
 */
class DocumentController extends ApiController
{
    public function __construct(private KycService $kyc) {}

    public function store(Request $request, Customer $customer): JsonResponse
    {
        $this->authorizeAny('customers.register', 'customers.update');
        $this->assertAccessible($customer);

        $required = $customer->customerCategory?->required_documents ?? [];
        if ($required === []) {
            return $this->message('Assign the customer category first', 422, ['errors' => ['document_type' => ['Assign the customer category first']]]);
        }

        $validated = $request->validate([
            'document_type' => ['required', Rule::in($required)],
            'file' => ['required', 'file', 'mimes:pdf,jpg,jpeg,png', 'max:10240'],
        ], ['file.mimes' => 'PDF or image (jpg, png) file is Allowed please change Your file']);

        $file = $request->file('file');
        $document = $customer->documents()->create([
            'document_type' => $validated['document_type'],
            'file_path' => $file->store('customers/documents/'.$customer->id, KycService::DISK),
            'original_name' => mb_substr($file->getClientOriginalName(), 0, 250),
            'mime_type' => $file->getMimeType(),
            'size' => (int) $file->getSize(),
            'uploaded_by' => $this->currentEmployee()->id,
        ]);

        $this->kyc->audit($customer, 'Customer.document_uploaded', ['document_type' => $document->document_type, 'document_id' => $document->id]);
        $this->kyc->sync($customer);

        return $this->message('Document uploaded successfully', 201, ['data' => ['id' => $document->id]]);
    }

    public function file(Customer $customer, CustomerDocument $document): StreamedResponse
    {
        $this->authorizeAny('customers.view');
        $this->assertAccessible($customer);
        abort_unless($document->customer_id === $customer->id && Storage::disk(KycService::DISK)->exists($document->file_path), 404);

        return Storage::disk(KycService::DISK)->response($document->file_path, $document->original_name);
    }

    public function destroy(Customer $customer, CustomerDocument $document): JsonResponse
    {
        $this->authorizeAny('customers.register', 'customers.update');
        $this->assertAccessible($customer);
        abort_unless($document->customer_id === $customer->id, 404);

        Storage::disk(KycService::DISK)->delete($document->file_path);
        $document->delete();

        $this->kyc->audit($customer, 'Customer.document_deleted', [], ['document_type' => $document->document_type, 'document_id' => $document->id]);
        $this->kyc->sync($customer);

        return $this->message('Document Deleted successfully');
    }

    private function assertAccessible(Customer $customer): void
    {
        abort_unless($this->scoped(Customer::query())->whereKey($customer->id)->exists(), 404);
    }
}
