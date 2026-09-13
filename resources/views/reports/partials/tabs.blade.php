{{-- Pill tab strip used by the live report pages: [href/#pane => label], followed by "Back" to the dashboard. --}}
<div class="card">
    <div class="body">
        <ul class="nav nav-tabs-new profile-tabs">
            @foreach ($tabs as $target => $label)
                @if (str_starts_with($target, '#'))
                    <li class="nav-item"><a class="nav-link" data-toggle="tab" href="{{ $target }}">{{ $label }}</a></li>
                @else
                    <li class="nav-item"><a class="nav-link" href="{{ $target }}">{{ $label }}</a></li>
                @endif
            @endforeach
            <li class="nav-item"><a class="nav-link" href="{{ route('dashboard') }}">Back</a></li>
        </ul>
    </div>
</div>
