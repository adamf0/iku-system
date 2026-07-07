<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Facades\DB;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'username',
        'email',
        'password',
        'role',
        'kode_unit',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    /**
     * Get list of unit codes this user has access to.
     */
    public function scopeUnits(): array
    {
        if (in_array($this->role, ['LPM', 'ADMIN'])) {
            return DB::table('units')->pluck('kode_unit')->toArray();
        }

        if (!$this->kode_unit) {
            return [];
        }

        $allUnits = DB::table('units')->get()->toArray();
        $res = [$this->kode_unit];
        $queue = [$this->kode_unit];

        while (count($queue) > 0) {
            $current = array_shift($queue);
            foreach ($allUnits as $u) {
                if ($u->unit_induk === $current && !in_array($u->kode_unit, $res)) {
                    $res[] = $u->kode_unit;
                    $queue[] = $u->kode_unit;
                }
            }
        }

        return $res;
    }
}
