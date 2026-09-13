@props([
    'action',
    'method' => 'POST',
    'confirm' => null,
    'class' => 'btn btn-sm btn-icon btn-danger',
    'icon' => null,
])

<form action="{{ $action }}" method="POST" class="d-inline" @if ($confirm) data-confirm="{{ $confirm }}" @endif>
    @csrf
    @if (strtoupper($method) !== 'POST')
        @method($method)
    @endif
    <button type="submit" class="{{ $class }}" {{ $attributes }}>@if ($icon)<i class="{{ $icon }}"></i>@endif{{ $slot }}</button>
</form>
