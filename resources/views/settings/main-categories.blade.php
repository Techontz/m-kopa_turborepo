@extends('layouts.app')

@section('breadcrumb')
    <li class="breadcrumb-item active">Loan category</li>
@endsection

@section('content')
    <x-card title="Category List">
        <div class="table-responsive">
            <table class="table table-hover js-basic-example dataTable table-custom">
                <thead class="thead-info">
                    <tr>
                        <th>S/No.</th>
                        <th>Category Name</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach ($categories as $category)
                        <tr>
                            <td>{{ $loop->iteration }}.</td>
                            <td>{{ $category->name }}</td>
                            <td>
                                <x-action-button :action="route('main-categories.enable', $category)" class="btn btn-primary btn-sm" icon="icon-check" />
                            </td>
                        </tr>
                    @endforeach
                </tbody>
            </table>
        </div>
    </x-card>

    <x-card title=" ">
        <div class="table-responsive">
            <table class="table table-hover js-basic-example dataTable table-custom">
                <thead class="thead-info">
                    <tr>
                        <th>S/No.</th>
                        <th>Category Name</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach ($enabledCategories as $category)
                        <tr>
                            <td>{{ $loop->iteration }}</td>
                            <td>{{ $category->name }}</td>
                            <td>
                                <a href="{{ route('main-categories.types', $category) }}" class="btn btn-info btn-sm"><i class="icon-eye"></i></a>
                                <x-action-button :action="route('main-categories.disable', $category)" method="DELETE" confirm="Are You Sure?" icon="icon-trash" />
                            </td>
                        </tr>
                    @endforeach
                </tbody>
            </table>
        </div>
    </x-card>
@endsection
