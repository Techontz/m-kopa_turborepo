<?php

namespace App\Services\LegacyImports;

use App\Models\LegacyImport;
use RuntimeException;

/**
 * The three files the old system hands over, and the columns each must have.
 *
 * The headers are the ones printed on the old system's own screens, spelling included ("Carger", "Date Alert"), so an
 * exported file can be corrected and uploaded back unchanged. A file whose headers do not match is refused outright
 * rather than guessed at, because a column read into the wrong field would move a customer's balance.
 */
final class LegacyFileFormat
{
    /**
     * Active Salary Advance: the columns of the Active Salary Advance list.
     */
    public const SALARY_ADVANCE = [
        'No.', 'Customer Name', 'Branch Name', 'Loan Amount', 'Interest', 'Principal + Interest',
        'Paid Amount', 'Remain Amount', 'Status', 'Carger', 'Date Alert', 'Action',
    ];

    /**
     * Penalty List: the columns of the Penalty List.
     */
    public const PENALTY = [
        'No.', 'Customer Name', 'Branch Name', 'Loan Amount', 'Penalty Amount', 'Date', 'Accounting', 'Action',
    ];

    /**
     * Loan File: the columns of the File report, with one column per month January to September.
     */
    public const LOAN = [
        'No.', 'Branch Name', 'Customer Name', 'Phone Number', 'Loan Amount', 'Duration Type / Number',
        'Collection', 'Paid Amount', 'Remain Amount', 'Withdrawal Date', 'Loan Status',
        'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September',
    ];

    public const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September'];

    /**
     * The columns of a module, in order.
     *
     * @return list<string>
     */
    public static function headers(string $module): array
    {
        return match ($module) {
            LegacyImport::MODULE_SALARY_ADVANCE => self::SALARY_ADVANCE,
            LegacyImport::MODULE_PENALTY => self::PENALTY,
            LegacyImport::MODULE_LOAN => self::LOAN,
            default => throw new RuntimeException("Unknown legacy import module: {$module}."),
        };
    }

    /**
     * What the file is called on screen and in the refusal message.
     */
    public static function label(string $module): string
    {
        return match ($module) {
            LegacyImport::MODULE_SALARY_ADVANCE => 'Active Salary Advance',
            LegacyImport::MODULE_PENALTY => 'Penalty List',
            LegacyImport::MODULE_LOAN => 'Loan File',
            default => $module,
        };
    }

    /**
     * Whether the uploaded header row is the module's, ignoring case, spacing and surrounding punctuation so a file
     * that has been through a spreadsheet still passes.
     *
     * @param  list<string>  $uploaded
     */
    public static function matches(string $module, array $uploaded): bool
    {
        return array_map(self::normalise(...), $uploaded) === array_map(self::normalise(...), self::headers($module));
    }

    /**
     * Why a header row was refused, naming the first column that is wrong so the file can be corrected.
     *
     * @param  list<string>  $uploaded
     */
    public static function mismatchReason(string $module, array $uploaded): string
    {
        $expected = self::headers($module);
        $label = self::label($module);
        if (count($uploaded) !== count($expected)) {
            return sprintf('Invalid file format for %s Import. The file has %d columns; %d are expected: %s.', $label, count($uploaded), count($expected), implode(', ', $expected));
        }

        foreach ($expected as $index => $header) {
            if (self::normalise($uploaded[$index] ?? '') !== self::normalise($header)) {
                return sprintf('Invalid file format for %s Import. Column %d is "%s"; "%s" is expected.', $label, $index + 1, $uploaded[$index] ?? '', $header);
            }
        }

        return sprintf('Invalid file format for %s Import.', $label);
    }

    private static function normalise(string $header): string
    {
        return strtolower(trim((string) preg_replace('/\s+/', ' ', str_replace(['_', '.'], [' ', ''], $header))));
    }
}
