<?php

namespace App\Http\Requests\Api\Capital;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Register / edit share holder (live admin/shareHolder, with the name split into first / middle / last and a
 * passport-size photo). The photo is required when registering and optional when editing (keeps the current one).
 */
class ShareHolderRequest extends FormRequest
{
    public const PHOTO_MAX_KB = 2048;

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
            'first_name' => ['required', 'string', 'max:100'],
            'middle_name' => ['nullable', 'string', 'max:100'],
            'last_name' => ['required', 'string', 'max:100'],
            'share_mobile' => ['required', 'string', 'max:30'],
            'share_email' => ['required', 'email', 'max:255'],
            'share_sex' => ['nullable', 'in:male,female'],
            'share_dob' => ['required', 'date', 'before:today'],
            'passport_photo' => [$this->route('share_holder') === null ? 'required' : 'nullable', 'file', 'image', 'mimes:jpg,jpeg,png,webp', 'max:'.self::PHOTO_MAX_KB, 'dimensions:min_width=100,min_height=100'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return ['share_mobile' => 'phone no', 'share_email' => 'email', 'share_sex' => 'gender', 'share_dob' => 'date of birth', 'passport_photo' => 'passport size image'];
    }

    /**
     * @return array{first_name: string, middle_name: string|null, last_name: string, mobile: string, email: string, gender: string|null, date_of_birth: string}
     */
    public function shareHolderData(): array
    {
        return [
            'first_name' => $this->string('first_name')->trim()->toString(),
            'middle_name' => $this->filled('middle_name') ? $this->string('middle_name')->trim()->toString() : null,
            'last_name' => $this->string('last_name')->trim()->toString(),
            'mobile' => $this->string('share_mobile')->trim()->toString(),
            'email' => $this->string('share_email')->trim()->toString(),
            'gender' => $this->filled('share_sex') ? $this->string('share_sex')->toString() : null,
            'date_of_birth' => $this->string('share_dob')->toString(),
        ];
    }
}
