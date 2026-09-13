@props(['title' => null])

<div {{ $attributes->merge(['class' => 'card']) }}>
    @if ($title !== null || isset($actions))
        <div class="header">
            @if ($title !== null)
                <h2>{{ $title }}</h2>
            @endif
            @isset($actions)
                <div class="pull-right">{{ $actions }}</div>
            @endisset
        </div>
    @endif
    <div class="body">
        {{ $slot }}
    </div>
</div>
