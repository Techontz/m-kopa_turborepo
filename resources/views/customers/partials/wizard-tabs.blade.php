@php
    $links = [
        1 => ['Basic information', $customer ? route('customers.basic', $customer) : route('customers.create')],
        2 => ['Aditinal Detail', $customer ? route('customers.additional', $customer) : route('customers.create')],
        3 => ['Passport size & Bank Detail', $customer ? route('customers.passport', $customer) : route('customers.create')],
    ];
@endphp
<div class="card">
    <div class="body">
        <ul class="nav nav-tabs-new">
            @foreach ($links as $number => [$label, $url])
                <li class="nav-item">
                    <a class="nav-link {{ $number <= $step ? 'active' : '' }}" href="{{ $url }}"><i class="icon-user"></i>{{ $label }}</a>
                </li>
            @endforeach
        </ul>
    </div>
</div>
