<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Rincian extends Model
{
    protected $table = 'rincian';
    protected $primaryKey = 'id_rincian';

    protected $fillable = [
        'id_rincian',
        'id_capaian',
        'entitas_id',
        'kriteria_terpenuhi',
        'bobot_diterapkan',
        'kontribusi_nilai',
        'dicatat_oleh',
        'tanggal'
    ];
}
