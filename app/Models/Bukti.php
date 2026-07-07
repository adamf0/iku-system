<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Bukti extends Model
{
    protected $table = 'bukti';
    protected $primaryKey = 'id_bukti';

    protected $fillable = [
        'id_bukti',
        'id_capaian',
        'jenis_dokumen',
        'file_url',
        'diunggah_oleh',
        'tanggal_unggah'
    ];
}
