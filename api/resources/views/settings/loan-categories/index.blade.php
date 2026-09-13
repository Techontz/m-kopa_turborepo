@extends('layouts.app')

@section('breadcrumb')
    <li class="breadcrumb-item active">Loan Category</li>
@endsection

@section('content')
    <div class="card">
        <div class="header">
            <h2>Loan Category List</h2>
            <div class="pull-right" style="position: absolute; right: 20px; top: 38px;">
                <a href="javascript:;" data-toggle="modal" data-target="#addcontact1" class="btn btn-sm btn-primary"><i class="icon-plus"></i></a>
            </div>
        </div>
        <div class="body">
            <div class="table-responsive">
                <table class="table table-hover js-basic-example dataTable table-custom loan-category-table">
                    <thead class="thead-info">
                        <tr>
                            <th>S/No.</th>
                            <th>Loan Type</th>
                            <th>Loan Category name</th>
                            <th>Loan level</th>
                            <th>Loan Interest</th>
                            <th>Interest Formular</th>
                            <th>Duration</th>
                            <th>Number Of Repayment</th>
                            <th>Deduction</th>
                            <th>Penarty</th>
                            <th>Aprove status</th>
                            <th>Topup percent</th>
                            <th>Take home percent</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        @foreach ($categories as $category)
                            <tr>
                                <td>{{ $loop->iteration }}.</td>
                                <td>{{ $category->mainCategory?->name }}</td>
                                <td>{{ $category->name }}</td>
                                <td class="text-nowrap">{{ $category->level_label }}</td>
                                <td>{{ (float) $category->interest_rate }}%</td>
                                <td>{{ $category->formula }}</td>
                                <td>{{ $category->duration->label() }}</td>
                                <td class="text-nowrap">{{ $category->repayment_from }} - {{ $category->repayment_to }}</td>
                                <td>{{ $category->fee_deduct ? 'YES' : 'NO' }}</td>
                                <td>{{ $category->has_penalty ? 'YES' : 'NO' }}</td>
                                <td>{{ $category->approve_level }}</td>
                                <td>{{ (float) $category->topup_percent }}%</td>
                                <td>{{ (float) $category->take_home_percent }}%</td>
                                <td class="text-nowrap">
                                    <a href="javascript:;" data-toggle="modal" data-target="#addcontact10{{ $category->id }}" class="btn btn-sm btn-primary"><i class="icon-list"></i></a>
                                    <a href="{{ route('loan-categories.edit', $category) }}" class="btn btn-sm btn-primary"><i class="icon-pencil"></i></a>
                                    <a href="{{ route('loan-categories.branches', $category) }}" class="btn btn-success btn-sm" title="Assign Branch"><i class="icon-arrow-right"></i></a>
                                    <x-action-button :action="route('loan-categories.destroy', $category)" method="DELETE" confirm="Are You Sure?" icon="icon-trash" />
                                </td>
                            </tr>

                            @push('modals')
                                <div class="modal fade" id="addcontact10{{ $category->id }}" tabindex="-1" role="dialog">
                                    <div class="modal-dialog modal-lg modal-dialog-centered" role="document">
                                        <div class="modal-content">
                                            <div class="body">
                                                <div class="table-responsive">
                                                    <table class="table table-hover dataTable table-custom">
                                                        <thead class="thead-primary">
                                                            <tr>
                                                                <th>S/NO.</th>
                                                                <th>Branch Name</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            @foreach ($category->branches as $branch)
                                                                <tr>
                                                                    <td>{{ $loop->iteration }}.</td>
                                                                    <td class="c">{{ $branch->name }}</td>
                                                                </tr>
                                                            @endforeach
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                            <div class="modal-footer">
                                                <button type="button" class="btn btn-secondary" data-dismiss="modal"><i class="icon-close"></i></button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            @endpush
                        @endforeach
                    </tbody>
                </table>
            </div>
        </div>
    </div>

    <x-modal id="addcontact1" title="Create Loan Category" :action="route('loan-categories.store')" submit="Save">
        @include('settings.loan-categories._fields', ['category' => null])
    </x-modal>
@endsection

@push('styles')
    <style>
        .loan-category-table tbody td { white-space: nowrap; }
    </style>
@endpush
