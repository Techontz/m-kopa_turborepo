@extends('layouts.app')

@section('breadcrumb')
    <li class="breadcrumb-item active">Report</li>
    <li class="breadcrumb-item active">Wright-off</li>
@endsection

@section('content')
    @include('reports.partials.write-off-tabs')

    <div class="tab-content padding-0">
        <div class="tab-pane active" id="Basic">
            <div class="card">
                <div class="body">
                    <h6>Write-off Loan</h6>
                    <div class="pull-right">
                        <a href="javascript:;" data-toggle="modal" data-target="#addcontact2" class="btn btn-sm btn-primary"><i class="icon-magnifier"></i></a>
                    </div>
                    <div class="table-responsive">
                        <table class="table table-hover js-basic-example dataTable table-custom">
                            <thead class="thead-info">
                                <tr>
                                    <th>S/No.</th>
                                    <th>Branch Name</th>
                                    <th>Customer Name</th>
                                    <th>Phone Number</th>
                                    <th>Loan Amount</th>
                                    <th>Restoration</th>
                                    <th>Duration Type</th>
                                    <th>Number of Repayment</th>
                                    <th>Wright-off Amount</th>
                                    <th>Satart date</th>
                                    <th>End date</th>
                                </tr>
                            </thead>
                            <tbody>
                                @foreach ($writeOffs as $writeOff)
                                    <tr>
                                        <td>{{ $loop->iteration }}</td>
                                        <td>{{ $writeOff->loan->branch->name }}</td>
                                        <td>{{ $writeOff->loan->customer->full_name }}</td>
                                        <td>{{ $writeOff->loan->customer->phone }}</td>
                                        <td>{{ money($writeOff->loan->total_payable) }}</td>
                                        <td>{{ money($writeOff->loan->restoration) }}</td>
                                        <td>{{ $writeOff->loan->duration->label() }}</td>
                                        <td>{{ $writeOff->loan->sessions }}</td>
                                        <td>{{ money($writeOff->amount) }}</td>
                                        <td>{{ $writeOff->loan->withdrawn_at?->format('Y-m-d') }}</td>
                                        <td>{{ $writeOff->loan->end_date?->format('Y-m-d') }}</td>
                                    </tr>
                                @endforeach
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td><b>TOTAL:</b></td>
                                    @for ($column = 0; $column < 7; $column++)
                                        <td></td>
                                    @endfor
                                    <td><b>{{ money($writeOffs->sum('amount')) }}</b></td>
                                    <td></td>
                                    <td></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    </div>

    @include('reports.partials.branch-filter', ['action' => route('reports.write-off')])
@endsection
