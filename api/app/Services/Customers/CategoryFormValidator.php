<?php

namespace App\Services\Customers;

use App\Models\CustomerCategory;
use Illuminate\Support\Facades\File;
use Illuminate\Validation\ValidationException;

/**
 * Validates the dynamic category form (customer_categories.form_schema) against the option trees
 * TAASISI, SEKTA, SEKTA_BINAFSI, VYUO, BANKS and MFUKO_HIFADHI from Documents/customer-types.json.
 */
class CategoryFormValidator
{
    /**
     * @var array<string, mixed>|null
     */
    private static ?array $trees = null;

    /**
     * @return array<string, mixed>
     */
    public function optionTrees(): array
    {
        return self::$trees ??= json_decode(File::get(database_path('data/customer-types.json')), true)['optionTrees'];
    }

    /**
     * Options allowed for a select field given the answers chosen so far (empty for free inputs).
     *
     * @param  array<string, mixed>  $field
     * @param  array<string, mixed>  $answers
     * @return list<string>
     */
    public function optionsFor(array $field, array $answers): array
    {
        $source = $field['optionSource'] ?? null;
        if ($source === null) {
            return [];
        }

        if ($source['kind'] === 'fixed') {
            return array_values($source['options']);
        }

        $node = $this->optionTrees()[$source['tree']] ?? [];
        if ($source['kind'] === 'flat') {
            return array_values((array) $node);
        }

        foreach ($source['path'] as $step) {
            $key = isset($step['field']) ? ($answers[$step['field']] ?? null) : ($step['property'] ?? null);
            if (! is_string($key) || ! is_array($node) || ! array_key_exists($key, $node)) {
                return [];
            }
            $node = $node[$key];
        }

        if (! is_array($node)) {
            return [];
        }

        $options = $source['take'] === 'keys' ? array_map('strval', array_keys($node)) : array_values($node);

        return array_values(array_merge($options, $source['extraOptions'] ?? []));
    }

    /**
     * Validate answers and return only the fields of the schema (typed, empty optional values dropped).
     *
     * @param  array<string, mixed>  $answers
     * @return array<string, string|int|float>
     *
     * @throws ValidationException
     */
    public function validate(CustomerCategory $category, array $answers): array
    {
        $errors = [];
        $clean = [];

        foreach ($category->form_schema as $field) {
            $key = $field['key'];
            $value = $answers[$key] ?? null;
            $value = is_string($value) ? trim($value) : $value;
            $isEmpty = $value === null || $value === '';

            if ($isEmpty) {
                if ($this->isRequired($field, $answers)) {
                    $errors["answers.{$key}"] = ["{$field['label']} is required."];
                }

                continue;
            }

            if (! is_scalar($value)) {
                $errors["answers.{$key}"] = ["{$field['label']} is invalid."];

                continue;
            }

            if (($field['requiredWhen'] ?? null) !== null && ! $this->isRequired($field, $answers)) {
                continue;
            }

            $error = $this->fieldError($field, (string) $value, $answers);
            if ($error !== null) {
                $errors["answers.{$key}"] = [$error];

                continue;
            }

            $clean[$key] = ($field['inputType'] ?? null) === 'number' ? $value + 0 : (string) $value;
        }

        if ($errors !== []) {
            throw ValidationException::withMessages($errors);
        }

        return $clean;
    }

    /**
     * @param  array<string, mixed>  $field
     * @param  array<string, mixed>  $answers
     */
    private function isRequired(array $field, array $answers): bool
    {
        $when = $field['requiredWhen'] ?? null;
        if ($when !== null) {
            return in_array($answers[$when['field']] ?? null, $when['equals'], true);
        }

        return (bool) ($field['required'] ?? false);
    }

    /**
     * @param  array<string, mixed>  $field
     * @param  array<string, mixed>  $answers
     */
    private function fieldError(array $field, string $value, array $answers): ?string
    {
        if ($field['control'] === 'select') {
            return in_array($value, $this->optionsFor($field, $answers), true) ? null : "The selected {$field['label']} is invalid.";
        }

        return match ($field['inputType'] ?? 'text') {
            'number' => is_numeric($value) && (float) $value >= 0 ? null : "{$field['label']} must be a number.",
            'date' => strtotime($value) !== false ? null : "{$field['label']} must be a valid date.",
            'email' => filter_var($value, FILTER_VALIDATE_EMAIL) !== false ? null : "{$field['label']} must be a valid email address.",
            default => mb_strlen($value) <= 255 ? null : "{$field['label']} may not be greater than 255 characters.",
        };
    }
}
