@props(['target', 'icon' => 'icon-magnifier'])

<li>
    <a href="javascript:;" data-toggle="modal" data-target="#{{ $target }}" {{ $attributes->merge(['class' => 'btn btn-primary']) }}><i class="{{ $icon }}"></i>{{ $slot }}</a>
</li>
