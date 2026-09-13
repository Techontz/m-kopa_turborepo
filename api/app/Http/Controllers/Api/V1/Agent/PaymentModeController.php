<?php

namespace App\Http\Controllers\Api\V1\Agent;

use App\Http\Controllers\Api\V1\ApiController;
use App\Http\Resources\Api\V1\Agent\PaymentModeResource;
use App\Models\AgentTransaction;
use App\Models\PaymentMode;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * Agent → Payment mode (live admin/mode_payment).
 */
class PaymentModeController extends ApiController
{
    public function index(): AnonymousResourceCollection
    {
        $this->authorizeAny('agent.manage');

        return PaymentModeResource::collection(PaymentMode::where('company_id', $this->currentEmployee()->company_id)->orderBy('id')->get());
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorizeAny('agent.manage');

        $data = $request->validate(['pay_mode' => ['required', 'string', 'max:255']], ['pay_mode.required' => 'Please enter mode of payment']);

        $mode = PaymentMode::create(['company_id' => $this->currentEmployee()->company_id, 'name' => $data['pay_mode']]);

        return $this->message('Mode of payment Registered successfully', 201, ['data' => new PaymentModeResource($mode)]);
    }

    public function destroy(PaymentMode $paymentMode): JsonResponse
    {
        $this->authorizeAny('agent.manage');

        if (AgentTransaction::where('payment_mode_id', $paymentMode->id)->exists()) {
            return $this->message('Mode of payment has transactions and cannot be deleted', 422);
        }

        $paymentMode->delete();

        return $this->message('Mode of payment Deleted successfully');
    }
}
