const fs = require('fs');
const path = require('path');

const CSV_BASE = 'https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv';

const MOVES_OUT = path.join(__dirname, '..', 'data', 'pokemon', 'emerald-move-details.json');
const EV_YIELDS_OUT = path.join(__dirname, '..', 'data', 'pokemon', 'emerald-ev-yields.json');
const ITEMS_OUT = path.join(__dirname, '..', 'data', 'items', 'emerald-items.json');

// RFC-4180 CSV parser zodat komma's en regeleindes binnen aanhalingstekens goed blijven
function parseCsv(text) {
    const rows = [];
    let row = [];
    let field = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        const next = text[i + 1];

        if (inQuotes) {
            if (ch === '"' && next === '"') {
                field += '"';
                i++;
            } else if (ch === '"') {
                inQuotes = false;
            } else {
                field += ch;
            }
        } else if (ch === '"') {
            inQuotes = true;
        } else if (ch === ',') {
            row.push(field);
            field = '';
        } else if (ch === '\r' && next === '\n') {
            row.push(field);
            rows.push(row);
            row = [];
            field = '';
            i++;
        } else if (ch === '\n' || ch === '\r') {
            row.push(field);
            rows.push(row);
            row = [];
            field = '';
        } else {
            field += ch;
        }
    }

    if (field.length > 0 || row.length > 0) {
        row.push(field);
        rows.push(row);
    }

    if (rows.length < 2) return [];
    const headers = rows[0];
    return rows.slice(1).map(cols => {
        const obj = {};
        headers.forEach((h, idx) => {
            obj[h] = cols[idx] ?? '';
        });
        return obj;
    });
}

async function fetchCsv(filename) {
    const res = await fetch(`${CSV_BASE}/${filename}`);
    if (!res.ok) {
        throw new Error(`Kon ${filename} niet ophalen (HTTP ${res.status})`);
    }
    return parseCsv(await res.text());
}

function cleanProse(text, effectChance) {
    if (!text) return '';
    return text
        .replace(/\$effect_chance/g, effectChance || '')
        .replace(/\[([^\]]+)\]\{[^}]+\}/g, '$1')
        .replace(/\{\w+:([^}]+)\}/g, '$1')
        .replace(/\s+/g, ' ')
        .trim();
}

function formatName(identifier) {
    return identifier
        .split('-')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
}

// Generation III type-ID -> naam & Physical/Special-categorie
const TYPE_MAP = {
    1: { name: 'Normal', category: 'Physical' },
    2: { name: 'Fighting', category: 'Physical' },
    3: { name: 'Flying', category: 'Physical' },
    4: { name: 'Poison', category: 'Physical' },
    5: { name: 'Ground', category: 'Physical' },
    6: { name: 'Rock', category: 'Physical' },
    7: { name: 'Bug', category: 'Physical' },
    8: { name: 'Ghost', category: 'Physical' },
    9: { name: 'Steel', category: 'Physical' },
    10: { name: 'Fire', category: 'Special' },
    11: { name: 'Water', category: 'Special' },
    12: { name: 'Grass', category: 'Special' },
    13: { name: 'Electric', category: 'Special' },
    14: { name: 'Psychic', category: 'Special' },
    15: { name: 'Ice', category: 'Special' },
    16: { name: 'Dragon', category: 'Special' },
    17: { name: 'Dark', category: 'Special' }
};

// Belangrijkste in-game vindplaatsen in Pokemon Emerald voor items & TMs/HMs
const EMERALD_ITEM_LOCATIONS = {
    'leftovers': 'S.S. Tidal (trash can in basement) and Battle Frontier (48 BP).',
    'choice-band': 'Battle Frontier (64 BP).',
    'scope-lens': 'Battle Frontier (64 BP).',
    'bright-powder': 'Battle Frontier (64 BP).',
    'focus-band': 'Shoal Cave (basement) and Battle Frontier (64 BP).',
    'quick-claw': 'Rustboro City (Trainer School, given by teacher).',
    'kings-rock': 'Mossdeep City (boy near space center) and held by wild Hariyama/Makuhita (5%).',
    'macho-brace': 'Route 111 (Winstrate Family house, after defeating all 4 trainers).',
    'exp-share': 'Rustboro City (Devon Corp President, after delivering letter to Steven).',
    'amulet-coin': 'Littleroot Town (from Mom after defeating Norman, 5th Gym).',
    'soothe-bell': 'Slateport City (Pokemon Fan Club, if lead Pokemon has high friendship).',
    'shell-bell': 'Shoal Cave (collect 4 Shoal Salts + 4 Shoal Shells for the old man).',
    'silk-scarf': 'Dewford Town (house near gym).',
    'charcoal': 'Lavaridge Town (Herb Shop).',
    'mystic-water': 'Held by wild Castform (gift at Weather Institute).',
    'miracle-seed': 'Petalburg Woods (woman near northern exit).',
    'magnet': 'Trick House (Puzzle 3 reward).',
    'never-melt-ice': 'Shoal Cave (low-tide ice room).',
    'black-belt': 'Route 115 (defeat Black Belt Nob in rematches / held by wild Machoke 5%).',
    'poison-barb': 'Held by wild Cacnea / Roselia (5%).',
    'soft-sand': 'Slateport City (beach girl) and held by wild Trapinch (5%).',
    'sharp-beak': 'Held by wild Doduo / Dodrio (5%).',
    'twisted-spoon': 'Held by wild Abra / Kadabra (5%).',
    'silver-powder': 'Held by wild Dustox / Masquerain (5%).',
    'hard-stone': 'Trick House (Puzzle 2 reward) and held by wild Aron / Graveler (5%).',
    'spell-tag': 'Mt. Pyre (summit) and held by wild Shuppet / Duskull (5%).',
    'dragon-fang': 'Meteor Falls (Dragon Tamer Nicolas rematch) and held by wild Bagon (5%).',
    'black-glasses': 'Route 116 (tunnel entrance, man looking for glasses) and held by wild Poochyena (5%).',
    'metal-coat': 'New Mauville (hidden/item ball) and held by wild Magnemite (5%).',
    'light-ball': 'Held by wild Pikachu in Safari Zone (5%).',
    'thick-club': 'Not obtainable in-game in Emerald (Cubone/Marowak require trading).',
    'deep-sea-tooth': 'Slateport City (Capt. Stern, trade Scanner from Abandoned Ship).',
    'deep-sea-scale': 'Slateport City (Capt. Stern, trade Scanner from Abandoned Ship).',
    'fire-stone': 'Fiery Path (requires Strength) and trade Red Shard at Route 124 Treasure Hunter.',
    'water-stone': 'Abandoned Ship (diving area) and trade Blue Shard at Route 124 Treasure Hunter.',
    'thunder-stone': 'New Mauville and trade Yellow Shard at Route 124 Treasure Hunter.',
    'leaf-stone': 'Route 119 (requires Surf) and trade Green Shard at Route 124 Treasure Hunter.',
    'moon-stone': 'Meteor Falls and held by wild Lunatone (5%).',
    'sun-stone': 'Mossdeep City (Space Center) and held by wild Solrock (5%).',
    'tm01': 'TM01 Focus Punch: Route 115 (requires Surf).',
    'tm02': 'TM02 Dragon Claw: Meteor Falls (back room, requires Waterfall).',
    'tm03': 'TM03 Water Pulse: Reward from Gym Leader Juan (8th Gym).',
    'tm04': 'TM04 Calm Mind: Reward from Gym Leaders Tate & Liza (7th Gym).',
    'tm05': 'TM05 Roar: Route 114 (man with Poochyena).',
    'tm06': 'TM06 Toxic: Fiery Path (requires Strength).',
    'tm07': 'TM07 Hail: Shoal Cave (ice room).',
    'tm08': 'TM08 Bulk Up: Reward from Gym Leader Brawly (2nd Gym).',
    'tm09': 'TM09 Bullet Seed: Route 104 (boy near Petalburg Woods).',
    'tm10': 'TM10 Hidden Power: Fortree City (old woman quiz) & Slateport Market.',
    'tm11': 'TM11 Sunny Day: Scorched Slab (Route 120 cave).',
    'tm12': 'TM12 Taunt: Trick House (Puzzle 5).',
    'tm13': 'TM13 Ice Beam: Abandoned Ship (Storage Room) & Mauville Game Corner (4000 coins).',
    'tm14': 'TM14 Blizzard: Lilycove Dept. Store (4F, $5500).',
    'tm15': 'TM15 Hyper Beam: Lilycove Dept. Store (4F, $7500).',
    'tm16': 'TM16 Light Screen: Lilycove Dept. Store (4F, $3000).',
    'tm17': 'TM17 Protect: Lilycove Dept. Store (4F, $3000).',
    'tm18': 'TM18 Rain Dance: Abandoned Ship (diving room).',
    'tm19': 'TM19 Giga Drain: Route 123 (girl near Berry Master, if holding a Grass-type).',
    'tm20': 'TM20 Safeguard: Lilycove Dept. Store (4F, $3000).',
    'tm21': 'TM21 Frustration: Pacifidlog Town (if lead Pokemon has low friendship).',
    'tm22': 'TM22 SolarBeam: Safari Zone (north-east area).',
    'tm23': 'TM23 Iron Tail: Meteor Falls (B1F).',
    'tm24': 'TM24 Thunderbolt: New Mauville (Wattson reward) & Mauville Game Corner (4000 coins).',
    'tm25': 'TM25 Thunder: Lilycove Dept. Store (4F, $5500).',
    'tm26': 'TM26 Earthquake: Seafloor Cavern (bottom room).',
    'tm27': 'TM27 Return: Fallarbor Town (Professor Cozmo) & Pacifidlog Town (high friendship).',
    'tm28': 'TM28 Dig: Route 114 (Fossil Maniac’s house, little brother).',
    'tm29': 'TM29 Psychic: Victory Road (1F) & Mauville Game Corner (3500 coins).',
    'tm30': 'TM30 Shadow Ball: Mt. Pyre (top floor).',
    'tm31': 'TM31 Brick Break: Sootopolis City (house near Pokemon Center).',
    'tm32': 'TM32 Double Team: Route 113 & Mauville Game Corner (1500 coins).',
    'tm33': 'TM33 Reflect: Lilycove Dept. Store (4F, $3000).',
    'tm34': 'TM34 Shock Wave: Reward from Gym Leader Wattson (3rd Gym).',
    'tm35': 'TM35 Flamethrower: Mauville Game Corner (4000 coins).',
    'tm36': 'TM36 Sludge Bomb: Dewford Town (Trendy Hall man, after defeating Norman).',
    'tm37': 'TM37 Sandstorm: Route 111 (desert south).',
    'tm38': 'TM38 Fire Blast: Lilycove Dept. Store (4F, $5500).',
    'tm39': 'TM39 Rock Tomb: Reward from Gym Leader Roxanne (1st Gym).',
    'tm40': 'TM40 Aerial Ace: Reward from Gym Leader Winona (6th Gym).',
    'tm41': 'TM41 Torment: Slateport City (Battle Tent).',
    'tm42': 'TM42 Facade: Reward from Gym Leader Norman (5th Gym).',
    'tm43': 'TM43 Secret Power: Route 111 (boy near tree) & Slateport Market.',
    'tm44': 'TM44 Rest: Lilycove City (house east of Dept. Store).',
    'tm45': 'TM45 Attract: Verdanturf Town (Battle Tent).',
    'tm46': 'TM46 Thief: Slateport City (Oceanic Museum, Team Aqua Grunt).',
    'tm47': 'TM47 Steel Wing: Granite Cave (Steven Stone).',
    'tm48': 'TM48 Skill Swap: Mt. Pyre (outside).',
    'tm49': 'TM49 Snatch: S.S. Tidal (cabin).',
    'tm50': 'TM50 Overheat: Reward from Gym Leader Flannery (4th Gym).',
    'hm01': 'HM01 Cut: Rustboro City (Cutter’s House, west of Pokemon Center).',
    'hm02': 'HM02 Fly: Route 119 (Rival battle reward).',
    'hm03': 'HM03 Surf: Petalburg City (Wally’s house, after defeating Norman).',
    'hm04': 'HM04 Strength: Rusturf Tunnel (reward for smashing rock with Rock Smash).',
    'hm05': 'HM05 Flash: Granite Cave (Hiker near entrance).',
    'hm06': 'HM06 Rock Smash: Mauville City (scientist in southeast house).',
    'hm07': 'HM07 Waterfall: Cave of Origin (Wallace, during Sootopolis crisis).',
    'hm08': 'HM08 Dive: Mossdeep City (Steven’s house, after defeating Tate & Liza).'
};

async function main() {
    console.log('PokéAPI CSV-tabellen downloaden...');
    const [
        movesCsv,
        moveNamesCsv,
        moveProseCsv,
        pokemonCsv,
        speciesCsv,
        pokemonStatsCsv,
        itemsCsv,
        itemNamesCsv,
        itemProseCsv,
        itemGameIndicesCsv
    ] = await Promise.all([
        fetchCsv('moves.csv'),
        fetchCsv('move_names.csv'),
        fetchCsv('move_effect_prose.csv'),
        fetchCsv('pokemon.csv'),
        fetchCsv('pokemon_species.csv'),
        fetchCsv('pokemon_stats.csv'),
        fetchCsv('items.csv'),
        fetchCsv('item_names.csv'),
        fetchCsv('item_prose.csv'),
        fetchCsv('item_game_indices.csv')
    ]);

    // -------------------------------------------------------
    // 1. Alle Generation III Moves (id <= 354, generation_id <= 3)
    // -------------------------------------------------------
    const moveNameById = new Map();
    moveNamesCsv.forEach(r => {
        if (r.local_language_id === '9') {
            moveNameById.set(r.move_id, r.name);
        }
    });

    const moveEffectById = new Map();
    moveProseCsv.forEach(r => {
        if (r.local_language_id === '9') {
            moveEffectById.set(r.move_effect_id, r.short_effect || r.effect);
        }
    });

    const gen3Moves = [];
    movesCsv.forEach(r => {
        const gen = Number(r.generation_id);
        const id = Number(r.id);
        if (!Number.isFinite(gen) || gen > 3 || id > 354) return;

        const typeInfo = TYPE_MAP[Number(r.type_id)] || { name: 'Normal', category: 'Physical' };
        const isStatusMove = Number(r.damage_class_id) === 1;
        const gen3Category = isStatusMove ? 'Status' : typeInfo.category;

        gen3Moves.push({
            id,
            name: moveNameById.get(r.id) || formatName(r.identifier),
            identifier: r.identifier,
            type: typeInfo.name,
            category: gen3Category,
            power: r.power ? Number(r.power) : null,
            accuracy: r.accuracy ? Number(r.accuracy) : null,
            pp: r.pp ? Number(r.pp) : null,
            priority: Number(r.priority || 0),
            effect_chance: r.effect_chance ? Number(r.effect_chance) : null,
            effect: cleanProse(moveEffectById.get(r.effect_id), r.effect_chance)
        });
    });

    gen3Moves.sort((a, b) => a.id - b.id);

    fs.mkdirSync(path.dirname(MOVES_OUT), { recursive: true });
    fs.writeFileSync(
        MOVES_OUT,
        JSON.stringify({ game: 'Pokemon Emerald', generation: 3, total_moves: gen3Moves.length, moves: gen3Moves }, null, 2),
        'utf8'
    );
    console.log(`1/3: ${gen3Moves.length} Generation III-moves opgeslagen in ${MOVES_OUT}`);

    // -------------------------------------------------------
    // 2. EV Yields voor alle 386 Generation III Pokémon
    // -------------------------------------------------------
    const statKeyMap = {
        '1': 'hp',
        '2': 'attack',
        '3': 'defense',
        '4': 'special_attack',
        '5': 'special_defense',
        '6': 'speed'
    };

    const speciesGenMap = new Map();
    speciesCsv.forEach(r => {
        speciesGenMap.set(r.id, Number(r.generation_id));
    });

    const effortByPokemonId = new Map();
    pokemonStatsCsv.forEach(r => {
        const effort = Number(r.effort || 0);
        if (effort <= 0) return;
        const statKey = statKeyMap[r.stat_id];
        if (!statKey) return;

        if (!effortByPokemonId.has(r.pokemon_id)) {
            effortByPokemonId.set(r.pokemon_id, {});
        }
        effortByPokemonId.get(r.pokemon_id)[statKey] = effort;
    });

    const evYields = [];
    pokemonCsv.forEach(r => {
        if (r.is_default !== '1') return;
        const speciesId = Number(r.species_id);
        const gen = speciesGenMap.get(r.species_id);
        if (!gen || gen > 3 || speciesId > 386) return;

        const yields = effortByPokemonId.get(r.id) || {};
        const totalEv = Object.values(yields).reduce((sum, v) => sum + v, 0);

        evYields.push({
            national_dex: speciesId,
            name: formatName(r.identifier),
            identifier: r.identifier,
            ev_yield: yields,
            total_ev_yield: totalEv
        });
    });

    evYields.sort((a, b) => a.national_dex - b.national_dex);

    const evMechanicsOutput = {
        game: 'Pokemon Emerald',
        generation: 3,
        iv_ev_rules: {
            iv_range: '0 to 31 per stat (determined when encountered/hatched; cannot be changed in Emerald).',
            ev_caps: 'Maximum 255 EVs per single stat (252 is the effective maximum because 255 / 4 floors to 63), and maximum 510 total EVs across all six stats.',
            stat_scaling: 'Every 4 EVs in a stat grants +1 stat point at Level 100 (scales proportionally by level: Math.floor((EV / 4) * (Level / 100))).',
            vitamins: 'HP Up, Protein, Iron, Calcium, Zinc, and Carbos each grant +10 EVs in their respective stat, up to a cap of 100 EVs per stat.',
            multipliers: 'Macho Brace doubles EVs gained from battle (2x) while halving Speed in battle. Pokerus also doubles EVs gained (2x), stacking multiplicatively with Macho Brace for 4x EVs.',
            exp_share_rule: 'In Generation III, any Pokemon that gains Experience Points from a battle (including via Exp. Share or switching out) receives the full base EV yield of the defeated Pokemon.'
        },
        total_species: evYields.length,
        pokemon: evYields
    };

    fs.writeFileSync(EV_YIELDS_OUT, JSON.stringify(evMechanicsOutput, null, 2), 'utf8');
    console.log(`2/3: ${evYields.length} Generation III EV-yield records opgeslagen in ${EV_YIELDS_OUT}`);

    // -------------------------------------------------------
    // 3. Generation III Items & Emerald vindplaatsen
    // -------------------------------------------------------
    const gen3ItemIds = new Set();
    itemGameIndicesCsv.forEach(r => {
        if (Number(r.generation_id) === 3) {
            gen3ItemIds.add(r.item_id);
        }
    });

    const itemNameById = new Map();
    itemNamesCsv.forEach(r => {
        if (r.local_language_id === '9') {
            itemNameById.set(r.item_id, r.name);
        }
    });

    const itemEffectById = new Map();
    itemProseCsv.forEach(r => {
        if (r.local_language_id === '9') {
            itemEffectById.set(r.item_id, r.short_effect || r.effect);
        }
    });

    const gen3Items = [];
    itemsCsv.forEach(r => {
        const isTmHm = /^tm\d{2}$|^hm\d{2}$/i.test(r.identifier);
        if (!gen3ItemIds.has(r.id) && !isTmHm && !EMERALD_ITEM_LOCATIONS[r.identifier]) {
            return;
        }
        // Filter Gen 4+ TMs (TM51-TM92)
        if (/^tm(\d+)$/i.test(r.identifier)) {
            const num = Number(r.identifier.slice(2));
            if (num > 50) return;
        }

        const displayName = itemNameById.get(r.id) || formatName(r.identifier);
        const location = EMERALD_ITEM_LOCATIONS[r.identifier] || null;

        gen3Items.push({
            id: Number(r.id),
            name: displayName,
            identifier: r.identifier,
            cost: Number(r.cost || 0),
            effect: cleanProse(itemEffectById.get(r.id), ''),
            emerald_location: location
        });
    });

    gen3Items.sort((a, b) => a.id - b.id);

    fs.mkdirSync(path.dirname(ITEMS_OUT), { recursive: true });
    fs.writeFileSync(
        ITEMS_OUT,
        JSON.stringify({ game: 'Pokemon Emerald', generation: 3, total_items: gen3Items.length, items: gen3Items }, null, 2),
        'utf8'
    );
    console.log(`3/3: ${gen3Items.length} Generation III-items opgeslagen in ${ITEMS_OUT}`);
}

main().catch(err => {
    console.error('Fout bij genereren:', err.message);
    process.exit(1);
});