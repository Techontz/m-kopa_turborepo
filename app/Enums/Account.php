<?php

namespace App\Enums;

/**
 * Ledger accounts. Branch accounts carry a branch_id; HQ accounts have none.
 */
enum Account: string
{
    case Principal = 'principal';
    case Interest = 'interest';
    case Reserve = 'reserve';
    case LoanFee = 'loan_fee';
    case Penalty = 'penalty';
    case Agent = 'agent';
    case Insurance = 'insurance';
    case Bank = 'bank';
    case HqSalaryAdvance = 'hq_salary_advance';
    case HqDisbursement = 'hq_disbursement';
    case HqPenalty = 'hq_penalty';
    case HqInterest = 'hq_interest';
    case HqReserve = 'hq_reserve';
    case HqLoanFee = 'hq_loan_fee';
    case HqSaving = 'hq_saving';
    case Company = 'company';

    public function label(): string
    {
        return match ($this) {
            self::Principal => 'PRINCIPAL A/C',
            self::Interest => 'INTEREST A/C',
            self::Reserve => 'RESERVE A/C',
            self::LoanFee => 'LOAN FEE A/C',
            self::Penalty => 'PENARTY A/C',
            self::Agent => 'AGENT A/C',
            self::Insurance => 'INSURANCE A/C',
            self::Bank => 'BANK',
            self::HqSalaryAdvance => 'SALARY ADVANCE ACCOUNT',
            self::HqDisbursement => 'DISBURSEMENT ACCOUNT',
            self::HqPenalty => 'PENALTY ACCOUNT',
            self::HqInterest => 'INTEREST ACCOUNT',
            self::HqReserve => 'RESERVE ACCOUNT',
            self::HqLoanFee => 'LOAN FEE ACCOUNT',
            self::HqSaving => 'SAVING ACCOUNT',
            self::Company => 'COMPANY ACCOUNT',
        };
    }

    /**
     * Branch accounts that can send money to a bank ("Bank Transaction" modal).
     *
     * @return array<int, self>
     */
    public static function transferableBranchAccounts(): array
    {
        return [self::Principal, self::Interest, self::Reserve, self::LoanFee, self::Penalty];
    }

    /**
     * @return array<int, self>
     */
    public static function hqAccounts(): array
    {
        return [self::HqSalaryAdvance, self::HqDisbursement, self::HqPenalty, self::HqInterest, self::HqReserve, self::HqLoanFee, self::HqSaving];
    }
}
