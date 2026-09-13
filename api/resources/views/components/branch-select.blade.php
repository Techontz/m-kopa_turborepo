@props([
    'branches',
    'name' => 'blanch_id',
    'placeholder' => 'Select Branch',
    'all' => false,
    'allLabel' => 'ALL',
    'selected' => null,
    'required' => true,
])

<select name="{{ $name }}" {{ $attributes->merge(['class' => 'form-control']) }} @required($required)>
    <option value="">{{ $placeholder }}</option>
    @foreach ($branches as $branch)
        <option value="{{ $branch->id }}" @selected((string) old($name, $selected) === (string) $branch->id)>{{ $branch->name }}</option>
    @endforeach
    @if ($all)
        <option value="all" @selected(old($name, $selected) === 'all')>{{ $allLabel }}</option>
    @endif
</select>
