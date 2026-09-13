@extends('layouts.app')

@section('breadcrumb')
    <li class="breadcrumb-item active">Edit Loan Category</li>
@endsection

@section('content')
    <x-card title="Loan Category">
        <form action="{{ route('loan-categories.update', $category) }}" method="POST">
            @csrf
            @method('PUT')
            @include('settings.loan-categories._fields', ['category' => $category])
            <div class="text-center m-t-20">
                <button type="submit" class="btn btn-info btn-sm">Update</button>
                <a href="{{ route('loan-categories.index') }}" class="btn btn-sm btn-info"><i class="icon-arrow-left-circle"></i></a>
            </div>
        </form>
    </x-card>
@endsection
