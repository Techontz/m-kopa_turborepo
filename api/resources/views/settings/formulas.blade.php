@extends('layouts.app')

@section('breadcrumb')
    <li class="breadcrumb-item active">Setting</li>
    <li class="breadcrumb-item active">Interest Formular</li>
@endsection

@section('content')
    <div class="row clearfix">
        <div class="col-lg-6">
            <x-card title="Interest Formular">
                <div class="table-responsive">
                    <table class="table table-hover js-basic-example dataTable table-custom">
                        <thead class="thead-info">
                            <tr>
                                <th>S/no</th>
                                <th>Formular Name</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            @foreach ($formulas as $formula)
                                <tr>
                                    <td>{{ $loop->iteration }}.</td>
                                    <td>{{ $formula->name }}</td>
                                    <td>
                                        <x-action-button :action="route('formulas.enable', $formula)" class="btn btn-info btn-sm" icon="icon-pencil" />
                                    </td>
                                </tr>
                            @endforeach
                        </tbody>
                    </table>
                </div>
            </x-card>
        </div>
        <div class="col-lg-6">
            <x-card title="Interest Formular">
                <div class="table-responsive">
                    <table class="table table-hover js-basic-example dataTable table-custom">
                        <thead class="thead-info">
                            <tr>
                                <th>S/no</th>
                                <th>Formular Name</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            @foreach ($enabledFormulas as $formula)
                                <tr>
                                    <td>{{ $loop->iteration }}.</td>
                                    <td>{{ $formula->name }}</td>
                                    <td>
                                        <x-action-button :action="route('formulas.disable', $formula)" method="DELETE" confirm="Are You Sure?" class="btn btn-danger btn-sm" icon="icon-trash" />
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
