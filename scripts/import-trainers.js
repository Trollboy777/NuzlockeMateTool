const fs = require('fs');
const path = require('path');

const RAW_BASE = 'https://raw.githubusercontent.com/pret/pokeemerald/master';

const POKEMON_PATH = path.join(__dirname, '..', 'data', 'pokemon', 'emerald-pokemon.json');
const MOVES_PATH = path.join(__dirname, '..', 'data', 'pokemon', 'emerald-moves.json');
const GYMS_PATH = path.join(__dirname, '..', 'data', 'trainers', 'emerald-gyms.json');
const LEAGUE_PATH = path.join(__dirname, '..', 'data', 'trainers', 'emerald-pokemon-league.json');
const BOSSES_OUTPUT_PATH = path.join(__dirname, '..', 'data', 'trainers', 'emerald-boss-trainers.json');

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

function titleCaseFromConst(raw) {
    return raw
        .toLowerCase()
        .split('_')
        .filter(Boolean)
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
}

function formatSpeciesName(raw) {
    const clean = raw.replace(/^SPECIES_/, '');
    if (NAME_OVERRIDES[clean]) return NAME_OVERRIDES[clean];
    return titleCaseFromConst(clean);
}

function formatMoveName(rawMove) {
    const clean = rawMove.replace(/^MOVE_/, '');
    if (MOVE_OVERRIDES[clean]) return MOVE_OVERRIDES[clean];
    return titleCaseFromConst(clean);
}

function formatItemName(rawItem) {
    const clean = rawItem.replace(/^ITEM_/, '');
    if (!clean || clean === 'NONE') return null;
    return titleCaseFromConst(clean);
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

function splitTopLevelObjects(arrayContent) {
    const objects = [];
    let depth = 0;
    let start = -1;

    for (let i = 0; i < arrayContent.length; i++) {
        if (arrayContent[i] === '{') {
            if (depth === 0) start = i;
            depth++;
        } else if (arrayContent[i] === '}') {
            depth--;
            if (depth === 0 && start !== -1) {
                objects.push(arrayContent.slice(start + 1, i));
                start = -1;
            }
        }
    }

    return objects;
}

function getDefaultLevelUpMoves(speciesName, level, learnsetByPokemon) {
    const learnset = learnsetByPokemon.get(speciesName);
    if (!learnset || !Array.isArray(learnset.level_up)) return [];

    const learned = [];
    for (const entry of learnset.level_up) {
        if (entry.level <= level) {
            const existingIdx = learned.indexOf(entry.move);
            if (existingIdx !== -1) learned.splice(existingIdx, 1);
            learned.push(entry.move);
        }
    }

    return learned.slice(-4);
}

function parseTrainerParties(partiesText, typesByPokemon, learnsetByPokemon) {
    const partyMap = new Map(); // partySymbol -> array of mon objects
    const declRegex = /static\s+const\s+(?:struct\s+)?TrainerMon[A-Za-z0-9_]*\s+([A-Za-z0-9_]+)\s*\[\s*\]\s*=\s*\{/g;
    let match;

    while ((match = declRegex.exec(partiesText)) !== null) {
        const partySymbol = match[1];
        const openBrace = match.index + match[0].length - 1;
        const block = extractBraceBlock(partiesText, openBrace);
        if (!block) continue;

        const cleanContent = block.content
            .replace(/\/\*[\s\S]*?\*\//g, '')
            .replace(/\/\/.*$/gm, '');

        const monBlocks = splitTopLevelObjects(cleanContent);
        const mons = [];

        for (const monText of monBlocks) {
            const lvlMatch = monText.match(/\.lvl\s*=\s*(\d+)/);
            const speciesMatch = monText.match(/\.species\s*=\s*SPECIES_([A-Z0-9_]+)/);
            if (!lvlMatch || !speciesMatch) continue;

            const level = Number(lvlMatch[1]);
            const pokemon = formatSpeciesName(speciesMatch[1]);
            const type = typesByPokemon.get(pokemon) || [];

            const itemMatch = monText.match(/\.heldItem\s*=\s*ITEM_([A-Z0-9_]+)/);
            const heldItem = itemMatch ? formatItemName(itemMatch[1]) : null;

            const ivMacroMatch = monText.match(/\.iv\s*=\s*TRAINER_PARTY_IVS\s*\(([^)]+)\)/);
            const ivIntMatch = monText.match(/\.iv\s*=\s*(\d+)/);
            let calculatedIv = 0;

            if (ivMacroMatch) {
                const nums = ivMacroMatch[1].split(',').map(n => Number(n.trim())).filter(n => !Number.isNaN(n));
                calculatedIv = nums.length > 0 ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length) : 0;
            } else if (ivIntMatch) {
                calculatedIv = Math.floor((Number(ivIntMatch[1]) * 31) / 255);
            }

            const movesMatch = monText.match(/\.moves\s*=\s*\{([^}]*)\}/);
            let moves = [];
            let moveSource = 'default_level_up';

            if (movesMatch) {
                moveSource = 'custom';
                const moveTokens = movesMatch[1].match(/MOVE_([A-Z0-9_]+)/g) || [];
                moves = moveTokens
                    .map(tok => tok.replace(/^MOVE_/, ''))
                    .filter(m => m !== 'NONE')
                    .map(formatMoveName);
            } else {
                moves = getDefaultLevelUpMoves(pokemon, level, learnsetByPokemon);
            }

            mons.push({
                pokemon,
                level,
                type,
                held_item: heldItem,
                iv: calculatedIv,
                moves,
                move_source: moveSource
            });
        }

        partyMap.set(partySymbol, mons);
    }

    return partyMap;
}

function parseTrainers(trainersText, partyMap) {
    const trainers = new Map(); // trainerKey (e.g. ROXANNE_1) -> trainer object
    const entryRegex = /\[TRAINER_([A-Z0-9_]+)\]\s*=\s*\{/g;
    let match;

    while ((match = entryRegex.exec(trainersText)) !== null) {
        const key = match[1];
        const openBrace = match.index + match[0].length - 1;
        const block = extractBraceBlock(trainersText, openBrace);
        if (!block) continue;

        const body = block.content
            .replace(/\/\*[\s\S]*?\*\//g, '')
            .replace(/\/\/.*$/gm, '');

        const nameMatch = body.match(/\.trainerName\s*=\s*_\("([^"]*)"\)/);
        const classMatch = body.match(/\.trainerClass\s*=\s*TRAINER_CLASS_([A-Z0-9_]+)/);
        const doubleMatch = body.match(/\.doubleBattle\s*=\s*(TRUE|FALSE)/);
        const itemsMatch = body.match(/\.items\s*=\s*\{([^}]*)\}/);
        const aiMatch = body.match(/\.aiFlags\s*=\s*([^,\n]+)/);
        const partyMatch = body.match(
            /\.party\s*=\s*[A-Z0-9_]+\s*\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*\)/
        );

        const partySymbol = partyMatch ? partyMatch[1] : null;
        const team = partySymbol ? (partyMap.get(partySymbol) || []) : [];

        const rawItems = itemsMatch ? (itemsMatch[1].match(/ITEM_([A-Z0-9_]+)/g) || []) : [];
        const trainerItems = rawItems
            .map(formatItemName)
            .filter(Boolean);

        const aiFlags = aiMatch
            ? aiMatch[1]
                .split('|')
                .map(s => s.trim().replace(/^AI_SCRIPT_/, ''))
                .filter(s => s && s !== '0')
            : [];

        trainers.set(key, {
            id: `TRAINER_${key}`,
            key,
            name: nameMatch ? titleCaseFromConst(nameMatch[1].replace(/\s+/g, '_')) : titleCaseFromConst(key),
            trainer_class: classMatch ? titleCaseFromConst(classMatch[1]) : 'Unknown',
            double_battle: doubleMatch ? doubleMatch[1] === 'TRUE' : false,
            trainer_items: trainerItems,
            ai_flags: aiFlags,
            team
        });
    }

    return trainers;
}

const GYM_TRAINER_KEYS = {
    1: 'ROXANNE_1',
    2: 'BRAWLY_1',
    3: 'WATTSON_1',
    4: 'FLANNERY_1',
    5: 'NORMAN_1',
    6: 'WINONA_1',
    7: 'TATE_AND_LIZA_1',
    8: 'JUAN_1'
};

const LEAGUE_TRAINER_KEYS = {
    Sidney: 'SIDNEY',
    Phoebe: 'PHOEBE',
    Glacia: 'GLACIA',
    Drake: 'DRAKE',
    Wallace: 'WALLACE'
};

const BOSS_METADATA = [
    { prefix: 'MAXIE_', group: 'Team Magma', role: 'Magma Leader' },
    { prefix: 'TABITHA_', group: 'Team Magma', role: 'Magma Admin' },
    { prefix: 'ARCHIE', group: 'Team Aqua', role: 'Aqua Leader' },
    { prefix: 'MATT', group: 'Team Aqua', role: 'Aqua Admin' },
    { prefix: 'SHELLY_', group: 'Team Aqua', role: 'Aqua Admin' },
    { prefix: 'WALLY_', group: 'Rival', role: 'Rival' },
    { prefix: 'MAY_', group: 'Rival', role: 'Rival (May)' },
    { prefix: 'BRENDAN_', group: 'Rival', role: 'Rival (Brendan)' }
];

function classifyBossTrainer(key) {
    // Sla post-game Match Call rematches (_2 t/m _5) over
    if (/_[2345]$/.test(key)) return null;

    for (const meta of BOSS_METADATA) {
        if (key === meta.prefix || key.startsWith(meta.prefix)) {
            return meta;
        }
    }
    return null;
}

function formatBattleLocation(key) {
    const clean = key
        .replace(/^(MAXIE|TABITHA|ARCHIE|MATT|SHELLY|WALLY|MAY|BRENDAN)_?/, '')
        .replace(/_(MUDKIP|TORCHIC|TREECKO)$/, '')
        .replace(/_1$/, '');

    if (!clean) return 'Main Story';
    if (clean === 'VR') return 'Victory Road';
    return titleCaseFromConst(clean);
}

function extractStarterVariant(key) {
    const match = key.match(/_(MUDKIP|TORCHIC|TREECKO)$/);
    return match ? titleCaseFromConst(match[1]) : null;
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
    const pokemonData = JSON.parse(fs.readFileSync(POKEMON_PATH, 'utf8'));
    const movesData = JSON.parse(fs.readFileSync(MOVES_PATH, 'utf8'));

    const typesByPokemon = new Map(pokemonData.pokemon.map(p => [p.name, p.types]));
    const learnsetByPokemon = new Map(movesData.move_learnsets.map(m => [m.pokemon, m]));

    console.log('Trainer-bestanden ophalen uit pret/pokeemerald...');
    const [trainersText, partiesText] = await Promise.all([
        fetchRequired('src/data/trainers.h'),
        fetchRequired('src/data/trainer_parties.h')
    ]);

    const partyMap = parseTrainerParties(partiesText, typesByPokemon, learnsetByPokemon);
    const trainersMap = parseTrainers(trainersText, partyMap);

    console.log('\n--- TRAINER IMPORT DIAGNOSTICS ---');

    console.log('Party arrays:', partyMap.size);
    console.log('Trainers:', trainersMap.size);

    console.log(
        'Gym/League trainer IDs:',
        [...trainersMap.keys()].filter(key =>
            /ROXANNE|BRAWLY|WATTSON|FLANNERY|NORMAN|WINONA|TATE|LIZA|JUAN|SIDNEY|PHOEBE|GLACIA|DRAKE|WALLACE/i.test(key)
        )
    );

    console.log(
        'Example party:',
        partyMap.get('sParty_LeaderRoxanne')
    );

    console.log(
        'Example trainer:',
        [...trainersMap.entries()].find(([key]) => /ROXANNE/i.test(key))
    );

    console.log(`- ${partyMap.size} trainer-parties en ${trainersMap.size} trainers ingelezen`);

    // 1. Verrijk emerald-gyms.json
    const gymsData = JSON.parse(fs.readFileSync(GYMS_PATH, 'utf8'));
    gymsData.gyms = gymsData.gyms.map(gym => {
        const key = GYM_TRAINER_KEYS[gym.number];
        const parsed = key ? trainersMap.get(key) : null;
        if (!parsed || parsed.team.length === 0) return gym;

        return {
            ...gym,
            trainer_id: parsed.id,
            trainer_items: parsed.trainer_items,
            ai_flags: parsed.ai_flags,
            team: parsed.team
        };
    });
    fs.writeFileSync(GYMS_PATH, JSON.stringify(gymsData, null, 2), 'utf8');

    // 2. Verrijk emerald-pokemon-league.json
    const leagueData = JSON.parse(fs.readFileSync(LEAGUE_PATH, 'utf8'));
    leagueData.elite_four = (leagueData.elite_four || []).map(member => {
        const key = LEAGUE_TRAINER_KEYS[member.name];
        const parsed = key ? trainersMap.get(key) : null;
        if (!parsed || parsed.team.length === 0) return member;

        return {
            ...member,
            trainer_id: parsed.id,
            trainer_items: parsed.trainer_items,
            ai_flags: parsed.ai_flags,
            team: parsed.team
        };
    });

    if (leagueData.champion) {
        const champKey = LEAGUE_TRAINER_KEYS[leagueData.champion.name];
        const parsedChamp = champKey ? trainersMap.get(champKey) : null;
        if (parsedChamp && parsedChamp.team.length > 0) {
            leagueData.champion = {
                ...leagueData.champion,
                trainer_id: parsedChamp.id,
                trainer_items: parsedChamp.trainer_items,
                ai_flags: parsedChamp.ai_flags,
                team: parsedChamp.team
            };
        }
    }
    fs.writeFileSync(LEAGUE_PATH, JSON.stringify(leagueData, null, 2), 'utf8');

    // 3. Genereer emerald-boss-trainers.json (Team Magma, Team Aqua, Wally, Rival)
    const bosses = [];
    for (const [key, trainer] of trainersMap.entries()) {
        const meta = classifyBossTrainer(key);
        if (!meta || trainer.team.length === 0) continue;

        const highestLevel = Math.max(...trainer.team.map(m => m.level));
        const starterVariant = extractStarterVariant(key);

        bosses.push({
            id: trainer.id,
            key,
            name: trainer.name,
            group: meta.group,
            role: meta.role,
            battle_context: formatBattleLocation(key),
            player_starter_variant: starterVariant,
            battle_format: trainer.double_battle ? 'Double' : 'Single',
            highest_level: highestLevel,
            trainer_items: trainer.trainer_items,
            ai_flags: trainer.ai_flags,
            team: trainer.team
        });
    }

    const bossOutput = {
        game: 'Pokemon Emerald',
        generation: 3,
        data_scope: 'Main-story boss battles (Team Magma, Team Aqua, Wally, Rival May/Brendan) with full Generation III teams, movesets, held items and IVs.',
        boss_count: bosses.length,
        boss_trainers: bosses,
        sources: [
            'https://github.com/pret/pokeemerald/blob/master/src/data/trainers.h',
            'https://github.com/pret/pokeemerald/blob/master/src/data/trainer_parties.h'
        ]
    };

    fs.writeFileSync(BOSSES_OUTPUT_PATH, JSON.stringify(bossOutput, null, 2), 'utf8');

    console.log('Klaar!');
    console.log(`- Gym Leaders bijgewerkt met movesets & items in ${GYMS_PATH}`);
    console.log(`- Elite Four & Champion bijgewerkt met movesets & items in ${LEAGUE_PATH}`);
    console.log(`- ${bosses.length} Boss Battles opgeslagen in ${BOSSES_OUTPUT_PATH}`);
}

main().catch(err => {
    console.error('Fout tijdens importeren van trainers:', err.message);
    process.exit(1);
});