@extends('layouts.app')

@section('breadcrumb')
    <li class="breadcrumb-item active">Penart Setting</li>
@endsection

@php
    $typeLabel = $company->penalty_type === 'money' ? 'MONEY VALUE' : 'PERCENTAGE VALUE';
@endphp

@section('content')
    <x-card title="Penart Setting">
        <form action="{{ route('penalty-setting.update') }}" method="POST">
            @csrf
            @method('PUT')
            <div class="row">
                <div class="col-md-6 col-6">
                    <div class="form-group">
                        <span>Calculation Type</span>
                        <select name="action_penart" class="form-control">
                            <option value="PERCENTAGE VALUE" @selected($typeLabel === 'PERCENTAGE VALUE')>Percentage Value</option>
                            <option value="MONEY VALUE" @selected($typeLabel === 'MONEY VALUE')>Money Value</option>
                        </select>
                    </div>
                </div>
                <div class="col-md-6 col-6">
                    <div class="form-group">
                        <span>Penalt Amount</span>
                        <input type="text" required value="{{ old('penart', (float) $company->penalty_value) }}" class="form-control" placeholder="penart Amount % $" name="penart" autocomplete="off">
                    </div>
                </div>
            </div>
            <div class="text-center m-t-20">
                <button type="submit" class="btn btn-primary"><i class="icon-drawer"></i>Update</button>
            </div>
        </form>
    </x-card>

    <x-card title="Penart Setting">
        <div class="table-responsive">
            <table class="table table-hover js-basic-example dataTable table-custom">
                <thead class="thead-info">
                    <tr>
                        <th>Calculation Type</th>
                        <th>Penalt Amount</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>{{ $typeLabel }}</td>
                        <td>{{ $company->penalty_type === 'money' ? money($company->penalty_value) : (float) $company->penalty_value.'%' }}</td>
                        <td>
                            <form action="{{ route('penalty-setting.update') }}" method="POST" class="d-inline" data-confirm="Are You Sure?">
                                @csrf
                                @method('PUT')
                                <input type="hidden" name="action_penart" value="{{ $typeLabel }}">
                                <input type="hidden" name="penart" value="0">
                                <button type="submit" class="btn btn-sm btn-icon btn-danger"><i class="icon-trash"></i></button>
                            </form>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    </x-card>
@endsection
