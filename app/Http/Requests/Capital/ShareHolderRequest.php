<?php

namespace App\Http\Requests\Capital;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class ShareHolderRequest extends FormRequest
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
            'share_name' => ['required', 'string', 'max:255'],
            'share_mobile' => ['required', 'string', 'max:30'],
            'share_email' => ['required', 'email', 'max:255'],
            'share_sex' => ['nullable', 'in:male,female'],
            'share_dob' => ['required', 'date', 'before:today'],
        ];
    }

    /**
     * @return array{name: string, mobile: string, email: string, gender: string|null, date_of_birth: string}
     */
    public function shareHolderData(): array
    {
        return [
            'name' => $this->string('share_name')->trim()->toString(),
            'mobile' => $this->string('share_mobile')->trim()->toString(),
            'email' => $this->string('share_email')->trim()->toString(),
            'gender' => $this->filled('share_sex') ? $this->string('share_sex')->toString() : null,
            'date_of_birth' => $this->string('share_dob')->toString(),
        ];
    }
}
