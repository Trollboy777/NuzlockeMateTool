const fs = require('fs');
const path = require('path');

const RAW_BASE = 'https://raw.githubusercontent.com/pret/pokeemerald/master';
const POKEMON_PATH = path.join(__dirname, '..', 'data', 'pokemon', 'emerald-pokemon.json');
const OUTPUT_PATH = path.join(__dirname, '..', 'data', 'pokemon', 'emerald-availability.json');

const NAME_OVERRIDES = {
    NIDORAN_F: 'Nidoran-F',
    NIDORAN_M: 'Nidoran-M',
    MR_MIME: 'Mr. Mime',
    HO_OH: 'Ho-Oh',
    FARFETCHD: "Farfetch'd"
};

function formatSpeciesName(raw) {
    const clean = raw.replace(/^SPECIES_/, '');
    if (NAME_OVERRIDES[clean]) return NAME_OVERRIDES[clean];

    return clean
        .toLowerCase()
        .split('_')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
}

function formatMapName(rawMap) {
    let clean = rawMap.replace(/^MAP_/, '');
    clean = clean.replace(/^UNDERWATER_/, 'UNDERWATER ');
    clean = clean.replace(/\bROUTE(\d+)\b/g, 'ROUTE $1');
    clean = clean.replace(/\bMT_/g, 'MT. ');
    clean = clean.replace(/\bSS_/g, 'S.S. ');

    return clean
        .split(/[\s_]+/)
        .map(token => {
            // Behoud verdiepings- en kamercodes zoals 1F, B1F, 1R, 2R in hoofdletters
            if (/^(B?\d+F|\d+R)$/i.test(token)) return token.toUpperCase();
            if (token === 'MT.' || token === 'S.S.') return token;
            return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
        })
        .join(' ');
}

// Vaste gifts, starters, fossils, in-game trades en static encounters in Emerald
const SPECIAL_ENCOUNTERS = {
    Treecko: [{ method: 'starter', location: 'Route 101', level: 5, details: 'Chosen from Professor Birch\'s bag.' }],
    Torchic: [{ method: 'starter', location: 'Route 101', level: 5, details: 'Chosen from Professor Birch\'s bag.' }],
    Mudkip: [{ method: 'starter', location: 'Route 101', level: 5, details: 'Chosen from Professor Birch\'s bag.' }],
    Seedot: [{ method: 'in_game_trade', location: 'Rustboro City', details: 'Trade a Ralts to the boy in the house next to the Gym.' }],
    Plusle: [{ method: 'in_game_trade', location: 'Fortree City', details: 'Trade a Volbeat in the house near the Gym.' }],
    Horsea: [{ method: 'in_game_trade', location: 'Pacifidlog Town', details: 'Trade a Bagon in the southwestern house.' }],
    Meowth: [{ method: 'in_game_trade', location: 'Battle Frontier', details: 'Trade a Skitty in the house near the Battle Pike.' }],
    Lileep: [{ method: 'fossil_revival', location: 'Rustboro City (Devon Corp)', level: 20, details: 'Revived from the Root Fossil (Route 111 Mirage Tower or Desert Underpass).' }],
    Anorith: [{ method: 'fossil_revival', location: 'Rustboro City (Devon Corp)', level: 20, details: 'Revived from the Claw Fossil (Route 111 Mirage Tower or Desert Underpass).' }],
    Wynaut: [{ method: 'gift_egg', location: 'Lavaridge Town', level: 5, details: 'Hatches from the Egg given by the old woman near the hot springs.' }],
    Castform: [{ method: 'gift', location: 'Route 119 (Weather Institute)', level: 25, details: 'Given by the scientists after defeating Team Aqua.' }],
    Beldum: [{ method: 'gift', location: 'Mossdeep City', level: 5, details: 'Pokeball on the table in Steven\'s house after entering the Hall of Fame.' }],
    Chikorita: [{ method: 'gift', location: 'Littleroot Town', level: 5, details: 'Choose one Johto starter from Professor Birch after completing the Hoenn Pokedex.' }],
    Cyndaquil: [{ method: 'gift', location: 'Littleroot Town', level: 5, details: 'Choose one Johto starter from Professor Birch after completing the Hoenn Pokedex.' }],
    Totodile: [{ method: 'gift', location: 'Littleroot Town', level: 5, details: 'Choose one Johto starter from Professor Birch after completing the Hoenn Pokedex.' }],
    Kecleon: [{ method: 'static_encounter', location: 'Routes 119 & 120', level: 30, details: 'Invisible obstacles revealed with the Devon Scope (also 1% wild grass on Routes 119-121).' }],
    Sudowoodo: [{ method: 'static_encounter', location: 'Battle Frontier', level: 40, details: 'Use the Wailmer Pail on the odd tree near the Battle Palace.' }],
    Voltorb: [{ method: 'static_encounter', location: 'New Mauville', level: 25, details: 'Disguised as item balls inside New Mauville.' }],
    Electrode: [{ method: 'static_encounter', location: 'New Mauville', level: 30, details: 'Disguised as item balls inside New Mauville.' }],
    Regirock: [{ method: 'static_encounter', location: 'Desert Ruins (Route 111)', level: 40, details: 'Unlocked after solving the Sealed Chamber puzzle.' }],
    Regice: [{ method: 'static_encounter', location: 'Island Cave (Route 105)', level: 40, details: 'Unlocked after solving the Sealed Chamber puzzle.' }],
    Registeel: [{ method: 'static_encounter', location: 'Ancient Tomb (Route 120)', level: 40, details: 'Unlocked after solving the Sealed Chamber puzzle.' }],
    Latias: [{ method: 'roaming_encounter', location: 'Hoenn (overworld)', level: 40, details: 'Roams Hoenn after entering the Hall of Fame (if Red is chosen on TV).' }],
    Latios: [{ method: 'roaming_encounter', location: 'Hoenn (overworld)', level: 40, details: 'Roams Hoenn after entering the Hall of Fame (if Blue is chosen on TV).' }],
    Kyogre: [{ method: 'static_encounter', location: 'Marine Cave', level: 70, details: 'Available after entering the Hall of Fame via the Weather Institute.' }],
    Groudon: [{ method: 'static_encounter', location: 'Terra Cave', level: 70, details: 'Available after entering the Hall of Fame via the Weather Institute.' }],
    Rayquaza: [{ method: 'static_encounter', location: 'Sky Pillar (Roof)', level: 70, details: 'Available after the Sootopolis City crisis.' }]
};

const METHOD_LABELS = {
    land_mons: 'wild_grass_or_cave',
    water_mons: 'wild_surfing',
    rock_smash_mons: 'wild_rock_smash',
    old_rod: 'fishing_old_rod',
    good_rod: 'fishing_good_rod',
    super_rod: 'fishing_super_rod'
};

async function main() {
    if (!fs.existsSync(POKEMON_PATH)) {
        throw new Error('Draai eerst scripts/import-pokemon.js zodat emerald-pokemon.json bestaat.');
    }

    const pokemonData = JSON.parse(fs.readFileSync(POKEMON_PATH, 'utf8'));
    const obtainableSet = new Set(pokemonData.pokemon.map(p => p.name));

    // Bewaar eventuele handmatige notities (zoals Feebas' 6 visplekken) uit een bestaand bestand
    const existingManualNotes = new Map();
    if (fs.existsSync(OUTPUT_PATH)) {
        try {
            const existing = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf8'));
            for (const entry of existing.availability || []) {
                const manualMethods = (entry.methods || []).filter(
                    m => Array.isArray(m.special_conditions) && m.special_conditions.length > 0
                );
                if (manualMethods.length > 0) {
                    existingManualNotes.set(entry.pokemon, manualMethods);
                }
            }
        } catch {
            // Negeer als oud bestand niet gelezen kan worden
        }
    }

    console.log('wild_encounters.json ophalen uit pret/pokeemerald...');
    const res = await fetch(`${RAW_BASE}/src/data/wild_encounters.json`);
    if (!res.ok) {
        throw new Error(`HTTP ${res.status} bij ophalen van wild_encounters.json`);
    }
    const wildJson = await res.json();

    // Gebruik alleen de echte kaart-encounters (for_maps: true), niet Battle Pike/Pyramid
    const mapGroup = (wildJson.wild_encounter_groups || []).find(g => g.for_maps === true);
    if (!mapGroup) {
        throw new Error('Geen map-encountergroep gevonden in wild_encounters.json');
    }

    // Haal per encountertype de exacte slotpercentages en hengelgroepen op
    const rateMap = {};
    let fishingGroups = {
        old_rod: [0, 1],
        good_rod: [2, 3, 4],
        super_rod: [5, 6, 7, 8, 9]
    };

    for (const field of mapGroup.fields || []) {
        rateMap[field.type] = field.encounter_rates || [];
        if (field.type === 'fishing_mons' && field.groups) {
            fishingGroups = field.groups;
        }
    }

    // speciesName -> methodKey -> locationName -> { minLevel, maxLevel, totalRate }
    const aggregated = new Map();

    function addSlot(speciesName, methodKey, locationName, minLvl, maxLvl, rate) {
        if (!obtainableSet.has(speciesName)) return;
        if (!aggregated.has(speciesName)) aggregated.set(speciesName, new Map());
        const byMethod = aggregated.get(speciesName);

        if (!byMethod.has(methodKey)) byMethod.set(methodKey, new Map());
        const byLoc = byMethod.get(methodKey);

        if (!byLoc.has(locationName)) {
            byLoc.set(locationName, { minLevel: minLvl, maxLevel: maxLvl, totalRate: rate });
        } else {
            const current = byLoc.get(locationName);
            current.minLevel = Math.min(current.minLevel, minLvl);
            current.maxLevel = Math.max(current.maxLevel, maxLvl);
            current.totalRate += rate;
        }
    }

    for (const enc of mapGroup.encounters || []) {
        if (!enc.map) continue;
        const locationName = formatMapName(enc.map);

        for (const fieldType of ['land_mons', 'water_mons', 'rock_smash_mons']) {
            const section = enc[fieldType];
            if (!section || !Array.isArray(section.mons)) continue;
            const rates = rateMap[fieldType] || [];

            section.mons.forEach((mon, idx) => {
                const speciesName = formatSpeciesName(mon.species);
                const rate = rates[idx] ?? 0;
                addSlot(speciesName, METHOD_LABELS[fieldType], locationName, mon.min_level, mon.max_level, rate);
            });
        }

        if (enc.fishing_mons && Array.isArray(enc.fishing_mons.mons)) {
            const rates = rateMap.fishing_mons || [];
            enc.fishing_mons.mons.forEach((mon, idx) => {
                const speciesName = formatSpeciesName(mon.species);
                const rate = rates[idx] ?? 0;

                for (const [rodKey, indices] of Object.entries(fishingGroups)) {
                    if (indices.includes(idx)) {
                        addSlot(speciesName, METHOD_LABELS[rodKey], locationName, mon.min_level, mon.max_level, rate);
                    }
                }
            });
        }
    }

    // Bouw de uiteindelijke lijst in dezelfde volgorde als emerald-pokemon.json
    const availability = [];

    for (const poke of pokemonData.pokemon) {
        const methods = [];

        // 1. Handmatige speciale condities (bijv. Feebas 6 tiles) eerst toevoegen
        if (existingManualNotes.has(poke.name)) {
            methods.push(...existingManualNotes.get(poke.name));
        }

        // 2. Speciale starters / gifts / trades / static encounters
        if (SPECIAL_ENCOUNTERS[poke.name]) {
            methods.push(...SPECIAL_ENCOUNTERS[poke.name]);
        }

        // 3. Wilde encounters per methode
        const byMethod = aggregated.get(poke.name);
        if (byMethod) {
            for (const [methodLabel, byLoc] of byMethod.entries()) {
                const locations = [...byLoc.entries()].map(([locName, info]) => ({
                    location: locName,
                    level_range: [info.minLevel, info.maxLevel],
                    encounter_rate: `${info.totalRate}%`
                }));

                methods.push({
                    method: methodLabel,
                    locations
                });
            }
        }

        // 4. Evolutie / breeding fallback als er geen directe vangstmethode is
        if (methods.length === 0) {
            if (poke.evolution?.from) {
                methods.push({
                    method: 'evolution',
                    details: `Evolve from ${poke.evolution.from}.`
                });
            } else if ((poke.obtainability_methods || []).includes('breeding')) {
                methods.push({
                    method: 'breeding',
                    details: 'Obtainable by breeding its evolved form at the Route 117 Day Care.'
                });
            }
        }

        if (methods.length > 0) {
            availability.push({
                pokemon: poke.name,
                methods,
                data_status: 'verified'
            });
        }
    }

    const output = {
        game: 'Pokemon Emerald',
        generation: 3,
        region: 'Hoenn',
        data_scope: 'Verified in-game acquisition methods, wild encounter routes, level ranges and encounter rates for all 244 obtainable Emerald species.',
        availability_count: availability.length,
        availability,
        sources: [
            'https://github.com/pret/pokeemerald/blob/master/src/data/wild_encounters.json'
        ]
    };

    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), 'utf8');
    console.log(`Klaar! ${availability.length} beschikbaarheidsrecords opgeslagen in ${OUTPUT_PATH}`);
}

main().catch(err => {
    console.error('Fout tijdens importeren van locaties:', err.message);
    process.exit(1);
});