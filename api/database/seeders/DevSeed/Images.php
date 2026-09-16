<?php

namespace Database\Seeders\DevSeed;

use Illuminate\Http\UploadedFile;

/**
 * Generated placeholder images (GD) for uploads the API requires: clearly labelled, never a real photo or face.
 */
final class Images
{
    public static function faceCapture(): UploadedFile
    {
        return self::png(640, 480, ['DEVSEED PLACEHOLDER', 'NOT A REAL FACE CAPTURE'], 'devseed-face-capture.png');
    }

    public static function passport(string $initials): UploadedFile
    {
        return self::png(240, 300, [$initials, 'DEVSEED'], 'devseed-passport.png');
    }

    /**
     * @param  list<string>  $lines
     */
    private static function png(int $width, int $height, array $lines, string $name): UploadedFile
    {
        $image = imagecreatetruecolor($width, $height);
        imagefill($image, 0, 0, imagecolorallocate($image, 72, 84, 96));
        $white = imagecolorallocate($image, 240, 240, 240);

        foreach ($lines as $index => $line) {
            $x = max(4, (int) (($width - imagefontwidth(5) * strlen($line)) / 2));
            imagestring($image, 5, $x, (int) ($height / 2) - 20 + $index * 24, $line, $white);
        }

        $path = tempnam(sys_get_temp_dir(), 'devseed').'.png';
        imagepng($image, $path);
        imagedestroy($image);

        return new UploadedFile($path, $name, 'image/png', null, true);
    }
}
