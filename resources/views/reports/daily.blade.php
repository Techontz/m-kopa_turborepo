@extends('layouts.app')

@section('breadcrumb')
    <li class="breadcrumb-item active">Daily Report</li>
@endsection

@php
    $heading = $filter->from->equalTo($filter->to)
        ? $filter->from->format('F, d, Y')
        : $filter->from->format('F, d, Y').' - '.$filter->to->format('F, d, Y');
@endphp

@section('content')
    <x-card :title="'Daily Report / '.$heading">
        <x-slot:actions>
            <x-header-button target="addcontact1" />
        </x-slot:actions>

        <div class="table-responsive">
            <table class="table table-hover dataTable table-custom" data-no-datatable>
                <thead class="thead-info">
                    <tr>
                        <th>DESCRIPTION</th>
                        <th>AMOUNT</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td><b>OPENING</b></td>
                        <td><b>{{ money($report['opening']) }}</b></td>
                    </tr>
                    @foreach ($report['in'] as $label => $amount)
                        <tr>
                            <td>{{ $label }}</td>
                            <td>{{ money($amount) }}</td>
                        </tr>
                    @endforeach
                    <tr>
                        <td><b style="color:green;">TOTAL</b></td>
                        <td><b style="color:green;">{{ money($report['total_in']) }}</b></td>
                    </tr>
                    <tr>
                        <td style="border: none;">&nbsp;</td>
                        <td style="border: none;"></td>
                    </tr>
                    @foreach ($report['out'] as $label => $amount)
                        <tr>
                            <td>{{ $label }}</td>
                            <td>{{ money($amount) }}</td>
                        </tr>
                    @endforeach
                    <tr>
                        <td><b style="color:red;">TOTAL</b></td>
                        <td><b style="color:red">{{ money($report['total_out']) }}</b></td>
                    </tr>
                    <tr>
                        <td style="border: none;">&nbsp;</td>
                        <td style="border: none;"></td>
                    </tr>
                    <tr>
                        <td><b>CLOSING</b></td>
                        <td><b>{{ money($report['closing']) }}</b></td>
                    </tr>
                </tbody>
            </table>
        </div>
    </x-card>

    @include('reports.partials.date-filter', ['id' => 'addcontact1', 'title' => 'Filter Daily Report', 'action' => route('reports.daily'), 'placeholder' => '---Select Branch---'])
@endsection
