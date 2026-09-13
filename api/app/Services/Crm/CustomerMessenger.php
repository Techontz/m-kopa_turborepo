<?php

namespace App\Services\Crm;

use App\Integrations\Sms\SmsGateway;
use App\Models\CrmInteraction;
use App\Models\Customer;
use App\Models\Employee;
use App\Models\SmsLog;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\DB;

/**
 * Sends customer SMS through the swappable SMS connector and records them in sms_logs
 * and in the CRM timeline.
 */
class CustomerMessenger
{
    public function __construct(private readonly SmsGateway $gateway) {}

    public function send(Customer $customer, string $message, Employee $employee, ?CarbonInterface $followUpDate = null): CrmInteraction
    {
        $this->gateway->send($customer->phone, $message);

        return DB::transaction(function () use ($customer, $message, $employee, $followUpDate): CrmInteraction {
            $log = SmsLog::create([
                'company_id' => $customer->company_id,
                'customer_id' => $customer->id,
                'phone' => $customer->phone,
                'message' => $message,
            ]);

            return CrmInteraction::create([
                'company_id' => $customer->company_id,
                'branch_id' => $customer->branch_id,
                'customer_id' => $customer->id,
                'employee_id' => $employee->id,
                'type' => 'sms',
                'direction' => 'outgoing',
                'phone' => $customer->phone,
                'notes' => $message,
                'sms_log_id' => $log->id,
                'follow_up_date' => $followUpDate?->toDateString(),
            ]);
        });
    }
}
