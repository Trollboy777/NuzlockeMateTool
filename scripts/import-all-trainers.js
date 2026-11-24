const fs = require('fs');
const path = require('path');

const REPO_RAW = 'https://raw.githubusercontent.com/pret/pokeemerald/master';
const REPO_TREE = 'https://api.github.com/repos/pret/pokeemerald/git/trees/master?recursive=1';

const ROOT_DIR = path.join(__dirname, '..');
const OUTPUT_PATH = path.join(ROOT_DIR, 'data', 'trainers', 'emerald-trainers.json');

// Bestaande kennisbankbestanden inladen om dubbelingen en types/moves te koppelen
const gymsData = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'data', 'trainers', 'emerald-gyms.json'), 'utf8'));
const leagueData = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'data', 'trainers', 'emerald-pokemon-league.json'), 'utf8'));
const bossData = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'data', 'trainers', 'emerald-boss-trainers.json'), 'utf8'));
const pokemonData = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'data', 'pokemon', 'emerald-pokemon.json'), 'utf8'));
const movesData = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'data', 'pokemon', 'emerald-moves.json'), 'utf8'));

function normalizeKey(str) {
    return String(str)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
}

function toTitleCase(str) {
    return str
        .toLowerCase()
        .replace(/(^|[\s.-])([a-z])/g, (_, sep, ch) => sep + ch.toUpperCase());
}

// Bouw lookup-tabellen voor Pokémon-types en default level-up moves
const pokemonTypesMap = new Map();
(pokemonData.pokemon || []).forEach(p => {
    pokemonTypesMap.set(normalizeKey(p.name), p.types || []);
});

const EXTRA_TYPES = {
    meditite: ['Fighting', 'Psychic'],
    medicham: ['Fighting', 'Psychic'],
    lunatone: ['Rock', 'Psychic'],
    roselia: ['Grass', 'Poison'],
    milotic: ['Water'],
    zangoose: ['Normal'],
    surskit: ['Bug', 'Water'],
    masquerain: ['Bug', 'Flying']
};

const learnsetsMap = new Map();
(movesData.move_learnsets || []).forEach(entry => {
    learnsetsMap.set(normalizeKey(entry.pokemon), entry.level_up || []);
});

// Verzamel alle trainer-keys die al in gyms, league of boss_trainers zitten
const excludedKeys = new Set(['NONE']);
(bossData.boss_trainers || []).forEach(b => {
    if (b.key) excludedKeys.add(b.key.toUpperCase());
});
(gymsData.gyms || []).forEach(g => {
    const leaderKey = g.leader.toUpperCase().replace(/[^A-Z0-9]+/g, '_');
    for (let i = 1; i <= 5; i++) {
        excludedKeys.add(`${leaderKey}_${i}`);
    }
    excludedKeys.add(leaderKey);
    excludedKeys.add('TATE_AND_LIZA_1');
    excludedKeys.add('TATE_AND_LIZA_2');
    excludedKeys.add('TATE_AND_LIZA_3');
    excludedKeys.add('TATE_AND_LIZA_4');
    excludedKeys.add('TATE_AND_LIZA_5');
});
(leagueData.elite_four || []).forEach(e => excludedKeys.add(e.name.toUpperCase()));
if (leagueData.champion) excludedKeys.add(leagueData.champion.name.toUpperCase());

async function fetchText(relativePath) {
    const res = await fetch(`${REPO_RAW}/${relativePath}`);
    if (!res.ok) throw new Error(`Kon ${relativePath} niet ophalen (${res.status})`);
    return res.text();
}

// Haalt een gebalanceerd { ... } blok op vanaf de openingsaccolade
function extractBraceBlock(text, openBraceIndex) {
    let depth = 0;
    for (let i = openBraceIndex; i < text.length; i++) {
        if (text[i] === '{') depth++;
        else if (text[i] === '}') {
            depth--;
            if (depth === 0) return text.slice(openBraceIndex + 1, i);
        }
    }
    return '';
}

function parseNameTable(headerText, prefix) {
    const map = new Map();
    const regex = new RegExp(`\\[(${prefix}[A-Z0-9_]+)\\]\\s*=\\s*(?:\\{[\\s\\S]*?\\.name\\s*=\\s*)?_\\("([^"]+)"\\)`, 'g');
    let match;
    while ((match = regex.exec(headerText)) !== null) {
        map.set(match[1], match[2]);
    }
    return map;
}

const SPECIES_OVERRIDES = {
    SPECIES_MR_MIME: 'Mr. Mime',
    SPECIES_NIDORAN_F: 'Nidoran-F',
    SPECIES_NIDORAN_M: 'Nidoran-M',
    SPECIES_HO_OH: 'Ho-Oh',
    SPECIES_FARFETCHD: "Farfetch'd"
};

function formatSpeciesName(speciesConst) {
    if (SPECIES_OVERRIDES[speciesConst]) return SPECIES_OVERRIDES[speciesConst];
    const raw = speciesConst.replace(/^SPECIES_/, '').replace(/_/g, ' ');
    return toTitleCase(raw);
}

function getDefaultLevelUpMoves(speciesName, level) {
    const levelUp = learnsetsMap.get(normalizeKey(speciesName)) || [];
    const learned = levelUp.filter(m => m.level <= level);
    const active = [];

    for (const entry of learned) {
        if (!active.includes(entry.move)) {
            if (active.length >= 4) active.shift();
            active.push(entry.move);
        }
    }
    return active;
}

function formatMapFolderToLocation(folderName) {
    // Bijv. RustboroCity_Gym -> "Rustboro City - Gym", WeatherInstitute_2F -> "Weather Institute (2F)"
    const segments = folderName.split('_');
    const formattedSegments = segments.map(seg =>
        seg
            .replace(/^Mt([A-Z])/, 'Mt. $1')
            .replace(/([a-z])([A-Z0-9])/g, '$1 $2')
            .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    );

    if (formattedSegments.length === 1) {
        return formattedSegments[0];
    }

    const last = formattedSegments[formattedSegments.length - 1];
    if (/^(B?\d+F|Exterior|Interior|Room\s*\d+|Summit|Peak|Entrance|Underwater)$/i.test(last)) {
        const main = formattedSegments.slice(0, -1).join(' - ');
        return `${main} (${last})`;
    }

    return formattedSegments.join(' - ');
}

function parseParties(partiesHeader, movesMap, itemsMap) {
    const parties = new Map();
    const declRegex = /static const struct\s+\w+\s+(sParty_[A-Za-z0-9_]+)\[\]\s*=\s*\{/g;
    let match;

    while ((match = declRegex.exec(partiesHeader)) !== null) {
        const partyName = match[1];
        const openIndex = partiesHeader.indexOf('{', match.index);
        const body = extractBraceBlock(partiesHeader, openIndex);

        const mons = [];
        let pos = 0;
        while (pos < body.length) {
            const monOpen = body.indexOf('{', pos);
            if (monOpen === -1) break;
            const monBody = extractBraceBlock(body, monOpen);
            pos = monOpen + monBody.length + 2;

            const ivMatch = monBody.match(/\.iv\s*=\s*(\d+)/);
            const lvlMatch = monBody.match(/\.lvl\s*=\s*(\d+)/);
            const speciesMatch = monBody.match(/\.species\s*=\s*(SPECIES_[A-Z0-9_]+)/);
            if (!lvlMatch || !speciesMatch) continue;

            const species = formatSpeciesName(speciesMatch[1]);
            const level = Number(lvlMatch[1]);
            const iv = ivMatch ? Number(ivMatch[1]) : 0;

            const itemMatch = monBody.match(/\.heldItem\s*=\s*(ITEM_[A-Z0-9_]+)/);
            let heldItem = null;
            if (itemMatch && itemMatch[1] !== 'ITEM_NONE') {
                const rawItem = itemsMap.get(itemMatch[1]) || itemMatch[1].replace(/^ITEM_/, '').replace(/_/g, ' ');
                heldItem = toTitleCase(rawItem);
            }

            const movesMatch = monBody.match(/\.moves\s*=\s*\{([^}]*)\}/);
            let moves = [];
            let movesSource = 'default_level_up';

            if (movesMatch) {
                movesSource = 'custom';
                moves = movesMatch[1]
                    .split(',')
                    .map(m => m.trim())
                    .filter(m => m && m !== 'MOVE_NONE')
                    .map(m => movesMap.get(m) || toTitleCase(m.replace(/^MOVE_/, '').replace(/_/g, ' ')));
            } else {
                moves = getDefaultLevelUpMoves(species, level);
            }

            const normSpecies = normalizeKey(species);
            const types = pokemonTypesMap.get(normSpecies) || EXTRA_TYPES[normSpecies] || [];

            mons.push({
                pokemon: species,
                level,
                type: types,
                held_item: heldItem,
                iv,
                moves,
                moves_source: movesSource
            });
        }

        parties.set(partyName, mons);
    }

    return parties;
}

function parseTrainers(trainersHeader, classMap, itemsMap, partiesMap) {
    const trainers = [];
    const entryRegex = /\[(TRAINER_[A-Z0-9_]+)\]\s*=\s*\{/g;
    let match;

    while ((match = entryRegex.exec(trainersHeader)) !== null) {
        const fullConst = match[1];
        const key = fullConst.replace(/^TRAINER_/, '');
        if (excludedKeys.has(key) || key.endsWith('_PLACEHOLDER')) continue;

        const openIndex = trainersHeader.indexOf('{', match.index);
        const body = extractBraceBlock(trainersHeader, openIndex);

        const classMatch = body.match(/\.trainerClass\s*=\s*(TRAINER_CLASS_[A-Z0-9_]+)/);
        const nameMatch = body.match(/\.trainerName\s*=\s*_\("([^"]*)"\)/);
        const doubleMatch = body.match(/\.doubleBattle\s*=\s*(TRUE|FALSE)/);
        const partyMatch = body.match(
            /\.party\s*=\s*[A-Z0-9_]+\s*\(\s*(sParty_[A-Za-z0-9_]+)\s*\)/
        );
        const itemsMatch = body.match(/\.items\s*=\s*\{([^}]*)\}/);

        if (!partyMatch) continue;
        const team = partiesMap.get(partyMatch[1]) || [];
        if (team.length === 0) continue;

        const rawClass = classMatch ? (classMap.get(classMatch[1]) || classMatch[1].replace(/^TRAINER_CLASS_/, '').replace(/_/g, ' ')) : 'Trainer';
        const trainerClass = toTitleCase(rawClass);
        const rawName = nameMatch ? nameMatch[1].trim() : '';
        const name = rawName ? toTitleCase(rawName) : trainerClass;

        const trainerItems = itemsMatch
            ? itemsMatch[1]
                .split(',')
                .map(i => i.trim())
                .filter(i => i && i !== 'ITEM_NONE')
                .map(i => toTitleCase(itemsMap.get(i) || i.replace(/^ITEM_/, '').replace(/_/g, ' ')))
            : [];

        const rematchMatch = key.match(/^(.+)_([2-5])$/);
        const rematchStage = rematchMatch ? Number(rematchMatch[2]) : 1;
        const baseKey = rematchMatch ? rematchMatch[1] : key.replace(/_1$/, '');

        let category = 'regular';
        if (trainerClass.toLowerCase().includes('team aqua') || trainerClass.toLowerCase().includes('team magma')) {
            category = 'evil_team_grunt';
        } else if (rematchStage > 1) {
            category = 'rematch';
        }

        trainers.push({
            key,
            base_key: baseKey,
            rematch_stage: rematchStage,
            category,
            trainer_class: trainerClass,
            name,
            full_name: normalizeKey(name) === normalizeKey(trainerClass) ? trainerClass : `${trainerClass} ${name}`,
            location: null,
            battle_format: doubleMatch && doubleMatch[1] === 'TRUE' ? 'double' : 'single',
            highest_level: Math.max(...team.map(m => m.level)),
            trainer_items: trainerItems,
            team
        });
    }

    return trainers;
}

async function fetchMapLocations() {
    console.log('Map-scripts ophalen uit pret/pokeemerald om trainerlocaties te bepalen...');
    const treeRes = await fetch(REPO_TREE);
    if (!treeRes.ok) throw new Error(`GitHub tree API fout: ${treeRes.status}`);
    const treeData = await treeRes.json();

    const scriptFiles = (treeData.tree || [])
        .map(item => item.path)
        .filter(p => /^data\/maps\/[^/]+\/scripts\.inc$/.test(p));

    const trainerToLocations = new Map();
    const BATCH_SIZE = 25;

    for (let i = 0; i < scriptFiles.length; i += BATCH_SIZE) {
        const batch = scriptFiles.slice(i, i + BATCH_SIZE);
        await Promise.all(
            batch.map(async filePath => {
                const folderName = filePath.split('/')[2];
                const locationName = formatMapFolderToLocation(folderName);
                const content = await fetchText(filePath);

                const battleRegex = /trainerbattle[a-z0-9_]*\s+(TRAINER_[A-Z0-9_]+)/g;
                let m;
                while ((m = battleRegex.exec(content)) !== null) {
                    const key = m[1].replace(/^TRAINER_/, '');
                    if (!trainerToLocations.has(key)) {
                        trainerToLocations.set(key, new Set());
                    }
                    trainerToLocations.get(key).add(locationName);
                }
            })
        );
    }

    return trainerToLocations;
}

async function main() {
    console.log('Trainer-, party-, item-, class- en move-tabellen ophalen...');
    const [trainersH, partiesH, classNamesH, itemsH, moveNamesH] = await Promise.all([
        fetchText('src/data/trainers.h'),
        fetchText('src/data/trainer_parties.h'),
        fetchText('src/data/text/trainer_class_names.h'),
        fetchText('src/data/items.h'),
        fetchText('src/data/text/move_names.h')
    ]);

    const classMap = parseNameTable(classNamesH, 'TRAINER_CLASS_');
    const itemsMap = parseNameTable(itemsH, 'ITEM_');
    const movesMap = parseNameTable(moveNamesH, 'MOVE_');
    const partiesMap = parseParties(partiesH, movesMap, itemsMap);

    const trainers = parseTrainers(trainersH, classMap, itemsMap, partiesMap);
    const locationMap = await fetchMapLocations();

    // Koppel locaties aan trainers (inclusief rematch-stages _2.._5 via base_key)
    for (const trainer of trainers) {
        const directLocs = locationMap.get(trainer.key);
        const baseLocs = locationMap.get(`${trainer.base_key}_1`) || locationMap.get(trainer.base_key);
        const locs = directLocs || baseLocs;

        if (locs && locs.size > 0) {
            trainer.location = [...locs].join(' / ');
            if (trainer.location.includes(' - Gym') && trainer.category === 'regular') {
                trainer.category = 'gym_trainer';
            }
        } else {
            trainer.location = 'Unknown / Special';
        }
    }

    const output = {
        game: 'Pokemon Emerald',
        generation: 3,
        total_trainers: trainers.length,
        trainers
    };

    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), 'utf8');
    console.log(`Klaar! ${trainers.length} reguliere trainers opgeslagen in ${OUTPUT_PATH}`);
}

main().catch(err => {
    console.error('Import mislukt:', err);
    process.exit(1);
});