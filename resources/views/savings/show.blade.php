@extends('layouts.app')

@section('breadcrumb')
    <li class="breadcrumb-item active">Saving Deposit</li>
    <li class="breadcrumb-item active">Customer Saving</li>
@endsection

@section('content')
    <div class="card">
        <div class="body text-center">
            <img src="{{ $customer->photo_url }}" alt="" class="img-thumbnail" style="width: 135px; height: 135px; object-fit: cover;">
            <div class="m-t-10"><small>{{ strtoupper($customer->full_name) }}</small></div>
        </div>
    </div>

    <div class="card">
        <div class="body">
            <div class="table-responsive">
                <table class="table table-custom" data-no-datatable>
                    <thead class="thead-info">
                        <tr>
                            <th>Branch</th>
                            <th>Phone Number</th>
                            <th>Deposit</th>
                            <th>Withdrawal</th>
                            <th>Balance</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>{{ $customer->branch?->name }}</td>
                            <td>{{ $customer->phone }}</td>
                            <td>{{ money($savings->where('type', 'deposit')->sum('amount')) }}</td>
                            <td>{{ money($savings->where('type', 'withdrawal')->sum('amount')) }}</td>
                            <td>{{ money($balance) }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>

    <x-card title="Saving Deposit">
        <form action="{{ route('savings.store', $customer) }}" method="POST" data-confirm="Are you sure?">
            @csrf
            <div class="row">
                <div class="col-md-4">
                    <span>* Transaction Type:</span>
                    <select name="type" class="form-control" required>
                        <option value="">Select</option>
                        <option value="deposit" @selected(old('type') === 'deposit')>Deposit</option>
                        <option value="withdrawal" @selected(old('type') === 'withdrawal')>Withdrawal</option>
                    </select>
                </div>
                <div class="col-md-4">
                    <span>* Amount:</span>
                    <input type="number" name="amount" class="form-control" placeholder="Enter Amount" value="{{ old('amount') }}" autocomplete="off" required>
                </div>
                <div class="col-md-4">
                    <span>Description:</span>
                    <input type="text" name="description" class="form-control" placeholder="Enter Description" value="{{ old('description') }}" autocomplete="off">
                </div>
            </div>
            <div class="text-center m-t-20">
                <button type="submit" class="btn btn-primary">Save</button>
            </div>
        </form>
    </x-card>

    <x-card title="Saving Statement">
        <div class="table-responsive">
            <table class="table table-hover js-basic-example dataTable table-custom">
                <thead class="thead-info">
                    <tr>
                        <th>S/no.</th>
                        <th>Date</th>
                        <th>Description</th>
                        <th>Deposit</th>
                        <th>Withdrawal</th>
                        <th>Balance</th>
                    </tr>
                </thead>
                <tbody>
                    @php($running = 0)
                    @foreach ($savings as $saving)
                        @php($running += $saving->type === 'deposit' ? (float) $saving->amount : -(float) $saving->amount)
                        <tr>
                            <td>{{ $loop->iteration }}.</td>
                            <td>{{ $saving->transaction_date->format('Y-m-d') }}</td>
                            <td>{{ $saving->description }}</td>
                            <td>{{ $saving->type === 'deposit' ? money($saving->amount) : '' }}</td>
                            <td>{{ $saving->type === 'withdrawal' ? money($saving->amount) : '' }}</td>
                            <td>{{ money($running) }}</td>
                        </tr>
                    @endforeach
                </tbody>
                <tfoot>
                    <tr>
                        <td><b>TOTAL</b></td>
                        <td></td>
                        <td></td>
                        <td><b>{{ money($savings->where('type', 'deposit')->sum('amount')) }}</b></td>
                        <td><b>{{ money($savings->where('type', 'withdrawal')->sum('amount')) }}</b></td>
                        <td><b>{{ money($balance) }}</b></td>
                    </tr>
                </tfoot>
            </table>
        </div>
    </x-card>
@endsection
