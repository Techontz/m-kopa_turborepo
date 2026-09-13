@extends('layouts.app')

@section('breadcrumb')
    <li class="breadcrumb-item active">Customer</li>
    <li class="breadcrumb-item active">Customer Profile</li>
@endsection

@push('styles')
    <style>
        .profile-box { background: #fff; border-radius: .55rem; box-shadow: 0 1px 2px 0 rgba(0,0,0,.1); margin: 0 15px 30px; }
        .profile-box .box-header { padding: 10px; }
        .profile-box .box-header.with-border { border-bottom: 1px solid #f4f4f4; }
        .profile-box .user-block img { width: 40px; height: 40px; float: left; }
        .profile-box .user-block .username { display: block; margin-left: 50px; font-size: 16px; font-weight: 600; color: #444; }
        .profile-box .user-block .description { display: block; margin-left: 50px; font-size: 13px; color: #000; }
        .profile-box .list-unstyled li { color: #000; }
        .bg-red { background: #dd4b39; color: #fff; padding: 1px 3px; }
    </style>
@endpush

@section('content')
    <div class="profile-box">
        <div class="box-header with-border">
            <div class="row">
                <div class="col-sm-4">
                    <div class="user-block">
                        <img class="rounded-circle img-fluid" src="{{ $customer->photo_url }}" alt="">
                        <span class="username">{{ $customer->short_name }}</span>
                        <span class="description">{{ $customer->customer_code }}</span>
                    </div>
                </div>
                <div class="col-sm-4">
                    @if ($customer->kyc_status === 'approved')
                        <span class="badge badge-success">KYC - Aproved</span>
                    @else
                        <span class="badge badge-danger">KYC - Pending</span>
                    @endif
                </div>
                <div class="col-sm-4">
                    <div class="dropdown">
                        <button type="button" class="btn btn-info dropdown-toggle" data-toggle="dropdown">Statement <span class="fa fa-caret-down"></span></button>
                        <ul class="dropdown-menu" role="menu">
                            <li><a class="dropdown-item" href="{{ route('reports.statement', ['customer_id' => $customer->id]) }}">Customer Statement</a></li>
                            <li><a class="dropdown-item" href="javascript:;" data-toggle="modal" data-target="#addcontact3">Balance</a></li>
                            <li><a class="dropdown-item" href="javascript:window.print();">Local Government Letter</a></li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
        <div class="box-header">
            <div class="row">
                <div class="col-sm-4">
                    <ul class="list-unstyled">
                        <li><b>Create Date:</b> {{ $customer->created_at?->format('Y-m-d H:i:s') }}</li>
                        <li><b>Monthly Income:</b> {{ money($customer->monthly_income) }}</li>
                        <li><b>Position:</b> {{ strtoupper($customer->business_type ?? '') }}</li>
                        <li><b>Age:</b> {{ $customer->age }}</li>
                        <li><b>Gender:</b> {{ $customer->gender }}</li>
                        <li><b>Customer status:</b> <span class="badge badge-info">{{ $customer->status_label }}</span></li>
                    </ul>
                </div>
                <div class="col-sm-4">
                    <ul class="list-unstyled">
                        <li><b>Region:</b> {{ $customer->region?->name }}</li>
                        <li><b>District:</b> {{ $customer->district }}</li>
                        <li><b>Ward:</b> {{ $customer->ward }}</li>
                        <li><b>Street:</b> {{ $customer->street }}</li>
                        <li><b>Place of bussiness:</b> {{ $customer->place_of_business }}</li>
                        <li><a href="javascript:;">(NIDA) / Voter ID / Driver `s Lisence</a> - <a href="javascript:;">{{ $customer->id_number }}</a></li>
                    </ul>
                </div>
                <div class="col-sm-4">
                    <ul class="list-unstyled">
                        <li><b>Phone number:</b> {{ $customer->phone }}</li>
                        <li><a href="javascript:;" class="bg-red" data-toggle="modal" data-target="#sms-modal">Send SMS</a></li>
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

    <div class="row clearfix">
        <div class="col-lg-12 col-md-12">
            <div class="card">
                <div class="body">
                    <ul class="nav nav-tabs-new profile-tabs">
                        <li class="nav-item"><a class="nav-link active" data-toggle="tab" href="#Basic">Basic</a></li>
                        <li class="nav-item"><a class="nav-link" data-toggle="tab" href="#aditinal">Aditional Details</a></li>
                        <li class="nav-item"><a class="nav-link" data-toggle="tab" href="#passport">Passport &amp; Bank Details</a></li>
                        <li class="nav-item"><a class="nav-link" data-toggle="tab" href="#Account">Guarantors</a></li>
                        <li class="nav-item"><a class="nav-link" data-toggle="tab" href="#General">All Loans</a></li>
                        <li class="nav-item">
                            <form action="{{ route('customers.mark', $customer) }}" method="POST" class="d-inline">@csrf<a class="nav-link" href="javascript:;" onclick="this.closest('form').submit()">{{ $customer->is_marked ? 'Unmark' : 'Mark' }}</a></form>
                        </li>
                        <li class="nav-item"><a class="nav-link" href="javascript:;" data-toggle="modal" data-target="#addcontact3">Balance</a></li>
                        <li class="nav-item">
                            <form action="{{ route('customers.kyc', $customer) }}" method="POST" class="d-inline">@csrf<a class="nav-link" href="javascript:;" onclick="if (confirm('Are you sure to aprove customer KYC')) { this.closest('form').submit(); }">KYC status</a></form>
                        </li>
                        <li class="nav-item"><a class="nav-link" href="{{ route('customers.index') }}">Back</a></li>
                    </ul>
                </div>
            </div>

            <div class="tab-content padding-0">
                <div class="tab-pane active" id="Basic">
                    <div class="card">
                        <div class="body">
                            <h6>Basic Information</h6>
                            <form action="{{ route('customers.profile.basic', $customer) }}" method="POST">
                                @csrf
                                @method('PUT')
                                @include('customers.partials.basic-form')
                                <br>
                                <div class="text-center"><button type="submit" class="btn btn-primary">Update</button></div>
                            </form>
                        </div>
                    </div>
                </div>

                <div class="tab-pane" id="aditinal">
                    <div class="card">
                        <div class="body">
                            <h6>Aditinal Details</h6>
                            <form action="{{ route('customers.profile.additional', $customer) }}" method="POST">
                                @csrf
                                @method('PUT')
                                @include('customers.partials.additional-form')
                                <br>
                                <div class="text-center"><button type="submit" class="btn btn-primary">Update</button></div>
                            </form>
                        </div>
                    </div>
                </div>

                <div class="tab-pane" id="passport">
                    @include('customers.partials.passport-section', [
                        'documentsAction' => route('customers.profile.documents', $customer),
                        'saveLabel' => 'Update',
                    ])
                </div>

                <div class="tab-pane" id="Account">
                    <x-card title="Gualantors List">
                        <x-slot:actions>
                            <x-header-button target="add-guarantor" icon="icon-plus" />
                        </x-slot:actions>
                        <div class="table-responsive">
                            <table class="table table-hover js-basic-example dataTable table-custom">
                                <thead class="thead-info">
                                    <tr>
                                        <th>S/No.</th><th>First Name</th><th>Middle Name</th><th>Last Name</th><th>Phone Number</th>
                                        <th>Relationship</th><th>Region</th><th>District</th><th>Ward</th><th>Street</th><th>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    @foreach ($customer->guarantors as $guarantor)
                                        <tr>
                                            <td>{{ $loop->iteration }}.</td>
                                            <td>{{ $guarantor->first_name }}</td>
                                            <td>{{ $guarantor->middle_name }}</td>
                                            <td>{{ $guarantor->last_name }}</td>
                                            <td>{{ $guarantor->phone }}</td>
                                            <td>{{ $guarantor->relationship }}</td>
                                            <td>{{ $guarantor->region?->name }}</td>
                                            <td>{{ $guarantor->district }}</td>
                                            <td>{{ $guarantor->ward }}</td>
                                            <td>{{ $guarantor->street }}</td>
                                            <td class="text-nowrap">
                                                <a href="javascript:;" class="btn btn-sm btn-icon btn-primary" data-toggle="modal" data-target="#editGuarantor{{ $guarantor->id }}"><i class="icon-pencil"></i></a>
                                                <x-action-button :action="route('guarantors.destroy', $guarantor)" method="DELETE" confirm="Are you sure?" icon="icon-trash" class="btn btn-danger btn-sm" />
                                            </td>
                                        </tr>
                                        <x-modal :id="'editGuarantor'.$guarantor->id" title="Edit Guarantor" :action="route('guarantors.update', $guarantor)" method="PUT" submit="Update">
                                            @include('customers.partials.guarantor-fields', ['guarantor' => $guarantor])
                                        </x-modal>
                                    @endforeach
                                </tbody>
                            </table>
                        </div>
                    </x-card>
                </div>

                <div class="tab-pane" id="General">
                    <x-card title="All Loans">
                        @include('customers.partials.loans-table', ['loans' => $customer->loans->sortByDesc('id')])
                    </x-card>
                </div>
            </div>
        </div>
    </div>

    <x-modal id="add-guarantor" title="Register Guarantor" :action="route('guarantors.store', $customer)" submit="Save">
        @include('customers.partials.guarantor-fields')
    </x-modal>

    <x-modal id="addcontact3" title="Customer Balance">
        <table class="table table-hover table-custom">
            <thead class="thead-info"><tr><th>S/no</th><th>Description</th><th>Amount</th></tr></thead>
            <tbody>
                <tr><td>1.</td><td>Remain Loan Amount</td><td>{{ money($balance['remain_loan'] ?? 0) }}</td></tr>
                <tr><td>2.</td><td>Salary Advance</td><td>{{ money($balance['salary_advance'] ?? 0) }}</td></tr>
                <tr><td>3.</td><td>Penalty Amount</td><td>{{ money($balance['penalty'] ?? 0) }}</td></tr>
                <tr><td>4.</td><td>Loan Fee</td><td>{{ money($balance['loan_fee'] ?? 0) }}</td></tr>
                <tr><th></th><th>TOTAL</th><th>{{ money($balance['total'] ?? 0) }}</th></tr>
                <tr><th></th><th>TAKE HOME</th><th>{{ money($balance['remain_cash'] ?? 0) }}</th></tr>
            </tbody>
        </table>
    </x-modal>

    <x-modal id="sms-modal" title="Send SMS" :action="route('customers.sms', $customer)" submit="Send">
        <span>Phone number: {{ $customer->phone }}</span>
        <textarea name="message" class="form-control" rows="4" placeholder="Enter message" required></textarea>
    </x-modal>
@endsection
