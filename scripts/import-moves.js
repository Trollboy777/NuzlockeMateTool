const fs = require('fs');
const path = require('path');

const RAW_BASE = 'https://raw.githubusercontent.com/pret/pokeemerald/master';
const POKEMON_PATH = path.join(__dirname, '..', 'data', 'pokemon', 'emerald-pokemon.json');
const OUTPUT_PATH = path.join(__dirname, '..', 'data', 'pokemon', 'emerald-moves.json');

const NAME_OVERRIDES = {
    NIDORAN_F: 'Nidoran-F',
    NIDORAN_M: 'Nidoran-M',
    MR_MIME: 'Mr. Mime',
    HO_OH: 'Ho-Oh',
    FARFETCHD: "Farfetch'd"
};

const MOVE_OVERRIDES = {
    DOUBLE_EDGE: 'Double-Edge',
    SELF_DESTRUCT: 'Self-Destruct',
    SOFT_BOILED: 'Soft-Boiled',
    MUD_SLAP: 'Mud-Slap',
    LOCK_ON: 'Lock-On',
    WILL_O_WISP: 'Will-O-Wisp',
    SOLAR_BEAM: 'SolarBeam',
    SOLARBEAM: 'SolarBeam',
    THUNDER_PUNCH: 'ThunderPunch',
    THUNDERPUNCH: 'ThunderPunch',
    FIRE_PUNCH: 'Fire Punch',
    ICE_PUNCH: 'Ice Punch',
    DYNAMIC_PUNCH: 'DynamicPunch',
    DYNAMICPUNCH: 'DynamicPunch',
    ANCIENT_POWER: 'AncientPower',
    ANCIENTPOWER: 'AncientPower',
    EXTREME_SPEED: 'ExtremeSpeed',
    EXTREMESPEED: 'ExtremeSpeed',
    DRAGON_BREATH: 'DragonBreath',
    DRAGONBREATH: 'DragonBreath',
    BUBBLE_BEAM: 'BubbleBeam',
    BUBBLEBEAM: 'BubbleBeam',
    FAINT_ATTACK: 'Faint Attack',
    FEINT_ATTACK: 'Faint Attack',
    SMELLING_SALT: 'SmellingSalt',
    SMELLINGSALT: 'SmellingSalt',
    VICE_GRIP: 'ViceGrip',
    VICEGRIP: 'ViceGrip'
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

function formatMoveName(rawMove) {
    const clean = rawMove.replace(/^MOVE_/, '');
    if (MOVE_OVERRIDES[clean]) return MOVE_OVERRIDES[clean];

    return clean
        .toLowerCase()
        .split('_')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
}

// Haalt een gebalanceerd ( ... ) blok op vanaf de openingshaak
function extractParenBlock(text, openParenIndex) {
    let depth = 0;
    for (let i = openParenIndex; i < text.length; i++) {
        if (text[i] === '(') depth++;
        else if (text[i] === ')') {
            depth--;
            if (depth === 0) {
                return {
                    content: text.slice(openParenIndex + 1, i),
                    endIndex: i
                };
            }
        }
    }
    return null;
}

function parseLevelUpPointers(pointersText) {
    const map = new Map(); // speciesKey -> arraySymbolName
    const regex = /\[SPECIES_([A-Z0-9_]+)\]\s*=\s*(s[A-Za-z0-9_]+LevelUpLearnset)/g;
    let match;

    while ((match = regex.exec(pointersText)) !== null) {
        map.set(match[1], match[2]);
    }
    return map;
}

function parseLevelUpLearnsets(learnsetsText) {
    const arraysMap = new Map(); // arraySymbolName -> [{ level, move }]
    const blockRegex = /static\s+const\s+u16\s+(s[A-Za-z0-9_]+LevelUpLearnset)\s*\[\]\s*=\s*\{([\s\S]*?)\};/g;
    let match;

    while ((match = blockRegex.exec(learnsetsText)) !== null) {
        const symbol = match[1];
        const body = match[2];
        const moves = [];

        const moveRegex = /LEVEL_UP_MOVE\s*\(\s*(\d+)\s*,\s*MOVE_([A-Z0-9_]+)\s*\)/g;
        let moveMatch;
        while ((moveMatch = moveRegex.exec(body)) !== null) {
            moves.push({
                level: Number(moveMatch[1]),
                move: formatMoveName(moveMatch[2])
            });
        }

        arraysMap.set(symbol, moves);
    }

    return arraysMap;
}

const GEN3_TM_HM_LIST = [
    { machine: 'TM01', move: 'Focus Punch', keys: ['FOCUS_PUNCH'] },
    { machine: 'TM02', move: 'Dragon Claw', keys: ['DRAGON_CLAW'] },
    { machine: 'TM03', move: 'Water Pulse', keys: ['WATER_PULSE'] },
    { machine: 'TM04', move: 'Calm Mind', keys: ['CALM_MIND'] },
    { machine: 'TM05', move: 'Roar', keys: ['ROAR'] },
    { machine: 'TM06', move: 'Toxic', keys: ['TOXIC'] },
    { machine: 'TM07', move: 'Hail', keys: ['HAIL'] },
    { machine: 'TM08', move: 'Bulk Up', keys: ['BULK_UP'] },
    { machine: 'TM09', move: 'Bullet Seed', keys: ['BULLET_SEED'] },
    { machine: 'TM10', move: 'Hidden Power', keys: ['HIDDEN_POWER'] },
    { machine: 'TM11', move: 'Sunny Day', keys: ['SUNNY_DAY'] },
    { machine: 'TM12', move: 'Taunt', keys: ['TAUNT'] },
    { machine: 'TM13', move: 'Ice Beam', keys: ['ICE_BEAM'] },
    { machine: 'TM14', move: 'Blizzard', keys: ['BLIZZARD'] },
    { machine: 'TM15', move: 'Hyper Beam', keys: ['HYPER_BEAM'] },
    { machine: 'TM16', move: 'Light Screen', keys: ['LIGHT_SCREEN'] },
    { machine: 'TM17', move: 'Protect', keys: ['PROTECT'] },
    { machine: 'TM18', move: 'Rain Dance', keys: ['RAIN_DANCE'] },
    { machine: 'TM19', move: 'Giga Drain', keys: ['GIGA_DRAIN'] },
    { machine: 'TM20', move: 'Safeguard', keys: ['SAFEGUARD'] },
    { machine: 'TM21', move: 'Frustration', keys: ['FRUSTRATION'] },
    { machine: 'TM22', move: 'SolarBeam', keys: ['SOLAR_BEAM', 'SOLARBEAM'] },
    { machine: 'TM23', move: 'Iron Tail', keys: ['IRON_TAIL'] },
    { machine: 'TM24', move: 'Thunderbolt', keys: ['THUNDERBOLT'] },
    { machine: 'TM25', move: 'Thunder', keys: ['THUNDER'] },
    { machine: 'TM26', move: 'Earthquake', keys: ['EARTHQUAKE'] },
    { machine: 'TM27', move: 'Return', keys: ['RETURN'] },
    { machine: 'TM28', move: 'Dig', keys: ['DIG'] },
    { machine: 'TM29', move: 'Psychic', keys: ['PSYCHIC'] },
    { machine: 'TM30', move: 'Shadow Ball', keys: ['SHADOW_BALL'] },
    { machine: 'TM31', move: 'Brick Break', keys: ['BRICK_BREAK'] },
    { machine: 'TM32', move: 'Double Team', keys: ['DOUBLE_TEAM'] },
    { machine: 'TM33', move: 'Reflect', keys: ['REFLECT'] },
    { machine: 'TM34', move: 'Shock Wave', keys: ['SHOCK_WAVE'] },
    { machine: 'TM35', move: 'Flamethrower', keys: ['FLAMETHROWER'] },
    { machine: 'TM36', move: 'Sludge Bomb', keys: ['SLUDGE_BOMB'] },
    { machine: 'TM37', move: 'Sandstorm', keys: ['SANDSTORM'] },
    { machine: 'TM38', move: 'Fire Blast', keys: ['FIRE_BLAST'] },
    { machine: 'TM39', move: 'Rock Tomb', keys: ['ROCK_TOMB'] },
    { machine: 'TM40', move: 'Aerial Ace', keys: ['AERIAL_ACE'] },
    { machine: 'TM41', move: 'Torment', keys: ['TORMENT'] },
    { machine: 'TM42', move: 'Facade', keys: ['FACADE'] },
    { machine: 'TM43', move: 'Secret Power', keys: ['SECRET_POWER'] },
    { machine: 'TM44', move: 'Rest', keys: ['REST'] },
    { machine: 'TM45', move: 'Attract', keys: ['ATTRACT'] },
    { machine: 'TM46', move: 'Thief', keys: ['THIEF'] },
    { machine: 'TM47', move: 'Steel Wing', keys: ['STEEL_WING'] },
    { machine: 'TM48', move: 'Skill Swap', keys: ['SKILL_SWAP'] },
    { machine: 'TM49', move: 'Snatch', keys: ['SNATCH'] },
    { machine: 'TM50', move: 'Overheat', keys: ['OVERHEAT'] },
    { machine: 'HM01', move: 'Cut', keys: ['CUT'] },
    { machine: 'HM02', move: 'Fly', keys: ['FLY'] },
    { machine: 'HM03', move: 'Surf', keys: ['SURF'] },
    { machine: 'HM04', move: 'Strength', keys: ['STRENGTH'] },
    { machine: 'HM05', move: 'Flash', keys: ['FLASH'] },
    { machine: 'HM06', move: 'Rock Smash', keys: ['ROCK_SMASH'] },
    { machine: 'HM07', move: 'Waterfall', keys: ['WATERFALL'] },
    { machine: 'HM08', move: 'Dive', keys: ['DIVE'] }
];

function parseTmHmLearnsets(tmhmText) {
    const byMachine = new Map();
    const byMoveKey = new Map();

    for (const item of GEN3_TM_HM_LIST) {
        byMachine.set(item.machine, item);
        for (const key of item.keys) {
            byMoveKey.set(key, item);
        }
    }

    const map = new Map(); // speciesKey -> { tm: [], hm: [] }
    const entryRegex = /\[SPECIES_([A-Z0-9_]+)\]\s*=/g;
    const matches = [...tmhmText.matchAll(entryRegex)];

    for (let i = 0; i < matches.length; i++) {
        const speciesKey = matches[i][1];
        const start = matches[i].index + matches[i][0].length;
        const end = i + 1 < matches.length ? matches[i + 1].index : tmhmText.indexOf('};', start);
        const rawBody = tmhmText.slice(start, end === -1 ? tmhmText.length : end);
        const body = rawBody
            .replace(/\/\*[\s\S]*?\*\//g, '')
            .replace(/\/\/.*$/gm, '');

        const matchedMachines = new Set();
        const tokenRegex = /(-\s*)?(?<![A-Z0-9_])([A-Z0-9_]+)(?![A-Z0-9_])(\s*=\s*(?:FALSE|0)\b)?/g;
        let tokenMatch;

        while ((tokenMatch = tokenRegex.exec(body)) !== null) {
            if (tokenMatch[1] || tokenMatch[3]) continue;

            const token = tokenMatch[2];
            const machineCodeMatch = token.match(/^(?:ITEM_)?(TM\d{2}|HM\d{2})(?:_[A-Z0-9_]+)?$/);

            let found = null;
            if (machineCodeMatch) {
                found = byMachine.get(machineCodeMatch[1]);
            } else {
                const cleanMoveKey = token.replace(/^MOVE_/, '');
                found = byMoveKey.get(cleanMoveKey);
            }

            if (found) {
                matchedMachines.add(found.machine);
            }
        }

        const tm = [];
        const hm = [];

        for (const item of GEN3_TM_HM_LIST) {
            if (!matchedMachines.has(item.machine)) continue;
            if (item.machine.startsWith('TM')) {
                tm.push({ machine: item.machine, move: item.move });
            } else {
                hm.push({ machine: item.machine, move: item.move });
            }
        }

        map.set(speciesKey, { tm, hm });
    }

    return map;
}

async function fetchRequired(relativePath) {
    const url = `${RAW_BASE}/${relativePath}`;
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`HTTP ${res.status} bij ophalen van ${url}`);
    }
    return res.text();
}

async function main() {
    if (!fs.existsSync(POKEMON_PATH)) {
        throw new Error('Draai eerst scripts/import-pokemon.js zodat emerald-pokemon.json bestaat.');
    }

    const pokemonData = JSON.parse(fs.readFileSync(POKEMON_PATH, 'utf8'));
    const obtainableSet = new Set(pokemonData.pokemon.map(p => p.name));

    console.log('Learnset-bestanden ophalen uit pret/pokeemerald...');
    const [pointersText, levelUpText, tmhmText] = await Promise.all([
        fetchRequired('src/data/pokemon/level_up_learnset_pointers.h'),
        fetchRequired('src/data/pokemon/level_up_learnsets.h'),
        fetchRequired('src/data/pokemon/tmhm_learnsets.h')
    ]);

    const pointerMap = parseLevelUpPointers(pointersText);
    const levelUpArrays = parseLevelUpLearnsets(levelUpText);
    const tmhmMap = parseTmHmLearnsets(tmhmText);

    // Koppel speciesKey -> pokemonName voor alle 244 verkrijgbare soorten
    const keyByName = new Map();
    for (const speciesKey of pointerMap.keys()) {
        const name = formatSpeciesName(speciesKey);
        if (obtainableSet.has(name)) {
            keyByName.set(name, speciesKey);
        }
    }

    const moveLearnsets = [];

    for (const poke of pokemonData.pokemon) {
        const speciesKey = keyByName.get(poke.name);
        const symbol = speciesKey ? pointerMap.get(speciesKey) : null;
        const levelUp = symbol ? (levelUpArrays.get(symbol) || []) : [];
        const tmhm = speciesKey ? (tmhmMap.get(speciesKey) || { tm: [], hm: [] }) : { tm: [], hm: [] };

        moveLearnsets.push({
            pokemon: poke.name,
            level_up: levelUp,
            tm: tmhm.tm,
            hm: tmhm.hm,
            move_tutor: [],
            egg_moves: [],
            data_status: 'verified'
        });
    }

    const output = {
        game: 'Pokemon Emerald',
        generation: 3,
        data_scope: 'Verified Generation III level-up and TM/HM learnsets for all 244 obtainable Pokemon in Emerald. Move Tutor and Egg Moves are not yet included.',
        learnset_count: moveLearnsets.length,
        move_learnsets: moveLearnsets,
        sources: [
            'https://github.com/pret/pokeemerald/blob/master/src/data/pokemon/level_up_learnset_pointers.h',
            'https://github.com/pret/pokeemerald/blob/master/src/data/pokemon/level_up_learnsets.h',
            'https://github.com/pret/pokeemerald/blob/master/src/data/pokemon/tmhm_learnsets.h'
        ]
    };

    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), 'utf8');
    const withTmHm = moveLearnsets.filter(m => m.tm.length > 0 || m.hm.length > 0).length;
    console.log(`Klaar! ${moveLearnsets.length} learnset-records opgeslagen (${withTmHm} met TM/HM-moves) in ${OUTPUT_PATH}`);
}

main().catch(err => {
    console.error('Fout tijdens importeren van moves:', err.message);
    process.exit(1);
});