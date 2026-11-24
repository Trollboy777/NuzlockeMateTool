const fs = require('fs');
const path = require('path');

const RAW_BASE = 'https://raw.githubusercontent.com/pret/pokeemerald/master';
const OUTPUT_PATH = path.join(__dirname, '..', 'data', 'pokemon', 'emerald-pokemon.json');

const NAME_OVERRIDES = {
    NIDORAN_F: 'Nidoran-F',
    NIDORAN_M: 'Nidoran-M',
    MR_MIME: 'Mr. Mime',
    HO_OH: 'Ho-Oh',
    FARFETCHD: "Farfetch'd"
};

// De 4 vaste in-game trades in Pokémon Emerald (Rustboro, Fortree, Pacifidlog, Battle Frontier)
const IN_GAME_TRADE_SPECIES = ['SEEDOT', 'PLUSLE', 'HORSEA', 'MEOWTH'];

// Vaste in-game gifts, fossils en static encounters in Emerald (zonder events/ruilen)
const STATIC_AND_GIFT_SPECIES = [
    'TREECKO', 'TORCHIC', 'MUDKIP',
    'LILEEP', 'ANORITH',
    'WYNAUT', 'CASTFORM', 'BELDUM',
    'CHIKORITA', 'CYNDAQUIL', 'TOTODILE',
    'KECLEON', 'SUDOWOODO', 'VOLTORB', 'ELECTRODE',
    'REGIROCK', 'REGICE', 'REGISTEEL',
    'LATIAS', 'LATIOS',
    'KYOGRE', 'GROUDON', 'RAYQUAZA'
];

// Event-only mythicals/legendaries die niet normaal in-game verkrijgbaar zijn
const EVENT_ONLY_SPECIES = new Set([
    'MEW', 'LUGIA', 'HO_OH', 'CELEBI', 'JIRACHI', 'DEOXYS'
]);

function formatConstantName(raw, prefix) {
    const clean = raw.replace(new RegExp(`^${prefix}`), '');
    if (NAME_OVERRIDES[clean]) return NAME_OVERRIDES[clean];

    return clean
        .toLowerCase()
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

function extractBraceBlock(text, openBraceIndex) {
    let depth = 0;
    for (let i = openBraceIndex; i < text.length; i++) {
        if (text[i] === '{') depth++;
        else if (text[i] === '}') {
            depth--;
            if (depth === 0) {
                return {
                    content: text.slice(openBraceIndex + 1, i),
                    endIndex: i
                };
            }
        }
    }
    return null;
}

function parseDexEnum(headerText, prefix) {
    // Verwijder #define-regels zodat macro's zoals KANTO_DEX_COUNT niet meetellen
    const withoutDefines = headerText.replace(/^\s*#define\b.*$/gm, '');
    const map = new Map();
    const regex = new RegExp(`\\b${prefix}([A-Z0-9_]+)\\b`, 'g');
    let match;
    let index = 0;

    while ((match = regex.exec(withoutDefines)) !== null) {
        const key = match[1];
        if (key === 'NONE' || key === 'COUNT' || key === 'END') continue;
        if (!map.has(key)) {
            index++;
            map.set(key, index);
        }
    }
    return map;
}

function parseEvolutions(evolutionText) {
    const evoByTarget = new Map();
    const edges = [];
    const entryRegex = /\[SPECIES_([A-Z0-9_]+)\]\s*=\s*\{/g;
    let match;

    while ((match = entryRegex.exec(evolutionText)) !== null) {
        const fromKey = match[1];
        const openBrace = match.index + match[0].length - 1;
        const block = extractBraceBlock(evolutionText, openBrace);
        if (!block) continue;

        const evoItemRegex = /\{EVO_([A-Z0-9_]+)\s*,\s*([^,]+)\s*,\s*SPECIES_([A-Z0-9_]+)\}/g;
        let evoMatch;

        while ((evoMatch = evoItemRegex.exec(block.content)) !== null) {
            const rawMethod = evoMatch[1];
            const rawParam = evoMatch[2].trim();
            const targetKey = evoMatch[3];
            const fromName = formatConstantName(fromKey, '');

            edges.push({ fromKey, targetKey });

            if (rawMethod === 'BEAUTY') {
                evoByTarget.set(targetKey, {
                    from: fromName,
                    method: 'beauty',
                    condition: { type: 'beauty', minimum: Number(rawParam) || 170 },
                    trigger: 'level_up'
                });
            } else if (rawMethod.startsWith('LEVEL')) {
                const evoObj = {
                    from: fromName,
                    method: 'level',
                    level: Number(rawParam)
                };
                if (rawMethod !== 'LEVEL') {
                    evoObj.condition = rawMethod.toLowerCase();
                }
                evoByTarget.set(targetKey, evoObj);
            } else if (rawMethod === 'ITEM') {
                evoByTarget.set(targetKey, {
                    from: fromName,
                    method: 'stone',
                    item: formatConstantName(rawParam, 'ITEM_')
                });
            } else if (rawMethod.startsWith('FRIENDSHIP')) {
                evoByTarget.set(targetKey, {
                    from: fromName,
                    method: 'friendship',
                    condition: rawMethod.toLowerCase()
                });
            } else if (rawMethod.startsWith('TRADE')) {
                const evoObj = { from: fromName, method: 'trade' };
                if (rawParam !== '0') {
                    evoObj.item = formatConstantName(rawParam, 'ITEM_');
                }
                evoByTarget.set(targetKey, evoObj);
            }
        }
    }

    return { evoByTarget, edges };
}

// Verzamelt alle wild-vangbare soorten uit wild_encounters.json (inclusief Safari Zone)
function extractWildSpecies(wildJson) {
    const speciesSet = new Set();
    const mapGroups = (wildJson.wild_encounter_groups || []).filter(g => g.for_maps === true);

    function walk(node) {
        if (!node || typeof node !== 'object') return;
        if (Array.isArray(node)) {
            node.forEach(walk);
            return;
        }
        if (typeof node.species === 'string' && node.species.startsWith('SPECIES_')) {
            speciesSet.add(node.species.replace(/^SPECIES_/, ''));
        }
        Object.values(node).forEach(walk);
    }

    walk(mapGroups);
    return speciesSet;
}

// Bepaalt welke soorten normaal in-game verkrijgbaar zijn in Emerald
function buildObtainabilityMap(wildSet, evoEdges) {
    const methodsMap = new Map();

    const addMethod = (key, method) => {
        if (EVENT_ONLY_SPECIES.has(key)) return;
        if (!methodsMap.has(key)) methodsMap.set(key, new Set());
        methodsMap.get(key).add(method);
    };

    wildSet.forEach(key => addMethod(key, 'wild'));
    IN_GAME_TRADE_SPECIES.forEach(key => addMethod(key, 'in_game_trade'));
    STATIC_AND_GIFT_SPECIES.forEach(key => addMethod(key, 'gift_or_static'));

    let changed = true;
    while (changed) {
        changed = false;
        for (const { fromKey, targetKey } of evoEdges) {
            if (methodsMap.has(fromKey) && !methodsMap.has(targetKey)) {
                addMethod(targetKey, 'evolution');
                changed = true;
            }
            if (methodsMap.has(targetKey) && !methodsMap.has(fromKey)) {
                addMethod(fromKey, 'breeding');
                changed = true;
            }
        }
    }

    return methodsMap;
}

function parseSpeciesInfo(speciesText, nationalDexMap, hoennDexMap, evoByTarget, obtainabilityMap) {
    const obtainablePokemon = [];
    const unobtainableNames = [];

    const entryRegex = /\[SPECIES_([A-Z0-9_]+)\]\s*=\s*\{/g;
    let match;

    while ((match = entryRegex.exec(speciesText)) !== null) {
        const speciesKey = match[1];
        if (speciesKey === 'NONE' || speciesKey === 'EGG' || speciesKey.startsWith('OLD_UNOWN')) {
            continue;
        }

        const openBrace = match.index + match[0].length - 1;
        const block = extractBraceBlock(speciesText, openBrace);
        if (!block) continue;

        const body = block.content;
        const getStat = field => {
            const m = body.match(new RegExp(`\\.${field}\\s*=\\s*(\\d+)`));
            return m ? Number(m[1]) : null;
        };

        const hp = getStat('baseHP');
        if (hp === null) continue;

        const name = formatConstantName(speciesKey, '');
        const methods = obtainabilityMap.get(speciesKey);

        if (!methods) {
            unobtainableNames.push(name);
            continue;
        }

        const typesMatch = body.match(/\.types\s*=\s*\{([^}]+)\}/);
        const types = typesMatch
            ? [...new Set(
                typesMatch[1]
                    .split(',')
                    .map(t => t.trim())
                    .filter(t => t && t !== 'TYPE_NONE')
                    .map(t => formatConstantName(t, 'TYPE_'))
            )]
            : [];

        const abilitiesMatch = body.match(/\.abilities\s*=\s*\{([^}]+)\}/);
        const abilities = abilitiesMatch
            ? [...new Set(
                abilitiesMatch[1]
                    .split(',')
                    .map(a => a.trim())
                    .filter(a => a && a !== 'ABILITY_NONE')
                    .map(a => formatConstantName(a, 'ABILITY_'))
            )]
            : [];

        const nationalDex = nationalDexMap.get(speciesKey) ?? null;
        const hoennDex = hoennDexMap.get(speciesKey) ?? null;

        obtainablePokemon.push({
            national_dex: nationalDex,
            hoenn_dex: hoennDex,
            in_hoenn_dex: hoennDex !== null,
            obtainable_in_emerald: true,
            obtainability_methods: [...methods],
            name,
            types,
            abilities,
            base_stats: {
                hp,
                attack: getStat('baseAttack'),
                defense: getStat('baseDefense'),
                special_attack: getStat('baseSpAttack'),
                special_defense: getStat('baseSpDefense'),
                speed: getStat('baseSpeed')
            },
            evolution: evoByTarget.get(speciesKey) ?? null,
            data_status: 'verified'
        });
    }

    obtainablePokemon.sort((a, b) => {
        if (a.hoenn_dex !== null && b.hoenn_dex !== null) return a.hoenn_dex - b.hoenn_dex;
        if (a.hoenn_dex !== null) return -1;
        if (b.hoenn_dex !== null) return 1;
        return (a.national_dex ?? 9999) - (b.national_dex ?? 9999);
    });

    return { obtainablePokemon, unobtainableNames };
}

async function fetchRequired(relativePath) {
    const url = `${RAW_BASE}/${relativePath}`;
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`HTTP ${res.status} bij ophalen van ${url}`);
    }
    return res;
}

async function main() {
    console.log('Bestanden ophalen uit pret/pokeemerald...');

    const [pokedexRes, speciesRes, evolutionRes, wildRes] = await Promise.all([
        fetchRequired('include/constants/pokedex.h'),
        fetchRequired('src/data/pokemon/species_info.h'),
        fetchRequired('src/data/pokemon/evolution.h'),
        fetchRequired('src/data/wild_encounters.json')
    ]);

    const [pokedexText, speciesText, evolutionText, wildJson] = await Promise.all([
        pokedexRes.text(),
        speciesRes.text(),
        evolutionRes.text(),
        wildRes.json()
    ]);

    const nationalDexMap = parseDexEnum(pokedexText, 'NATIONAL_DEX_');
    const hoennDexMap = parseDexEnum(pokedexText, 'HOENN_DEX_');
    const { evoByTarget, edges } = parseEvolutions(evolutionText);
    const wildSet = extractWildSpecies(wildJson);
    const obtainabilityMap = buildObtainabilityMap(wildSet, edges);

    const { obtainablePokemon, unobtainableNames } = parseSpeciesInfo(
        speciesText,
        nationalDexMap,
        hoennDexMap,
        evoByTarget,
        obtainabilityMap
    );

    const output = {
        game: 'Pokemon Emerald',
        generation: 3,
        region: 'Hoenn',
        data_scope: 'All Pokemon normally obtainable in-game in Pokemon Emerald (excluding external trades and event-only mythicals)',
        pokemon_count: obtainablePokemon.length,
        pokemon: obtainablePokemon,
        unobtainable_in_emerald: unobtainableNames,
        data_policy: [
            'Use Generation III typings; Fairy type does not exist in this game.',
            'Only species normally obtainable in-game in Pokemon Emerald are included in the pokemon array.',
            'Species listed under unobtainable_in_emerald exist in Generation III code but cannot be obtained normally in-game in Emerald.',
            'Do not infer moves, locations, or other facts from later-generation games.'
        ],
        sources: [
            'https://github.com/pret/pokeemerald/blob/master/include/constants/pokedex.h',
            'https://github.com/pret/pokeemerald/blob/master/src/data/pokemon/species_info.h',
            'https://github.com/pret/pokeemerald/blob/master/src/data/pokemon/evolution.h',
            'https://github.com/pret/pokeemerald/blob/master/src/data/wild_encounters.json'
        ]
    };

    fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), 'utf8');

    console.log(`Klaar! ${obtainablePokemon.length} verkrijgbare Emerald-Pokémon opgeslagen.`);
    console.log(`${unobtainableNames.length} niet-verkrijgbare Gen III-soorten apart geregistreerd (bijv. Nidoran-M).`);
}

main().catch(err => {
    console.error('Fout tijdens importeren:', err.message);
    process.exit(1);
});