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
        const jenjangStr = u.jenjang ? u.jenjang.toUpperCase() : '';
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
            unitItems.push({
                id: u.id,
                label: u.nama_fak_prod_unit,
                badge: 'UNIT KERJA',
                badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
                group: 'UNIT KERJA / LEMBAGA',
                searchStr: `${u.nama_fak_prod_unit} unit kerja lembaga`.toLowerCase()
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
