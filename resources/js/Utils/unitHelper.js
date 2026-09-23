/**
 * Format jenjang code or name matching CASE WHEN in v_fakultas_unit:
 * C => s1, B => s2, A => s3, E => d3, D => d4, J => profesi, ELSE ''
 */
export function formatJenjang(val) {
    if (!val) return '';
    const clean = String(val).trim().toLowerCase();
    switch (clean) {
        case 'c':
        case 's1':
            return 's1';
        case 'b':
        case 's2':
            return 's2';
        case 'a':
        case 's3':
            return 's3';
        case 'e':
        case 'd3':
            return 'd3';
        case 'd':
        case 'd4':
            return 'd4';
        case 'j':
        case 'profesi':
            return 'profesi';
        default:
            return '';
    }
}

/**
 * Utility to format raw v_fakultas_unit rows into grouped & categorized options for SearchableSelect
 */
export function buildGroupedUnitOptions(units = [], defaultOptionLabel = 'Semua Unit') {
    if (!units || units.length === 0) {
        return defaultOptionLabel ? [{ id: '', label: defaultOptionLabel }] : [];
    }

    const fakultasItems = [];
    const prodiItems = [];
    const unitItems = [];

    units.forEach(u => {
        const type = (u.type || '').toLowerCase();
        const jenjangStr = formatJenjang(u.jenjang || u.kode_jenjang);
        const fakStr = u.fakultas ? ` (Fak. ${u.fakultas})` : '';

        if (type === 'fakultas') {
            const label = u.nama_fak_prod_unit.toUpperCase().startsWith('FAKULTAS') 
                ? u.nama_fak_prod_unit 
                : `FAKULTAS ${u.nama_fak_prod_unit}`;

            fakultasItems.push({
                id: u.id,
                label: label,
                badge: 'FAKULTAS',
                badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
                group: 'FAKULTAS',
                searchStr: `${label} fakultas`.toLowerCase()
            });
        } else if (type === 'prodi') {
            const label = jenjangStr ? `${jenjangStr} - ${u.nama_fak_prod_unit}${fakStr}` : `${u.nama_fak_prod_unit}${fakStr}`;
            prodiItems.push({
                id: u.id,
                label: label,
                badge: jenjangStr ? `PRODI ${jenjangStr}` : 'PRODI',
                badgeColor: 'bg-purple-100 text-purple-800 border-purple-200',
                group: 'PROGRAM STUDI',
                searchStr: `${label} prodi ${jenjangStr} ${u.fakultas || ''}`.toLowerCase()
            });
        } else {
            const label = u.nama_fak_prod_unit.toUpperCase().startsWith('UNIT') || u.nama_fak_prod_unit.toUpperCase().startsWith('LEMBAGA')
                ? u.nama_fak_prod_unit
                : `UNIT - ${u.nama_fak_prod_unit}`;

            unitItems.push({
                id: u.id,
                label: label,
                badge: 'UNIT KERJA',
                badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
                group: 'UNIT KERJA / LEMBAGA',
                searchStr: `${label} unit kerja lembaga`.toLowerCase()
            });
        }
    });

    const result = [];

    if (defaultOptionLabel) {
        result.push({ id: '', label: defaultOptionLabel });
    }

    if (fakultasItems.length > 0) {
        result.push({ isGroupHeader: true, groupTitle: '🏢 FAKULTAS', count: fakultasItems.length });
        result.push(...fakultasItems);
    }

    if (prodiItems.length > 0) {
        result.push({ isGroupHeader: true, groupTitle: '🎓 PROGRAM STUDI', count: prodiItems.length });
        result.push(...prodiItems);
    }

    if (unitItems.length > 0) {
        result.push({ isGroupHeader: true, groupTitle: '🏛️ UNIT KERJA', count: unitItems.length });
        result.push(...unitItems);
    }

    return result;
}
