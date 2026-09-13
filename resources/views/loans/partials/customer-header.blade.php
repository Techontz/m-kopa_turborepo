{{-- Customer summary header used on loan screens. Expects: $customer, optional $loan --}}
@push('styles')
    <style>
        .loan-header { background: #fff; border-radius: .55rem; box-shadow: 0 1px 2px 0 rgba(0,0,0,.1); margin-bottom: 30px; }
        .loan-header .top { padding: 10px 15px; border-bottom: 1px solid #f4f4f4; }
        .loan-header .top img { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; float: left; margin-right: 10px; }
        .loan-header .username { font-size: 16px; font-weight: 600; color: #444; display: block; }
        .loan-header .description { font-size: 13px; color: #000; }
        .loan-header .details { padding: 10px 15px; }
        .loan-header .details li { color: #000; }
        .bg-olive { background: #3d9970; color: #fff; }
        .bg-navy { background: #001f3f; color: #fff; }
        .bg-red { background: #dd4b39; color: #fff; padding: 1px 3px; }
    </style>
@endpush
<div class="loan-header">
    <div class="top">
        <div class="row align-items-center">
            <div class="col-sm-4">
                <img src="{{ $customer->photo_url }}" alt="">
                <span class="username">{{ $customer->short_name }}</span>
                <span class="description">{{ $customer->customer_code }}</span>
            </div>
            <div class="col-sm-4">
                <a class="btn bg-olive" href="{{ route('loans.start', $customer) }}">Add Loan</a>
                <a class="btn bg-navy" href="javascript:;" data-toggle="modal" data-target="#all-loans">View All Loans</a>
            </div>
            <div class="col-sm-4">
                <div class="dropdown">
                    <button type="button" class="btn btn-info dropdown-toggle" data-toggle="dropdown">Statement</button>
                    <ul class="dropdown-menu">
                        <li><a class="dropdown-item" href="{{ route('reports.statement', ['customer_id' => $customer->id, 'loan_id' => $loan?->id]) }}">Customer Statement</a></li>
                        <li><a class="dropdown-item" href="{{ route('customers.show', $customer) }}">Customer Profile</a></li>
                    </ul>
                </div>
            </div>
        </div>
    </div>
    <div class="details">
        <div class="row">
            <div class="col-sm-4">
                <ul class="list-unstyled mb-0">
                    <li><a href="{{ route('customers.show', $customer) }}">Edit</a> | <a href="{{ route('customers.show', $customer) }}">Move Borrower to Another Branch</a></li>
                    <li><b>Create Date:</b> {{ $customer->created_at?->format('Y-m-d H:i:s') }}</li>
                    <li><b>Monthly Income :</b> {{ money($customer->monthly_income) }}</li>
                    <li><b>Position :</b>{{ strtoupper(\App\Models\Customer::WORK_STATUSES[$customer->work_status] ?? '') }} / {{ strtoupper($customer->business_type ?? '') }}</li>
                    <li><b>Age:</b> {{ $customer->age }} years</li>
                    <li><b>Gender:</b> {{ $customer->gender }}</li>
                </ul>
            </div>
            <div class="col-sm-4">
                <ul class="list-unstyled mb-0">
                    <li><b>Region:</b> {{ $customer->region?->name }}</li>
                    <li><b>District:</b> {{ $customer->district }}</li>
                    <li><b>Ward:</b> {{ $customer->ward }}</li>
                    <li><b>Street:</b> {{ $customer->street }}</li>
                    <li><b>Place of bussiness:</b> {{ $customer->place_of_business }}</li>
                    <li><small>(NIDA) / Voter ID / Driver `s Lisence - {{ $customer->id_number }}</small></li>
                </ul>
            </div>
            <div class="col-sm-4">
                <ul class="list-unstyled mb-0">
                    <li><b>Phone number:</b> {{ $customer->phone }}</li>
                    <li><span class="bg-red">Send SMS</span></li>
                    <li><b>Attachment:</b>
                        @if ($customer->id_attachment)
                            <a href="{{ asset('storage/'.$customer->id_attachment) }}" target="_blank">{{ basename($customer->id_attachment) }}</a>
                        @endif
                    </li>
                </ul>
            </div>
        </div>
    </div>
</div>

<x-modal id="all-loans" title="All Loans" size="modal-xl">
    @include('customers.partials.loans-table', ['loans' => $customer->loans->sortByDesc('id')])
</x-modal>
