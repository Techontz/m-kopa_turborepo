@extends('layouts.app')

@section('breadcrumb')
    <li class="breadcrumb-item active">Reserve Setting</li>
@endsection

@section('content')
    <x-card title="Reserve Setting">
        <form action="{{ route('reserve-setting.update') }}" method="POST">
            @csrf
            @method('PUT')
            <div class="row">
                <div class="col-md-12 col-12">
                    <div class="form-group">
                        <span>Reserve Percentage</span>
                        <input type="text" required value="{{ old('reserve', (float) $company->reserve_percent) }}" class="form-control" placeholder="Enter Recerve Percentage % " name="reserve" autocomplete="off">
                    </div>
                </div>
            </div>
            <div class="text-center m-t-20">
                <button type="submit" class="btn btn-primary"><i class="icon-drawer"></i>Update</button>
            </div>
        </form>
    </x-card>
@endsection
