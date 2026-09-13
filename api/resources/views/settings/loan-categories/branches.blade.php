@extends('layouts.app')

@section('breadcrumb')
    <li class="breadcrumb-item active">Loan Category Assign</li>
@endsection

@section('content')
    <div class="row clearfix">
        <div class="col-lg-6">
            <div class="card">
                <div class="header">
                    <h2>{{ $category->name }}</h2>
                    <div class="pull-right" style="position: absolute; right: 20px; top: 38px;">
                        <a href="{{ route('loan-categories.index') }}" class="btn btn-primary"><i class="icon-arrow-left-circle"></i></a>
                    </div>
                </div>
                <div class="body">
                    <div class="table-responsive">
                        <table class="table table-hover js-basic-example dataTable table-custom">
                            <thead class="thead-info">
                                <tr>
                                    <th>S/NO.</th>
                                    <th>Branch Name</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                @foreach ($branches as $branch)
                                    <tr>
                                        <td>{{ $loop->iteration }}.</td>
                                        <td class="c">{{ $branch->name }}</td>
                                        <td>
                                            <x-action-button :action="route('loan-categories.attach-branch', [$category, $branch])" class="btn btn-sm btn-primary" icon="icon-plus" />
                                        </td>
                                    </tr>
                                @endforeach
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
        <div class="col-lg-6">
            <x-card title="Branch List Loan Category">
                <div class="table-responsive">
                    <table class="table table-hover js-basic-example dataTable table-custom">
                        <thead class="thead-info">
                            <tr>
                                <th>S/NO.</th>
                                <th>Loan Category</th>
                                <th>Branch</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            @foreach ($assignedBranches as $branch)
                                <tr>
                                    <td>{{ $loop->iteration }}.</td>
                                    <td>{{ $category->name }}</td>
                                    <td>{{ $branch->name }}</td>
                                    <td>
                                        <x-action-button :action="route('loan-categories.detach-branch', [$category, $branch])" method="DELETE" confirm="Are you sure?" class="btn btn-sm btn-danger" icon="icon-trash" />
                                    </td>
                                </tr>
                            @endforeach
                        </tbody>
                    </table>
                </div>
            </x-card>
        </div>
    </div>
@endsection
