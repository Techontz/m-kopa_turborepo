@extends('layouts.app')

@section('breadcrumb')
    <li class="breadcrumb-item active">Loan category</li>
@endsection

@section('content')
    <div class="card">
        <div class="header">
            <h2>Sub category Loan / {{ $mainCategory->name }} LOAN</h2>
            <div class="pull-right" style="position: absolute; right: 20px; top: 38px;">
                <a href="{{ route('main-categories.index') }}" class="btn btn-primary"><i class="icon-arrow-left-circle"></i></a>
            </div>
        </div>
        <div class="body">
            <div class="table-responsive">
                <table class="table table-hover js-basic-example dataTable table-custom">
                    <thead class="thead-info">
                        <tr>
                            <th>S/No.</th>
                            <th>Sub Category Name</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        @foreach ($types as $type)
                            <tr>
                                <td>{{ $loop->iteration }}.</td>
                                <td>{{ $type->name }}</td>
                                <td>
                                    <x-action-button :action="route('customer-types.enable', $type)" class="btn btn-primary btn-sm" icon="icon-check" />
                                </td>
                            </tr>
                        @endforeach
                    </tbody>
                </table>
            </div>
        </div>
    </div>

    <x-card title=" ">
        <div class="table-responsive">
            <table class="table table-hover js-basic-example dataTable table-custom">
                <thead class="thead-info">
                    <tr>
                        <th>S/No.</th>
                        <th>Category Name</th>
                        <th>Sub Category Name</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach ($enabledTypes as $type)
                        <tr>
                            <td>{{ $loop->iteration }}</td>
                            <td>{{ $mainCategory->name }}</td>
                            <td class="c">{{ $type->name }}</td>
                            <td>
                                <x-action-button :action="route('customer-types.disable', $type)" method="DELETE" confirm="Are You Sure?" icon="icon-trash" />
                            </td>
                        </tr>
                    @endforeach
                </tbody>
            </table>
        </div>
    </x-card>
@endsection
