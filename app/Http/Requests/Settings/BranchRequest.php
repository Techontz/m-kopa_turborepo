<?php

namespace App\Http\Requests\Settings;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class BranchRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'blanch_name' => ['required', 'string', 'max:255'],
            'region_id' => ['required', 'exists:regions,id'],
            'blanch_no' => ['required', 'string', 'max:30'],
            'branch_type' => ['required', 'in:main,sub'],
        ];
    }

    /**
     * @return array{name: string, region_id: int, phone: string, type: string}
     */
    public function branchData(): array
    {
        return [
            'name' => $this->string('blanch_name')->toString(),
            'region_id' => $this->integer('region_id'),
            'phone' => $this->string('blanch_no')->toString(),
            'type' => $this->string('branch_type')->toString(),
        ];
    }
}
