<?php

namespace App\Http\Controllers\Api\V1\Customers;

use App\Http\Controllers\Api\V1\ApiController;
use App\Models\CustomerCategory;
use App\Services\Customers\CategoryFormValidator;
use App\Services\Customers\TanzaniaLocations;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;

/**
 * Registration dropdown data: Mkoa → Wilaya → Kata → Mtaa (all-ward.json) and the customer categories
 * with their dynamic form schemas and option trees.
 */
class LookupController extends ApiController
{
    public function __construct(private TanzaniaLocations $locations) {}

    public function regions(): JsonResponse
    {
        $this->authorizeLookup();

        return $this->options(collect($this->locations->regions())->map(fn (array $item): array => ['value' => $item['code'], 'label' => $item['name']]));
    }

    public function districts(Request $request): JsonResponse
    {
        $this->authorizeLookup();

        return $this->options(collect($this->locations->districts($request->string('region')->toString()))->map(fn (array $item): array => ['value' => $item['code'], 'label' => $item['name']]));
    }

    public function wards(Request $request): JsonResponse
    {
        $this->authorizeLookup();

        return $this->options(collect($this->locations->wards($request->string('district')->toString()))->map(fn (array $item): array => ['value' => $item['code'], 'label' => $item['name']]));
    }

    public function streets(Request $request): JsonResponse
    {
        $this->authorizeLookup();

        return $this->options(collect($this->locations->streets($request->string('ward')->toString()))->map(fn (string $name): array => ['value' => $name, 'label' => $name]));
    }

    public function categories(): JsonResponse
    {
        $this->authorizeLookup();

        $categories = CustomerCategory::where('company_id', $this->currentEmployee()->company_id)
            ->where('is_active', true)
            ->with('loanCategories:id,name')
            ->orderBy('id')
            ->get();

        return response()->json(['data' => $categories->map(fn (CustomerCategory $category): array => [
            'id' => $category->id,
            'key' => $category->key,
            'name' => $category->name,
            'icon' => $category->icon,
            'section_title' => $category->section_title,
            'risk_level' => $category->risk_level,
            'min_loan_amount' => (float) $category->min_loan_amount,
            'max_loan_amount' => (float) $category->max_loan_amount,
            'required_documents' => $category->required_documents,
            'form_schema' => $category->form_schema,
            'loan_categories' => $category->loanCategories->map(fn ($product): array => ['id' => $product->id, 'name' => $product->name])->values(),
        ])]);
    }

    public function optionTrees(CategoryFormValidator $forms): JsonResponse
    {
        $this->authorizeLookup();

        return response()->json(['data' => $forms->optionTrees()])->header('Cache-Control', 'private, max-age=3600');
    }

    private function authorizeLookup(): void
    {
        $this->authorizeAny('customers.register', 'customers.update', 'customers.view');
    }

    /**
     * @param  Collection<int, array{value: string, label: string}>  $options
     */
    private function options($options): JsonResponse
    {
        return response()->json(['data' => $options->values()]);
    }
}
