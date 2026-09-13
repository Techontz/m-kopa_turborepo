<?php

namespace App\Services\Customers;

use App\Models\Region;
use App\Models\Street;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;

/**
 * Mkoa → Wilaya → Kata lists from database/data/all-ward.json (Documents), plus Mtaa collected in `streets`.
 * The 3.5 MB source is compacted once into storage/framework/cache/tz-locations.json.
 */
class TanzaniaLocations
{
    /**
     * @var array{regions: list<array{code: string, name: string}>, districts: array<string, list<array{code: string, name: string}>>, wards: array<string, list<array{code: string, name: string}>>}|null
     */
    private static ?array $tree = null;

    /**
     * @return list<array{code: string, name: string}>
     */
    public function regions(): array
    {
        return $this->tree()['regions'];
    }

    /**
     * @return list<array{code: string, name: string}>
     */
    public function districts(string $regionCode): array
    {
        return $this->tree()['districts'][$regionCode] ?? [];
    }

    /**
     * @return list<array{code: string, name: string}>
     */
    public function wards(string $districtCode): array
    {
        return $this->tree()['wards'][$districtCode] ?? [];
    }

    /**
     * @return list<string>
     */
    public function streets(string $wardCode): array
    {
        return Street::where('ward_code', $wardCode)->orderBy('name')->pluck('name')->all();
    }

    public function regionName(string $code): ?string
    {
        return collect($this->regions())->firstWhere('code', $code)['name'] ?? null;
    }

    public function districtName(string $regionCode, string $code): ?string
    {
        return collect($this->districts($regionCode))->firstWhere('code', $code)['name'] ?? null;
    }

    public function wardName(string $districtCode, string $code): ?string
    {
        return collect($this->wards($districtCode))->firstWhere('code', $code)['name'] ?? null;
    }

    /**
     * The live `regions` master table uses slightly different spellings ("Dar es salaam" vs "Dar-es-salaam").
     */
    public function matchLegacyRegionId(string $regionName): ?int
    {
        $normalise = fn (string $name): string => Str::of($name)->lower()->replaceMatches('/[^a-z]/', '')->toString();
        $target = $normalise($regionName);

        return Region::query()->get(['id', 'name'])->first(fn (Region $region): bool => $normalise($region->name) === $target)?->id;
    }

    /**
     * @return array{regions: list<array{code: string, name: string}>, districts: array<string, list<array{code: string, name: string}>>, wards: array<string, list<array{code: string, name: string}>>}
     */
    private function tree(): array
    {
        if (self::$tree !== null) {
            return self::$tree;
        }

        $source = database_path('data/all-ward.json');
        $compiled = storage_path('framework/cache/tz-locations.json');

        if (File::exists($compiled) && File::lastModified($compiled) >= File::lastModified($source)) {
            return self::$tree = json_decode(File::get($compiled), true);
        }

        $regions = [];
        $districts = [];
        $wards = [];

        foreach (json_decode(File::get($source), true) as $ward) {
            [$region, $district] = $ward['ancestors'];
            $regions[$region['id']] = ['code' => $region['id'], 'name' => $region['name']['local']];
            $districts[$region['id']][$district['id']] = ['code' => $district['id'], 'name' => $district['name']['local']];
            $wards[$district['id']][] = ['code' => $ward['id'], 'name' => $ward['name']['local']];
        }

        self::$tree = [
            'regions' => array_values($regions),
            'districts' => array_map('array_values', $districts),
            'wards' => $wards,
        ];

        File::ensureDirectoryExists(dirname($compiled));
        File::put($compiled, json_encode(self::$tree, JSON_UNESCAPED_UNICODE));

        return self::$tree;
    }
}
