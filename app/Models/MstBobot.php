<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MstBobot extends Model
{
    protected $table = 'mst_bobot';
    protected $primaryKey = 'id_bobot';

    protected $fillable = [
        'id_bobot',
        'kode_iku',
        'komponen',
        'kondisi',
        'catatan_level',
        'nilai_bobot',
        'keterangan',
        'tahun_berlaku'
    ];
}
