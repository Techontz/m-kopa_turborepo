@extends('layouts.app')

@section('breadcrumb')
    <li class="breadcrumb-item active">Transifor Float From Acount - Acount</li>
@endsection

@section('content')
    <x-card title="Transifor Float From Ac-Ac">
        <form action="{{ route('floats.accounts.store') }}" method="POST">
            @csrf
            <div class="row">
                <div class="col-md-3">
                    <span>*To Branch Name:</span>
                    <x-branch-select :branches="$branches" placeholder="---Select Branch---" class="form-control select2" />
                </div>
                <div class="col-md-3">
                    <span>*From Account:</span>
                    <select class="form-control" name="from_acc" required>
                        <option value="">select</option>
                        <option value="PR" @selected(old('from_acc') === 'PR')>PRINCIPAL</option>
                        <option value="INT" @selected(old('from_acc') === 'INT')>INTEREST</option>
                    </select>
                </div>
                <div class="col-md-3">
                    <span>*To Account:</span>
                    <select class="form-control" name="to_acc" required>
                        <option value="">select</option>
                        <option value="PR" @selected(old('to_acc') === 'PR')>PRINCIPAL</option>
                        <option value="INT" @selected(old('to_acc') === 'INT')>INTEREST</option>
                    </select>
                </div>
                <div class="col-md-3">
                    <span>*Amount:</span>
                    <input type="number" name="amount" class="form-control" value="{{ old('amount') }}" required>
                </div>
            </div>
            <br>
            <div class="text-center">
                <button type="submit" class="btn btn-primary"><i class="icon-pencil"></i>Transfor</button>
            </div>
        </form>
    </x-card>
@endsection
