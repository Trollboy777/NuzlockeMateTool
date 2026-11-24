const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

// ---------------------------------------------------------------------------
// Instellingen
// ---------------------------------------------------------------------------
const OLLAMA_URL = 'http://localhost:11434/api/chat';
const OLLAMA_MODEL = 'qwen3:8b';
const NUM_CTX = 8192;             // contextvenster van het model (tokens)
const NUM_PREDICT = 2500;         // max. gegenereerde tokens (thinking telt mee)
const MAX_HISTORY_MESSAGES = 8;   // aantal eerdere chatberichten dat we meesturen
const MAX_POKEMON_IN_CONTEXT = 4; // max. aantal Pokémon-blokken per vraag
const MAX_BOSS_BATTLES = 4;       // max. aantal boss-gevechten tegelijk in context

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---------------------------------------------------------------------------
// Locaties van de kennisbank
// ---------------------------------------------------------------------------
const regularTrainersPath = path.join(__dirname, 'data', 'trainers', 'emerald-trainers.json');
const gymsPath = path.join(__dirname, 'data', 'trainers', 'emerald-gyms.json');
const leaguePath = path.join(__dirname, 'data', 'trainers', 'emerald-pokemon-league.json');
const bossTrainersPath = path.join(__dirname, 'data', 'trainers', 'emerald-boss-trainers.json');
const rulesPath = path.join(__dirname, 'data', 'rules', 'nuzlocke-rules.json');
const mechanicsPath = path.join(__dirname, 'data', 'mechanics', 'emerald-type-effectiveness.json');
const pokemonPath = path.join(__dirname, 'data', 'pokemon', 'emerald-pokemon.json');
const availabilityPath = path.join(__dirname, 'data', 'pokemon', 'emerald-availability.json');
const movesPath = path.join(__dirname, 'data', 'pokemon', 'emerald-moves.json');
const abilitiesPath = path.join(__dirname, 'data', 'pokemon', 'emerald-abilities.json');
const nationalDexPath = path.join(__dirname, 'data', 'pokemon', 'pokemon-national-dex.json');

// Leest een JSON-bestand. Bij een fout krijg je de fallback terug en een duidelijke melding,
// zodat één kapot bestand niet de hele kennisbank onderuit haalt.
function loadJson(filePath, fallback) {
    try {
        if (!fs.existsSync(filePath)) {
            console.warn(`Bestand niet gevonden: ${filePath}`);
            return fallback;
        }
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (error) {
        console.error(`Fout bij het inladen van ${filePath}:`, error.message);
        return fallback;
    }
}

// ---------------------------------------------------------------------------
// Kennisbankgegevens inladen
// ---------------------------------------------------------------------------
const emeraldRegularTrainers = loadJson(regularTrainersPath, { trainers: [] });
const emeraldGyms = loadJson(gymsPath, { gyms: [] });
const emeraldLeague = loadJson(leaguePath, { elite_four: [], champion: null });
const emeraldBossTrainers = loadJson(bossTrainersPath, { boss_trainers: [] });
const nuzlockeRules = loadJson(rulesPath, { rules: [] });
const emeraldMechanics = loadJson(mechanicsPath, {
    stabMultiplier: 1.5,
    typeEffectiveness: {},
    damageCategories: { Physical: [], Special: [] },
    natures: {},
    statStages: {},
    statusConditions: {},
    moveEffects: {},
    abilityModifiers: { typeDefense: {}, statAndDamage: {} }
});
const emeraldPokemon = loadJson(pokemonPath, { pokemon: [], unobtainable_in_emerald: [] });
const emeraldAvailability = loadJson(availabilityPath, { availability: [] });
const emeraldMoves = loadJson(movesPath, { move_learnsets: [] });
const emeraldAbilities = loadJson(abilitiesPath, { abilities: [] });
const nationalDex = loadJson(nationalDexPath, { pokemon: [] });

// Zorg dat verwachte lijsten altijd bestaan
emeraldRegularTrainers.trainers = emeraldRegularTrainers.trainers || [];
emeraldGyms.gyms = emeraldGyms.gyms || [];
emeraldLeague.elite_four = emeraldLeague.elite_four || [];
emeraldBossTrainers.boss_trainers = (emeraldBossTrainers.boss_trainers || []).filter(
    trainer => !String(trainer.key || '').endsWith('_PLACEHOLDER') && trainer.key !== 'MATTHEW'
);
nuzlockeRules.rules = nuzlockeRules.rules || [];
emeraldMechanics.typeEffectiveness = emeraldMechanics.typeEffectiveness || {};
emeraldMechanics.natures = emeraldMechanics.natures || {};
emeraldMechanics.statStages = emeraldMechanics.statStages || {};
emeraldMechanics.statusConditions = emeraldMechanics.statusConditions || {};
emeraldMechanics.moveEffects = emeraldMechanics.moveEffects || {};
emeraldMechanics.abilityModifiers = emeraldMechanics.abilityModifiers || { typeDefense: {}, statAndDamage: {} };
emeraldPokemon.pokemon = emeraldPokemon.pokemon || [];
emeraldPokemon.unobtainable_in_emerald = emeraldPokemon.unobtainable_in_emerald || [];
emeraldAvailability.availability = emeraldAvailability.availability || [];
emeraldMoves.move_learnsets = emeraldMoves.move_learnsets || [];
emeraldAbilities.abilities = emeraldAbilities.abilities || [];
nationalDex.pokemon = nationalDex.pokemon || [];

console.log('Kennisbank ingeladen:');
console.log(`- ${emeraldRegularTrainers.trainers.length} reguliere trainers`);
console.log(`- ${emeraldGyms.gyms.length} Gym Leaders`);
console.log(`- ${emeraldLeague.elite_four.length} Elite Four-leden`);
console.log(
    emeraldLeague.champion
        ? `- Champion: ${emeraldLeague.champion.name}`
        : '- Geen Champion gevonden'
);
console.log(`- ${emeraldBossTrainers.boss_trainers.length} Boss Battles`);
console.log(`- ${nuzlockeRules.rules.length} Nuzlocke-regels`);
console.log(`- ${Object.keys(emeraldMechanics.typeEffectiveness).length} aanvallende types`);
console.log(`- ${emeraldPokemon.pokemon.length} verkrijgbare Emerald-Pokémon`);
console.log(`- ${emeraldPokemon.unobtainable_in_emerald.length} niet-verkrijgbare Gen III-soorten`);
console.log(`- ${emeraldAvailability.availability.length} beschikbaarheidsvermeldingen`);
console.log(`- ${emeraldMoves.move_learnsets.length} learnset-records`);
console.log(`- ${emeraldAbilities.abilities.length} Abilities`);

// ---------------------------------------------------------------------------
// Hulpfuncties voor tekst
// ---------------------------------------------------------------------------

// Kleine letters en zonder accenten (Pokémon -> pokemon)
function normalizeText(text) {
    return String(text)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
}

function escapeRegExp(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ---------------------------------------------------------------------------
// Type-effectiviteit & Ability-modifiers (Generation III)
// ---------------------------------------------------------------------------
const EXTRA_GEN3_POKEMON_DATA = {
    meditite: {
        types: ['Fighting', 'Psychic'],
        abilities: ['Pure Power'],
        base_stats: { hp: 30, attack: 40, defense: 55, special_attack: 40, special_defense: 55, speed: 60 }
    },
    lunatone: {
        types: ['Rock', 'Psychic'],
        abilities: ['Levitate'],
        base_stats: { hp: 70, attack: 55, defense: 65, special_attack: 95, special_defense: 85, speed: 70 }
    },
    roselia: {
        types: ['Grass', 'Poison'],
        abilities: ['Natural Cure', 'Poison Point'],
        base_stats: { hp: 50, attack: 60, defense: 45, special_attack: 100, special_defense: 80, speed: 65 }
    },
    milotic: {
        types: ['Water'],
        abilities: ['Marvel Scale'],
        base_stats: { hp: 95, attack: 60, defense: 79, special_attack: 100, special_defense: 125, speed: 81 }
    }
};

function findPokemonEntryByName(pokemonName) {
    const key = normalizeText(pokemonName);
    const found = emeraldPokemon.pokemon.find(
        entry => normalizeText(entry.name) === key
    );

    if (found) return found;

    const extra = EXTRA_GEN3_POKEMON_DATA[key];
    if (extra) {
        return {
            name: pokemonName,
            types: extra.types,
            abilities: extra.abilities,
            base_stats: extra.base_stats
        };
    }

    return null;
}

function resolvePokemonTypes(pokemonName, explicitTypes) {
    if (Array.isArray(explicitTypes) && explicitTypes.length > 0) {
        return explicitTypes;
    }

    const entry = findPokemonEntryByName(pokemonName);
    return entry?.types || [];
}

function resolvePokemonAbilities(pokemonName) {
    const entry = findPokemonEntryByName(pokemonName);
    return entry?.abilities || [];
}

function getTypeMultiplier(attackingType, defendingTypes, guaranteedAbility = null) {
    const chart = emeraldMechanics.typeEffectiveness;

    let multiplier = defendingTypes.reduce((acc, defendingType) => {
        const effectiveness = chart[attackingType]?.[defendingType] ?? 1;
        return acc * effectiveness;
    }, 1);

    if (guaranteedAbility) {
        const typeDefMods = emeraldMechanics.abilityModifiers?.typeDefense?.[guaranteedAbility];
        if (typeDefMods) {
            if (typeDefMods.onlySuperEffective) {
                if (multiplier <= 1) multiplier = 0;
            } else if (typeDefMods[attackingType] !== undefined) {
                multiplier *= typeDefMods[attackingType];
            }
        }
    }

    return multiplier;
}

// Compacte samenvatting: zwaktes, weerstanden, immuniteiten + ability-modifiers
function summarizeTypeMatchups(defendingTypes, abilities = []) {
    const attackTypes = Object.keys(emeraldMechanics.typeEffectiveness);

    if (attackTypes.length === 0) {
        return 'Type chart not loaded; no verified type matchups available.';
    }

    const typeDefMap = emeraldMechanics.abilityModifiers?.typeDefense || {};
    const validAbilities = (abilities || []).filter(Boolean);

    // Als een Pokémon maar 1 mogelijke ability heeft, is die gegarandeerd actief
    const guaranteedAbility =
        validAbilities.length === 1 && typeDefMap[validAbilities[0]]
            ? validAbilities[0]
            : null;

    const weak = [];
    const resists = [];
    const immune = [];

    attackTypes.forEach(attackingType => {
        const baseMult = getTypeMultiplier(attackingType, defendingTypes, null);
        const effMult = getTypeMultiplier(attackingType, defendingTypes, guaranteedAbility);
        const abilityTag = guaranteedAbility && effMult !== baseMult ? ` (${guaranteedAbility})` : '';

        if (effMult === 0) {
            immune.push(`${attackingType}${abilityTag}`);
        } else if (effMult > 1) {
            weak.push({ type: attackingType, multiplier: effMult, tag: abilityTag });
        } else if (effMult < 1) {
            resists.push({ type: attackingType, multiplier: effMult, tag: abilityTag });
        }
    });

    weak.sort((a, b) => b.multiplier - a.multiplier);
    resists.sort((a, b) => a.multiplier - b.multiplier);

    const format = list =>
        list.length > 0
            ? list.map(item => `${item.type} ${item.multiplier}x${item.tag}`).join(', ')
            : 'none';

    let summary = `Weak to: ${format(weak)}. Resists: ${format(resists)}. Immune to: ${immune.length > 0 ? immune.join(', ') : 'none'}.`;

    // Als er meerdere abilities mogelijk zijn (bijv. Hariyama: Thick Fat / Guts), vermeld de voorwaardelijke modifier
    if (!guaranteedAbility && validAbilities.length > 1) {
        const conditionalNotes = [];
        validAbilities.forEach(abilityName => {
            const mods = typeDefMap[abilityName];
            if (!mods) return;

            if (mods.onlySuperEffective) {
                conditionalNotes.push(`If ${abilityName}: immune to all non-super-effective attacks`);
                return;
            }

            const changes = Object.entries(mods).map(([atkType, modFactor]) => {
                const base = getTypeMultiplier(atkType, defendingTypes, null);
                return `${atkType} ${base * modFactor}x`;
            });

            if (changes.length > 0) {
                conditionalNotes.push(`If ${abilityName}: ${changes.join(', ')}`);
            }
        });

        if (conditionalNotes.length > 0) {
            summary += ` Ability modifier note: ${conditionalNotes.join('; ')}.`;
        }
    }

    return summary;
}

function describeMatchups(name, types, abilities = []) {
    if (!types || types.length === 0) {
        return `${name}: no verified type data available.`;
    }

    return `${name} (${types.join('/')}): ${summarizeTypeMatchups(types, abilities)}`;
}

// Matchups voor een heel team; identieke Pokémon (zelfde soort en type) maar één keer
function buildTeamMatchupsText(team) {
    const seen = new Set();
    const lines = [];

    (team || []).forEach(member => {
        const types = resolvePokemonTypes(member.pokemon, member.type);
        const abilities = resolvePokemonAbilities(member.pokemon);
        const key = `${member.pokemon}|${types.join('/')}`;

        if (seen.has(key)) return;
        seen.add(key);

        lines.push(`- ${describeMatchups(member.pokemon, types, abilities)}`);
    });

    return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Generation III Stat-berekeningen (Natures, IV's, EV's)
// ---------------------------------------------------------------------------
function calcGen3Hp(baseHp, level, iv = 0, ev = 0, isShedinja = false) {
    if (isShedinja || baseHp === 1) return 1;
    return Math.floor(((2 * baseHp + iv + Math.floor(ev / 4)) * level) / 100) + level + 10;
}

function calcGen3OtherStat(baseStat, level, iv = 0, ev = 0, natureMult = 1.0) {
    const raw = Math.floor(((2 * baseStat + iv + Math.floor(ev / 4)) * level) / 100) + 5;
    return Math.floor(raw * natureMult);
}

// Berekent exacte stats voor tegenstanders (0 EVs, bekende IV's uit trainer-data)
function computeOpponentStatLine(pokemonName, level, iv = 0) {
    const entry = findPokemonEntryByName(pokemonName);
    const stats = entry?.base_stats;
    if (!stats || !level) return null;

    const isShedinja = normalizeText(pokemonName) === 'shedinja';
    const hp = calcGen3Hp(stats.hp, level, iv, 0, isShedinja);
    const atk = calcGen3OtherStat(stats.attack, level, iv, 0, 1.0);
    const def = calcGen3OtherStat(stats.defense, level, iv, 0, 1.0);
    const spa = calcGen3OtherStat(stats.special_attack, level, iv, 0, 1.0);
    const spd = calcGen3OtherStat(stats.special_defense, level, iv, 0, 1.0);
    const speNeutral = calcGen3OtherStat(stats.speed, level, iv, 0, 1.0);
    const speMin = calcGen3OtherStat(stats.speed, level, iv, 0, 0.9);
    const speMax = calcGen3OtherStat(stats.speed, level, iv, 0, 1.1);

    return `Calculated Gen III stats (Lv.${level}, ${iv} IVs, 0 EVs, neutral nature): HP ${hp} | Atk ${atk} | Def ${def} | SpA ${spa} | SpD ${spd} | Spe ${speNeutral} (nature range ${speMin}-${speMax})`;
}

// Berekent stat-bereik voor een speler-Pokémon bij een bepaald level en eventuele Nature
function computePlayerStatRange(entry, level, natureName = null) {
    const stats = entry?.base_stats;
    if (!stats || !level) return null;

    const isShedinja = normalizeText(entry.name) === 'shedinja';
    const natureData = natureName ? emeraldMechanics.natures?.[natureName] : null;

    const getNatureBounds = statKey => {
        if (!natureData) return [0.9, 1.1];
        if (natureData.up === statKey) return [1.1, 1.1];
        if (natureData.down === statKey) return [0.9, 0.9];
        return [1.0, 1.0];
    };

    const formatStatRange = (statKey, baseVal) => {
        const [minMult, maxMult] = getNatureBounds(statKey);
        const minVal = calcGen3OtherStat(baseVal, level, 0, 0, minMult);
        const maxVal = calcGen3OtherStat(baseVal, level, 31, 252, maxMult);
        return `${minVal}-${maxVal}`;
    };

    const hpMin = calcGen3Hp(stats.hp, level, 0, 0, isShedinja);
    const hpMax = calcGen3Hp(stats.hp, level, 31, 252, isShedinja);
    const natureLabel = natureName ? `${natureName} nature` : 'any nature';

    return `Calculated Gen III stat range at Level ${level} (${natureLabel}, 0 IV/0 EV to 31 IV/252 EV): HP ${hpMin}-${hpMax} | Atk ${formatStatRange('attack', stats.attack)} | Def ${formatStatRange('defense', stats.defense)} | SpA ${formatStatRange('special_attack', stats.special_attack)} | SpD ${formatStatRange('special_defense', stats.special_defense)} | Spe ${formatStatRange('speed', stats.speed)}`;
}

function detectLevelInPrompt(prompt) {
    const match = /\b(?:level|lvl\.?|lv\.?)\s*(\d{1,3})\b/i.exec(prompt);
    if (!match) return null;
    const lvl = Number(match[1]);
    return lvl >= 1 && lvl <= 100 ? lvl : null;
}

function detectNaturesInPrompt(prompt) {
    const question = normalizeText(prompt);
    const natures = Object.keys(emeraldMechanics.natures || {});

    return natures.filter(nature => {
        const normNature = normalizeText(nature);
        return new RegExp(`\\b${escapeRegExp(normNature)}\\b`).test(question);
    });
}

function formatTrainerItems(items) {
    if (!Array.isArray(items) || items.length === 0) return 'none';

    const counts = new Map();
    items.forEach(item => {
        counts.set(item, (counts.get(item) || 0) + 1);
    });

    return [...counts.entries()]
        .map(([item, count]) => (count > 1 ? `${item} (x${count})` : item))
        .join(', ');
}

function formatTrainerTeamMember(member) {
    const types = resolvePokemonTypes(member.pokemon, member.type);
    const abilities = resolvePokemonAbilities(member.pokemon);
    const details = [`Level ${member.level}`];

    if (types.length > 0) details.push(`Type: ${types.join('/')}`);
    if (abilities.length > 0) details.push(`Possible abilities: ${abilities.join('/')}`);
    if (member.held_item) details.push(`Held item: ${member.held_item}`);
    if (member.iv !== undefined) details.push(`IVs: ${member.iv}`);
    if (Array.isArray(member.moves) && member.moves.length > 0) {
        details.push(`Moves: ${member.moves.join(', ')}`);
    }

    const statLine = computeOpponentStatLine(member.pokemon, member.level, member.iv ?? 0);
    return statLine
        ? `- ${member.pokemon} (${details.join(' | ')})\n  ${statLine}`
        : `- ${member.pokemon} (${details.join(' | ')})`;
}

// ---------------------------------------------------------------------------
// Herkenning van Gym Leaders, Pokémon League-trainers en Boss Battles
// ---------------------------------------------------------------------------
function findGym(prompt) {
    const question = prompt.toLowerCase();

    const ordinalNumbers = {
        1: ['first', '1st'],
        2: ['second', '2nd'],
        3: ['third', '3rd'],
        4: ['fourth', '4th'],
        5: ['fifth', '5th'],
        6: ['sixth', '6th'],
        7: ['seventh', '7th'],
        8: ['eighth', '8th']
    };

    return emeraldGyms.gyms.find(gym => {
        const leader = gym.leader.toLowerCase();
        const location = gym.location.toLowerCase();

        const mentionsLeader = question.includes(leader);

        const mentionsTateOrLiza =
            leader === 'tate & liza' &&
            (question.includes('tate') || question.includes('liza'));

        const mentionsLocation = question.includes(location);

        const mentionsGymNumber =
            new RegExp(`\\bgym\\s*${gym.number}\\b`).test(question) ||
            new RegExp(`\\b${gym.number}(st|nd|rd|th|e|de)\\s*gym\\b`).test(question);

        const ordinals = ordinalNumbers[gym.number] || [];

        const mentionsOrdinal = ordinals.some(ordinal =>
            question.includes(`${ordinal} gym`) ||
            question.includes(`${ordinal} gym leader`) ||
            question.includes(`${ordinal}e gym`) ||
            question.includes(`${ordinal}e gymleider`)
        );

        return (
            mentionsLeader ||
            mentionsTateOrLiza ||
            mentionsLocation ||
            mentionsGymNumber ||
            mentionsOrdinal
        );
    });
}

function findLeagueTrainer(prompt) {
    const question = prompt.toLowerCase();

    const eliteFour = emeraldLeague.elite_four || [];
    const champion = emeraldLeague.champion;

    const foundEliteFour = eliteFour.find(trainer =>
        question.includes(trainer.name.toLowerCase())
    );

    if (foundEliteFour) {
        return { type: 'elite_four', trainer: foundEliteFour };
    }

    if (champion && question.includes(champion.name.toLowerCase())) {
        return { type: 'champion', trainer: champion };
    }

    return null;
}

const BOSS_LOCATION_ALIASES = [
    { context: 'Mt Chimney', keywords: ['mt chimney', 'mount chimney', 'chimney'] },
    { context: 'Magma Hideout', keywords: ['magma hideout', 'hideout'] },
    { context: 'Mossdeep', keywords: ['mossdeep'] },
    { context: 'Weather Institute', keywords: ['weather institute'] },
    { context: 'Seafloor Cavern', keywords: ['seafloor cavern', 'seafloor'] },
    { context: 'Victory Road', keywords: ['victory road'] },
    { context: 'Mauville', keywords: ['mauville'] },
    { context: 'Route 103', keywords: ['route 103'] },
    { context: 'Rustboro', keywords: ['rustboro'] },
    { context: 'Route 110', keywords: ['route 110'] },
    { context: 'Lilycove', keywords: ['lilycove'] },
    { context: 'Route 119', keywords: ['route 119'] }
];

function findBossTrainers(prompt) {
    const question = normalizeText(prompt);
    const bosses = emeraldBossTrainers.boss_trainers || [];

    if (bosses.length === 0) return [];

    const mentionsMagma = /\bteam magma\b/.test(question);
    const mentionsAqua = /\bteam aqua\b/.test(question);

    let matches = bosses.filter(boss => {
        const namePattern = new RegExp(`\\b${escapeRegExp(normalizeText(boss.name))}\\b`);
        if (namePattern.test(question)) return true;
        if (mentionsMagma && boss.group === 'Team Magma') return true;
        if (mentionsAqua && boss.group === 'Team Aqua') return true;
        return false;
    });

    if (matches.length === 0) return [];

    // Filter op gevechtslocatie als de gebruiker die noemt (bijv. "Maxie op Mt. Chimney")
    const matchedLocation = BOSS_LOCATION_ALIASES.find(entry =>
        entry.keywords.some(kw => question.includes(kw))
    );

    if (matchedLocation) {
        const locationFiltered = matches.filter(
            boss => normalizeText(boss.battle_context) === normalizeText(matchedLocation.context)
        );
        if (locationFiltered.length > 0) {
            matches = locationFiltered;
        }
    }

    // Filter Rival-gevechten op gekozen starter als de gebruiker die noemt
    const starterVariants = ['mudkip', 'torchic', 'treecko'];
    const mentionedStarter = starterVariants.find(s => new RegExp(`\\b${s}\\b`).test(question));

    if (mentionedStarter) {
        const starterFiltered = matches.filter(
            boss => normalizeText(boss.player_starter_variant || '') === mentionedStarter
        );
        if (starterFiltered.length > 0) {
            matches = starterFiltered;
        }
    }

    return matches;
}

function findRegularTrainers(prompt) {
    const normalizedPrompt = normalizeText(prompt);
    if (!normalizedPrompt) return [];

    const trainers = emeraldRegularTrainers.trainers || [];

    // Alleen rematches ophalen als de speler daar expliciet naar vraagt.
    const wantsRematches = /\b(rematch|rematches)\b/i.test(prompt);

    const relevantTrainers = trainers.filter(trainer => {
        const category = normalizeText(trainer.category || '');

        if (wantsRematches) {
            return category === 'rematch';
        }

        return (
            category === 'regular' ||
            category === 'evil_team_grunt'
        );
    });

    // Eerst zoeken op trainernaam.
    const nameMatches = relevantTrainers.filter(trainer => {
        const name = normalizeText(trainer.name || '');
        const fullName = normalizeText(trainer.full_name || '');
        const trainerClass = normalizeText(trainer.trainer_class || '');

        return (
            (name && normalizedPrompt.includes(name)) ||
            (fullName && normalizedPrompt.includes(fullName)) ||
            (name && trainerClass &&
                normalizedPrompt.includes(`${trainerClass} ${name}`))
        );
    });

    if (nameMatches.length > 0) {
        return nameMatches;
    }

    // Als er geen naam matcht, zoeken we op locatie.
    return relevantTrainers.filter(trainer => {
        const location = normalizeText(trainer.location || '');
        return location && normalizedPrompt.includes(location);
    });
}

function formatRegularTrainer(trainer) {
    const lines = [
        `Trainer: ${trainer.full_name || trainer.name}`,
        `*Location: ${trainer.location}`,
        `*Battle format: ${trainer.battle_format || 'unknown'}`,
        `*Highest level: ${trainer.highest_level ?? 'unknown'}`
    ];

    if (trainer.trainer_items?.length > 0) {
        lines.push(
            `*Trainer items: ${formatTrainerItems(trainer.trainer_items)}`
        );
    }

    lines.push('*Team:');

    for (const member of trainer.team || []) {
        lines.push(formatTrainerTeamMember(member));
    }

    lines.push('*Defensive type matchups:');
    lines.push(buildTeamMatchupsText(trainer.team || []));

    return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Niet-ondersteunde games herkennen
// ---------------------------------------------------------------------------
const DISTINCTIVE_OTHER_GAMES = [
    'ruby',
    'sapphire',
    'omega ruby',
    'alpha sapphire',
    'firered',
    'fire red',
    'leafgreen',
    'leaf green',
    'heartgold',
    'heart gold',
    'soulsilver',
    'soul silver'
];

const AMBIGUOUS_OTHER_GAMES = [
    'red',
    'blue',
    'yellow',
    'gold',
    'silver',
    'crystal',
    'diamond',
    'pearl',
    'platinum',
    'black',
    'white',
    'black 2',
    'white 2',
    'x',
    'y',
    'sun',
    'moon',
    'ultra sun',
    'ultra moon',
    'sword',
    'shield',
    'scarlet',
    'violet'
];

function gameListToPattern(games) {
    return games
        .map(game => escapeRegExp(game).replace(/\s+/g, '\\s+'))
        .join('|');
}

const distinctiveGamePattern = new RegExp(
    `\\b(?:${gameListToPattern(DISTINCTIVE_OTHER_GAMES)})\\b`
);
const ambiguousGamePattern = new RegExp(
    `\\b(?:pokemon|in|for)\\s+(?:${gameListToPattern(AMBIGUOUS_OTHER_GAMES)})\\b|\\b(?:${gameListToPattern(AMBIGUOUS_OTHER_GAMES)})\\s+version\\b`
);

function isUnsupportedGameQuestion(prompt) {
    const question = normalizeText(prompt);

    return (
        distinctiveGamePattern.test(question) ||
        ambiguousGamePattern.test(question)
    );
}

// ---------------------------------------------------------------------------
// Pokémon-kennisbank
// ---------------------------------------------------------------------------
function findPokemon(prompt) {
    const question = normalizeText(prompt);
    const found = [];

    emeraldPokemon.pokemon.forEach(entry => {
        const name = normalizeText(entry.name);
        const pattern = new RegExp(`(^|[^a-z0-9])${escapeRegExp(name)}($|[^a-z0-9])`);
        const match = pattern.exec(question);

        if (match) {
            found.push({ entry, position: match.index });
        }
    });

    return found
        .sort((a, b) => a.position - b.position)
        .map(item => item.entry);
}

function findUnobtainablePokemon(prompt) {
    const question = normalizeText(prompt);
    const found = [];

    emeraldPokemon.unobtainable_in_emerald.forEach(rawName => {
        const name = normalizeText(rawName);
        const pattern = new RegExp(`(^|[^a-z0-9])${escapeRegExp(name)}($|[^a-z0-9])`);
        const match = pattern.exec(question);

        if (match) {
            found.push({ name: rawName, position: match.index });
        }
    });

    return found
        .sort((a, b) => a.position - b.position)
        .map(item => item.name);
}

function findOutOfGenerationPokemon(prompt) {
    const question = normalizeText(prompt);
    const found = [];

    nationalDex.pokemon.forEach(entry => {
        if ((entry.generation || 0) <= 3) return;

        const candidates = new Set([
            normalizeText(entry.name),
            normalizeText((entry.identifier || '').replace(/-/g, ' '))
        ]);

        for (const candidate of candidates) {
            if (!candidate) continue;
            const pattern = new RegExp(`(^|[^a-z0-9])${escapeRegExp(candidate)}($|[^a-z0-9])`);
            const match = pattern.exec(question);
            if (match) {
                found.push({ entry, position: match.index });
                break;
            }
        }
    });

    return found
        .sort((a, b) => a.position - b.position)
        .map(item => item.entry);
}

function findAbilities(prompt) {
    const question = normalizeText(prompt);

    return getAllKnownAbilityEntries().filter(ability => {
        const name = normalizeText(ability.name);
        const pattern = new RegExp(
            `(^|[^a-z0-9])${escapeRegExp(name)}($|[^a-z0-9])`
        );

        return pattern.test(question);
    });
}

function getAllKnownAbilityEntries() {
    const byKey = new Map();

    emeraldAbilities.abilities.forEach(ability => {
        byKey.set(normalizeText(ability.name), ability);
    });

    emeraldPokemon.pokemon.forEach(poke => {
        (poke.abilities || []).forEach(abilityName => {
            const key = normalizeText(abilityName);
            if (!byKey.has(key)) {
                byKey.set(key, {
                    name: abilityName,
                    generation: 3,
                    data_status: 'not_yet_researched'
                });
            }
        });
    });

    return [...byKey.values()];
}

function buildAbilityContext(prompt) {
    const found = findAbilities(prompt);

    if (found.length === 0) return null;

    const blocks = found.map(ability => {
        const lines = [
            `Ability: ${ability.name}`,
            `Generation: ${ability.generation}`
        ];

        if (ability.data_status !== 'verified') {
            lines.push('Detailed effects have not yet been verified. Do not guess.');
            return lines.join('\n');
        }

        if (ability.effects?.battle) {
            lines.push(`Battle effect: ${ability.effects.battle}`);
        }

        if (ability.effects?.overworld) {
            lines.push(`Overworld effect: ${ability.effects.overworld}`);
        }

        if (ability.limitations?.length > 0) {
            lines.push(`Limitations: ${ability.limitations.join(' ')}`);
        }

        return lines.join('\n');
    });

    return `RELEVANT ABILITY DATA (Pokemon Emerald, Generation III):\n\n${blocks.join('\n\n')}

IMPORTANT:
- Use only the ability effects and limitations listed above.
- Do not invent additional effects.
- Do not apply effects from other generations.`;
}

function buildBattleMechanicsContext(prompt, opponentTeams = []) {
    const question = normalizeText(prompt);
    const sections = [];

    // 1. Natures genoemd in de vraag
    const mentionedNatures = detectNaturesInPrompt(prompt);
    if (mentionedNatures.length > 0) {
        const natureLines = mentionedNatures.map(nature => {
            const mod = emeraldMechanics.natures[nature];
            if (!mod || (!mod.up && !mod.down)) {
                return `- ${nature}: Neutral nature (no stat changes, 1.0x all stats).`;
            }
            return `- ${nature}: +10% (1.1x) ${mod.up}, -10% (0.9x) ${mod.down}.`;
        });
        sections.push(`MENTIONED NATURES (Generation III):\n${natureLines.join('\n')}`);
    }

    // 2. Status conditions genoemd in de vraag
    const statusMap = emeraldMechanics.statusConditions || {};
    const statusKeywords = [
        { key: 'Paralysis', patterns: ['paralysis', 'paralyzed', 'paralyze', 'para'] },
        { key: 'Burn', patterns: ['burn', 'burned', 'burning'] },
        { key: 'Poison', patterns: ['poison', 'poisoned'] },
        { key: 'Badly Poisoned', patterns: ['badly poisoned', 'toxic'] },
        { key: 'Freeze', patterns: ['freeze', 'frozen', 'thaw'] },
        { key: 'Sleep', patterns: ['sleep', 'asleep', 'drowsy'] }
    ];

    const matchedStatuses = statusKeywords
        .filter(item => item.patterns.some(p => new RegExp(`\\b${escapeRegExp(p)}\\b`).test(question)))
        .map(item => item.key);

    if (matchedStatuses.length > 0) {
        const statusLines = matchedStatuses
            .filter(key => statusMap[key])
            .map(key => `- ${key}: ${statusMap[key].gen3_notes}`);
        if (statusLines.length > 0) {
            sections.push(`RELEVANT STATUS CONDITION MECHANICS (Generation III):\n${statusLines.join('\n')}`);
        }
    }

    // 3. Moves met stat-multipliers of status-effecten (in de vraag OF op het team van de tegenstander)
    const moveEffects = emeraldMechanics.moveEffects || {};
    const opponentMoveNames = new Set();
    opponentTeams.forEach(team => {
        (team || []).forEach(member => {
            (member.moves || []).forEach(move => opponentMoveNames.add(normalizeText(move)));
        });
    });

    const relevantMoves = Object.entries(moveEffects).filter(([moveName]) => {
        const normMove = normalizeText(moveName);
        const inPrompt = new RegExp(`\\b${escapeRegExp(normMove)}\\b`).test(question);
        const inOpponentMoves = opponentMoveNames.has(normMove);
        return inPrompt || inOpponentMoves;
    });

    if (relevantMoves.length > 0) {
        const moveLines = relevantMoves.map(
            ([moveName, info]) => `- ${moveName} (${info.category}): ${info.effect}`
        );
        sections.push(`RELEVANT MOVE MULTIPLIERS & EFFECTS (Generation III):\n${moveLines.join('\n')}`);
    }

    // 4. Stat stages referentie als de vraag over stages/boosts/drops gaat
    const asksStages = /\b(stage|stages|boost|boosted|drop|lower|raise|dragon dance|swords dance|bulk up|calm mind|belly drum|screech|charm|intimidate)\b/.test(question);
    if (asksStages && Object.keys(emeraldMechanics.statStages || {}).length > 0) {
        const stageSummary = Object.entries(emeraldMechanics.statStages)
            .map(([stage, val]) => `${Number(stage) > 0 ? `+${stage}` : stage}: ${val.multiplier}x (${val.numerator}/${val.denominator})`)
            .join(', ');
        sections.push(`GENERATION III STAT STAGE MULTIPLIERS (Atk, Def, SpA, SpD, Spe):\n${stageSummary}`);
    }

    return sections.length > 0 ? sections.join('\n\n') : null;
}

function formatEvolutionMethod(evolution) {
    if (!evolution) return 'unknown method';

    if (evolution.method === 'beauty') {
        const minimum = evolution.condition?.minimum;
        let description = 'Beauty condition';

        if (minimum !== undefined) {
            description += ` (minimum Beauty: ${minimum})`;
        }

        if (evolution.trigger === 'level_up') {
            description += ', followed by leveling up';
        }

        return description;
    }

    if (evolution.method === 'stone') {
        return evolution.item ? `use ${evolution.item}` : 'evolution stone';
    }

    if (evolution.method === 'friendship') {
        return evolution.condition && evolution.condition !== 'friendship'
            ? `high friendship (${evolution.condition})`
            : 'high friendship';
    }

    if (evolution.method === 'trade') {
        return evolution.item ? `trade holding ${evolution.item}` : 'trade';
    }

    if (evolution.level !== undefined) {
        return evolution.condition
            ? `level ${evolution.level} (${evolution.condition})`
            : `level ${evolution.level}`;
    }

    return evolution.method;
}

function describeEvolution(entry) {
    const lines = [];

    if (entry.evolution?.from) {
        lines.push(`Evolves from ${entry.evolution.from} (${formatEvolutionMethod(entry.evolution)}).`);
    } else {
        lines.push('Basic form (no pre-evolution).');
    }

    const evolvesInto = emeraldPokemon.pokemon.filter(
        other => other.evolution?.from === entry.name
    );

    if (evolvesInto.length > 0) {
        const intoText = evolvesInto
            .map(other => `${other.name} (${formatEvolutionMethod(other.evolution)})`)
            .join(', ');
        lines.push(`Evolves into: ${intoText}.`);
    } else {
        lines.push('Final stage (does not evolve further in Generation III).');
    }

    return lines.join(' ');
}

function formatRange(range) {
    if (!Array.isArray(range) || range.length === 0) return '';
    return range[0] === range[range.length - 1]
        ? `${range[0]}`
        : `${range[0]}-${range[range.length - 1]}`;
}

function formatAcquisitionMethod(method) {
    const parts = [];

    if (method.location) parts.push(`Location: ${method.location}`);

    if (Array.isArray(method.locations)) {
        method.locations.forEach(loc => {
            let text = `Location: ${loc.location}`;
            if (loc.level_range) text += `, levels ${formatRange(loc.level_range)}`;
            if (loc.encounter_rate) text += `, encounter rate ${loc.encounter_rate}`;
            parts.push(text);
        });
    }

    if (method.level !== undefined) parts.push(`Level: ${method.level}`);
    if (method.level_range) parts.push(`Level range: ${formatRange(method.level_range)}`);
    if (method.encounter_rate) parts.push(`Encounter rate: ${method.encounter_rate}`);
    if (method.details) parts.push(`Details: ${method.details}`);

    if (Array.isArray(method.special_conditions) && method.special_conditions.length > 0) {
        parts.push(`Special conditions: ${method.special_conditions.join(' ')}`);
    }

    return `- ${method.method}${parts.length > 0 ? ` | ${parts.join(' | ')}` : ''}`;
}

function describeAvailability(entry) {
    const availability = emeraldAvailability.availability.find(
        item => normalizeText(item.pokemon) === normalizeText(entry.name)
    );

    if (!availability || !Array.isArray(availability.methods) || availability.methods.length === 0) {
        if (entry.evolution?.from) {
            return `No direct encounter entry yet. It can be obtained by evolving ${entry.evolution.from} (${formatEvolutionMethod(entry.evolution)}).`;
        }

        const methodsHint = Array.isArray(entry.obtainability_methods) && entry.obtainability_methods.length > 0
            ? ` Obtainability category: ${entry.obtainability_methods.join(', ')}.`
            : '';

        return `Confirmed obtainable in Pokemon Emerald, but exact route/location details have not yet been populated in emerald-availability.json.${methodsHint} Do not guess locations.`;
    }

    return availability.methods.map(formatAcquisitionMethod).join('\n');
}

function describeMoves(entry) {
    const learnset = emeraldMoves.move_learnsets.find(
        item => normalizeText(item.pokemon) === normalizeText(entry.name)
    );

    const categories = ['level_up', 'tm', 'hm', 'move_tutor', 'egg_moves'];

    const hasData =
        learnset &&
        categories.some(key => Array.isArray(learnset[key]) && learnset[key].length > 0);

    if (!learnset || learnset.data_status === 'not_yet_researched' || !hasData) {
        return 'NOT YET RESEARCHED. Do not list, suggest or guess any moves this Pokemon can learn.';
    }

    const lines = [];

    if (learnset.level_up?.length > 0) {
        lines.push(`Level-up: ${learnset.level_up.map(m => `Lv${m.level} ${m.move}`).join(', ')}`);
    }
    if (learnset.tm?.length > 0) {
        lines.push(`TM: ${learnset.tm.map(m => `${m.machine} ${m.move}`).join(', ')}`);
    }
    if (learnset.hm?.length > 0) {
        lines.push(`HM: ${learnset.hm.map(m => `${m.machine} ${m.move}`).join(', ')}`);
    }
    if (learnset.move_tutor?.length > 0) {
        lines.push(`Move Tutor: ${learnset.move_tutor.map(m => m.move).join(', ')}`);
    }
    if (learnset.egg_moves?.length > 0) {
        lines.push(`Egg moves: ${learnset.egg_moves.map(m => m.move).join(', ')}`);
    }

    lines.push('Categories not listed above are not verified.');

    return lines.join('\n');
}

function describeAbilities(entry) {
    const abilities = entry.abilities || [];

    if (abilities.length === 0) {
        return 'No verified ability information available.';
    }

    const descriptions = abilities.map(abilityName => {
        const ability = emeraldAbilities.abilities.find(
            item => normalizeText(item.name) === normalizeText(abilityName)
        );

        if (!ability || ability.data_status !== 'verified') {
            return `${abilityName}: Detailed effects have not yet been researched. Do not guess.`;
        }

        const lines = [`${ability.name}:`];

        if (ability.effects?.battle) {
            lines.push(`Battle effect: ${ability.effects.battle}`);
        }

        if (ability.effects?.overworld) {
            lines.push(`Overworld effect: ${ability.effects.overworld}`);
        }

        if (ability.limitations?.length > 0) {
            lines.push(`Limitations: ${ability.limitations.join(' ')}`);
        }

        return lines.join(' ');
    });

    return descriptions.join('\n');
}

function buildPokemonContext(prompt) {
    const found = findPokemon(prompt);
    const unobtainable = findUnobtainablePokemon(prompt);

    if (found.length === 0 && unobtainable.length === 0) return null;

    const sections = [];
    const requestedLevel = detectLevelInPrompt(prompt);
    const requestedNatures = detectNaturesInPrompt(prompt);
    const activeNature = requestedNatures.length === 1 ? requestedNatures[0] : null;

    if (found.length > 0) {
        const shown = found.slice(0, MAX_POKEMON_IN_CONTEXT);

        const blocks = shown.map(entry => {
            const types = entry.types || [];
            const abilities = entry.abilities || [];
            const stats = entry.base_stats || {};

            const baseStats = [
                `HP: ${stats.hp ?? 'unknown'}`,
                `Attack: ${stats.attack ?? 'unknown'}`,
                `Defense: ${stats.defense ?? 'unknown'}`,
                `Special Attack: ${stats.special_attack ?? 'unknown'}`,
                `Special Defense: ${stats.special_defense ?? 'unknown'}`,
                `Speed: ${stats.speed ?? 'unknown'}`
            ].join(' | ');

            const dexInfo = entry.in_hoenn_dex
                ? `National Dex: #${entry.national_dex} | Hoenn Dex: #${entry.hoenn_dex}`
                : `National Dex: #${entry.national_dex} | Hoenn Dex: none (post-game / National Dex species)`;

            const obtainabilityMethods = Array.isArray(entry.obtainability_methods) && entry.obtainability_methods.length > 0
                ? entry.obtainability_methods.join(', ')
                : 'verified';

            const computedRange = requestedLevel
                ? computePlayerStatRange(entry, requestedLevel, activeNature)
                : null;

            const blockLines = [
                `Pokemon: ${entry.name}`,
                dexInfo,
                `Obtainability in Emerald: Obtainable in-game (${obtainabilityMethods})`,
                `Type (Generation III): ${types.join('/') || 'unknown'}`,
                `Abilities (Generation III): ${abilities.join(', ') || 'unknown'}`,
                `Ability effects (Generation III):\n${describeAbilities(entry)}`,
                `Base stats (Generation III): ${baseStats}`
            ];

            if (computedRange) {
                blockLines.push(computedRange);
            }

            blockLines.push(
                `Evolution: ${describeEvolution(entry)}`,
                `Defensive type matchups (calculated by the backend including ability modifiers): ${summarizeTypeMatchups(types, abilities)}`,
                `How to obtain in Emerald:\n${describeAvailability(entry)}`,
                `Move learnset: ${describeMoves(entry)}`
            );

            return blockLines.join('\n');
        });

        let text = `RELEVANT POKEMON DATA (Pokemon Emerald, Generation III):\n\n${blocks.join('\n\n')}`;

        if (found.length > shown.length) {
            const skipped = found.slice(shown.length).map(entry => entry.name).join(', ');
            text += `\n\nNOTE: Data for these mentioned Pokemon was not included to save space: ${skipped}. Do not guess their data.`;
        }

        text += `\n\nIMPORTANT:
- All attacking types that are not listed under "Weak to", "Resists" or "Immune to" deal neutral (1x) damage.
- STAB (Same-Type Attack Bonus) gives a ${emeraldMechanics.stabMultiplier || 1.5}x multiplier when a move's type matches one of the attacker's types.
- The multipliers and stat calculations were computed by the backend and are authoritative. Do not recalculate or contradict them.
- Use abilities, base stats, evolution, location and level information exactly as written.
- Do not invent missing or unknown data.
- Use ability effects and limitations exactly as provided. Never invent additional ability effects.`;

        sections.push(text);
    }

    if (unobtainable.length > 0) {
        sections.push(
            `UNOBTAINABLE GENERATION III POKEMON MENTIONED:\n` +
            unobtainable
                .map(name => `- ${name}: Exists in Generation III game data, but is NOT normally obtainable in-game in Pokemon Emerald (requires trading from another Gen III game or an external event).`)
                .join('\n')
        );
    }

    return sections.join('\n\n');
}

// ---------------------------------------------------------------------------
// Context voor het AI-model opbouwen
// ---------------------------------------------------------------------------
function buildContext(prompt) {
    const context = [];
    const gyms = emeraldGyms.gyms || [];
    const eliteFour = emeraldLeague.elite_four || [];
    const champion = emeraldLeague.champion;
    const activeOpponentTeams = [];

    const question = prompt.toLowerCase();

    // Algemene spelinformatie
    context.push(
        `GAME: ${emeraldGyms.game || 'Pokemon Emerald'}`,
        `REGION: ${emeraldGyms.region || 'Hoenn'}`
    );

    // Gym-voortgang automatisch uit de JSON halen
    if (gyms.length > 0) {
        const firstGym = gyms[0];
        const finalGym = gyms[gyms.length - 1];

        const gymOverview = gyms
            .map(gym =>
                `- Gym ${gym.number}: ${gym.leader} (${gym.location}, ${gym.type.join('/')}, Level cap: ${gym.level_cap})`
            )
            .join('\n');

        context.push(
            `GYM PROGRESSION:
There are exactly ${gyms.length} Gym Leaders in this game's knowledge base.
The first Gym Leader is ${firstGym.leader} in ${firstGym.location}.
The final Gym Leader is ${finalGym.leader} in ${finalGym.location}.
Gym ${finalGym.number} is the FINAL Gym. There is no Gym ${finalGym.number + 1}.

Complete Gym overview:
${gymOverview}`
        );
    }

    // Bepalen of de vraag over de Pokémon League gaat
    const isLeagueQuestion =
        question.includes('elite four') ||
        question.includes('elite 4') ||
        question.includes('pokemon league') ||
        question.includes('pokémon league') ||
        question.includes('victory road') ||
        question.includes('champion') ||
        question.includes('wallace') ||
        question.includes('sidney') ||
        question.includes('phoebe') ||
        question.includes('glacia') ||
        question.includes('drake') ||
        question.includes('after the 8th gym') ||
        question.includes('after the eighth gym');

    if (isLeagueQuestion && emeraldLeague) {
        const progressionText = (emeraldLeague.progression || [])
            .map(step => `- ${step}`)
            .join('\n');

        const eliteFourOverview = eliteFour
            .map(trainer =>
                `- ${trainer.number}. ${trainer.name} (${trainer.specialty}), highest level: ${trainer.highest_level}, Elite Four level cap: ${trainer.level_cap}`
            )
            .join('\n');

        const eliteFourCapRule =
            emeraldLeague.level_cap_rules?.elite_four?.description ||
            'No Elite Four level cap information is available.';

        const championCapRule =
            emeraldLeague.level_cap_rules?.champion?.description ||
            (champion
                ? `The player must not have any Pokemon above level ${champion.level_cap} before challenging Champion ${champion.name}.`
                : 'No Champion level cap information is available.');

        context.push(
            `POKEMON LEAGUE PROGRESSION:
${progressionText}

ELITE FOUR OVERVIEW:
${eliteFourOverview}

ELITE FOUR LEVEL CAP RULE:
${eliteFourCapRule}

CHAMPION LEVEL CAP RULE:
${championCapRule}

The Elite Four must be challenged in the order listed in the knowledge base.
The Elite Four level cap is based on the highest-level Pokemon used by the FINAL Elite Four member, Drake.
The same Elite Four level cap applies to all four Elite Four battles.`
        );

        if (champion) {
            const championTeam = (champion.team || [])
                .map(formatTrainerTeamMember)
                .join('\n');

            context.push(
                `CHAMPION DATA:
Champion: ${champion.name}
Specialty: ${champion.specialty}
Level cap: ${champion.level_cap}
Highest level: ${champion.highest_level}
Ace Pokemon: ${champion.ace}
Trainer items: ${formatTrainerItems(champion.trainer_items)}

Champion team:
${championTeam}

IMPORTANT:
The Champion battle takes place immediately after defeating Drake.
The player is already inside the Pokemon League.
Do not say that the player must travel to or enter the Pokemon League again.`
            );
        }
    }

    // Specifieke Gym-gegevens toevoegen als er een match is
    const foundGym = findGym(prompt);

    if (foundGym) {
        activeOpponentTeams.push(foundGym.team);
        const teamText = foundGym.team
            .map(formatTrainerTeamMember)
            .join('\n');

        const typeMatchupsText = buildTeamMatchupsText(foundGym.team);

        context.push(
            `RELEVANT GYM DATA:
Gym: ${foundGym.number}
Leader: ${foundGym.leader}
Location: ${foundGym.location}
Type: ${foundGym.type.join(', ')}
Badge: ${foundGym.badge}
Level cap: ${foundGym.level_cap}
Battle format: ${foundGym.battle_format}
Trainer items: ${formatTrainerItems(foundGym.trainer_items)}

IMPORTANT:
Single battle means one active Pokemon per side at a time.
It does NOT mean the Gym Leader has only one Pokemon.

Opponent team:
${teamText}

DEFENSIVE TYPE MATCHUPS OF THIS TEAM (calculated by the backend with the Generation III type chart & ability modifiers):
${typeMatchupsText}

IMPORTANT:
- These multipliers and stats are authoritative. Do not recalculate, reinterpret or contradict them.
- Attacking types that are not listed under "Weak to", "Resists" or "Immune to" deal neutral (1x) damage.`
        );
    }

    // Specifieke Elite Four- of Championgegevens toevoegen
    const foundTrainer = findLeagueTrainer(prompt);

    if (foundTrainer) {
        const trainer = foundTrainer.trainer;
        activeOpponentTeams.push(trainer.team || []);

        const teamText = (trainer.team || [])
            .map(formatTrainerTeamMember)
            .join('\n');

        const typeMatchupsText = buildTeamMatchupsText(trainer.team);

        context.push(
            `RELEVANT POKEMON LEAGUE DATA:
Trainer: ${trainer.name}
Category: ${foundTrainer.type === 'champion' ? 'Champion' : 'Elite Four'}
Specialty: ${trainer.specialty}
Highest level: ${trainer.highest_level}
Level cap: ${trainer.level_cap}
Ace Pokemon: ${trainer.ace}
Trainer items: ${formatTrainerItems(trainer.trainer_items)}

Opponent team:
${teamText}

DEFENSIVE TYPE MATCHUPS OF THIS TEAM (calculated by the backend with the Generation III type chart & ability modifiers):
${typeMatchupsText}

IMPORTANT:
- These multipliers and stats are authoritative. Do not recalculate, reinterpret or contradict them.
- Attacking types that are not listed under "Weak to", "Resists" or "Immune to" deal neutral (1x) damage.
- A 4x multiplier means 4x damage, not 2x. A 0.25x multiplier means one quarter damage.`
        );
    }

    // Specifieke Boss Battles (Team Magma, Team Aqua, Wally, Rival)
    const foundBosses = findBossTrainers(prompt);

    if (foundBosses.length > 0) {
        const shownBosses = foundBosses.slice(0, MAX_BOSS_BATTLES);
        shownBosses.forEach(boss => activeOpponentTeams.push(boss.team || []));

        const bossBlocks = shownBosses.map(boss => {
            const teamText = (boss.team || [])
                .map(formatTrainerTeamMember)
                .join('\n');

            const typeMatchupsText = buildTeamMatchupsText(boss.team);
            const starterLine = boss.player_starter_variant
                ? `\nPlayer starter variant: ${boss.player_starter_variant}`
                : '';

            return `Boss: ${boss.name} (${boss.role} - ${boss.group})
Battle location: ${boss.battle_context}${starterLine}
Battle format: ${boss.battle_format} | Highest level: ${boss.highest_level}
Trainer items: ${formatTrainerItems(boss.trainer_items)}

Opponent team:
${teamText}

Defensive type matchups of this team:
${typeMatchupsText}`;
        });

        let bossText = `RELEVANT BOSS TRAINER DATA (Pokemon Emerald, Generation III):\n\n${bossBlocks.join('\n\n---\n\n')}`;

        if (foundBosses.length > shownBosses.length) {
            const remaining = foundBosses
                .slice(shownBosses.length)
                .map(b => `${b.name} (${b.battle_context}${b.player_starter_variant ? ` - Starter ${b.player_starter_variant}` : ''})`)
                .join(', ');
            bossText += `\n\nNOTE: Additional matching boss battles omitted for space: ${remaining}. Ask the user which specific location or starter variant they are facing if needed.`;
        }

        bossText += `\n\nIMPORTANT:
- Use the exact opponent movesets, held items, levels, calculated stats and defensive type matchups listed above.
- Do not invent moves or items that are not listed.`;

        context.push(bossText);
    }

    // Specifieke reguliere trainers toevoegen
    const foundRegularTrainers = findRegularTrainers(prompt);

    if (foundRegularTrainers.length > 0) {
        foundRegularTrainers.forEach(t => activeOpponentTeams.push(t.team || []));
        const regularTrainerBlocks = foundRegularTrainers.map(formatRegularTrainer);

        context.push(
            `RELEVANT REGULAR TRAINER DATA (Pokemon Emerald, Generation III):

${regularTrainerBlocks.join('\n\n')}

IMPORTANT:
- Use the exact Pokemon, levels, moves and held items listed above.
- Do not invent moves, items or Pokemon that are not listed.
- These are regular trainer battles, not Gym Leader, Elite Four or Boss battles.`
        );
    }

    // Specifieke Pokémon uit de Pokémon-kennisbank
    const pokemonContext = buildPokemonContext(prompt);

    if (pokemonContext) {
        context.push(pokemonContext);
    }

    // Specifieke abilities uit de ability-kennisbank
    const abilityContext = buildAbilityContext(prompt);

    if (abilityContext) {
        context.push(abilityContext);
    }

    // Battle mechanics, Natures, status-effecten en move-multipliers
    const battleMechanicsContext = buildBattleMechanicsContext(prompt, activeOpponentTeams);

    if (battleMechanicsContext) {
        context.push(battleMechanicsContext);
    }

    // Reikwijdte van de Pokémon-kennisbank
    if (emeraldPokemon.pokemon.length > 0) {
        context.push(
            `POKEMON KNOWLEDGE BASE SCOPE:
All ${emeraldPokemon.pokemon.length} Pokemon normally obtainable in-game in Pokemon Emerald are loaded in the knowledge base, plus ${emeraldPokemon.unobtainable_in_emerald.length} Generation III species that are unobtainable in Emerald without external trading or events.
- If a Pokemon appears under "UNOBTAINABLE GENERATION III POKEMON MENTIONED", state clearly that it exists in Generation III, but cannot be obtained normally in-game in Pokemon Emerald.
- If a user asks about a Pokemon that is not listed in the context at all (such as Generation IV or later species like Lucario or Torterra), state clearly that it is not available in Pokemon Emerald (Generation III).`
        );
    }

    // Generation III damage categories & STAB
    const physicalTypes =
        emeraldMechanics.damageCategories?.Physical?.join(', ') || 'unknown';

    const specialTypes =
        emeraldMechanics.damageCategories?.Special?.join(', ') || 'unknown';

    context.push(`GENERATION III DAMAGE CATEGORIES & STAB:
Physical types: ${physicalTypes}
Special types: ${specialTypes}
STAB (Same-Type Attack Bonus): ${emeraldMechanics.stabMultiplier || 1.5}x damage when a move's type matches one of the attacking Pokemon's types.

IMPORTANT:
In Generation III, Physical/Special classification is determined by the move's type, not by the individual move.
Physical moves use Attack and Defense.
Special moves use Special Attack and Special Defense.
Do not apply the Physical/Special split introduced in Generation IV.`);

    // Nuzlocke-regels toevoegen
    if (nuzlockeRules.rules?.length > 0) {
        const rulesText = nuzlockeRules.rules
            .map(rule => `- ${rule}`)
            .join('\n');

        context.push(
            `NUZLOCKE RULESET: ${nuzlockeRules.variant || 'Custom Nuzlocke'}\n${rulesText}`
        );
    }

    return context.join('\n\n');
}

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------
function buildSystemPrompt(dynamicContext) {
    return {
        role: 'system',
        content: `You are Nuzlocke Mate, a reliable and supportive Pokémon Nuzlocke coach.

YOUR ROLE:
Help players make informed decisions during their Nuzlocke runs. Explain strategies, risks, counters and possible options. The player always makes the final decision.


FACTUAL ACCURACY RULES:
1. Use the provided GAME CONTEXT as the primary and authoritative source for all game-specific facts about Pokemon Emerald.
2. The GAME CONTEXT is not a complete database of the entire game. It only contains the information explicitly provided to you.
3. Never invent, guess, assume or speculate about game-specific facts.
4. If requested information is missing from the GAME CONTEXT, clearly state that the knowledge base does not contain verified information about it.
5. When information is missing, STOP. Do not follow up with guesses, possible answers, likely answers, examples or speculative alternatives.
6. This rule applies especially to Pokemon movesets, held items, encounter locations, encounter rates, wild Pokemon, trainer teams, levels and battle strategies.
7. Never generate a Pokemon moveset or held item list unless that exact information is available in the GAME CONTEXT.
8. Never claim that a Pokemon, move, item or location is available in Pokemon Emerald unless this is verified by the GAME CONTEXT.
9. Never use information from other Pokemon generations to fill gaps in the Pokemon Emerald knowledge base.
10. Never present general Pokemon knowledge as verified Pokemon Emerald information.
11. You may provide general coaching advice, but never use general Pokemon knowledge to fill gaps in the game knowledge base. General advice must not introduce unverified Pokemon, moves, abilities, items, locations or battle mechanics.
12. If you are uncertain about a type matchup, move, ability or game mechanic, do not guess. State that you cannot verify it.
13. Follow the provided Nuzlocke ruleset exactly. Do not assume additional rules or restrictions.
14. When discussing a Gym battle, use the exact team, levels, level cap and battle format provided in the GAME CONTEXT.
15. Pokemon Emerald has exactly 8 Gyms.
16. Juan is the 8th and final Gym Leader in Sootopolis City.
17. Tate & Liza are the 7th Gym Leaders, not the final Gym Leaders.
18. The Pokemon League is located in Ever Grande City and is reached after Victory Road.
19. The Elite Four must be challenged in this exact order: Sidney, Phoebe, Glacia and Drake.
20. The Elite Four level cap is 55, based on Drake's level 55 Salamence. This single cap applies to all four Elite Four battles.
21. After defeating Drake, the player immediately proceeds to the Champion battle against Wallace.
22. The player is already inside the Pokemon League when battling the Elite Four. Do not describe the player as entering or traveling to the Pokemon League after defeating Drake.
23. Wallace is the Champion of Pokemon Emerald, not an Elite Four member.
24. Wallace's highest-level Pokemon is Milotic at level 58. The Champion level cap is 58.
25. Use the provided Pokemon League data for all Elite Four and Champion teams, levels and types.
26. Never let previous assistant messages override verified information in the current GAME CONTEXT.
27. Previous assistant messages are not a reliable source of Pokemon game information. If a previous answer contains information that is not verified by the current GAME CONTEXT, do not repeat it as fact.
28. Use the provided Generation III type chart and backend-calculated ability modifiers for all type effectiveness explanations.
29. Never guess or calculate type effectiveness from memory when precomputed matchup information is available in the GAME CONTEXT.
30. A multiplier of 0 means immune, 0.5 means not very effective, 1 means neutral and 2 means super effective.
31. For dual-type Pokemon, type effectiveness is calculated by multiplying both defensive type multipliers, adjusted for abilities such as Levitate or Thick Fat.
32. Follow the Generation III Physical/Special type categories provided in the GAME CONTEXT.
33. Never use the Generation IV move-based Physical/Special classification.
34. Do not recommend Pokemon from other generations or Pokemon that are not verified as available in Pokemon Emerald.
35. The backend calculates all type effectiveness multipliers, STAB rules, and Gen III stat figures. Treat these calculations as authoritative.
36. Never independently calculate type effectiveness or stats when backend calculations are provided.
37. Never contradict or change a multiplier or stat figure provided in the GAME CONTEXT.
38. When explaining a matchup, use the exact multiplier from the GAME CONTEXT.
39. Do not invent explanations for type matchups.
40. Do not provide examples of Pokemon moves unless those moves are verified in the GAME CONTEXT.
41. Do not provide examples of Pokemon or move availability unless verified in the GAME CONTEXT.
42. When discussing Generation III damage categories, only list the categories and types provided by the backend. Do not invent move examples.
43. The knowledge base covers all Pokemon normally obtainable in Pokemon Emerald as well as Generation III species that are unobtainable without external trades or events. If a Pokemon is marked as unobtainable in Emerald, state that it cannot be obtained normally in-game. If a asked-about Pokemon is not in the database at all (such as Generation IV+ Pokemon), state that it is not available in Pokemon Emerald (Generation III).
44. If the GAME CONTEXT says a move learnset is NOT YET RESEARCHED, do not list, suggest or guess any moves for that Pokemon.
45. Use evolution, location, level and encounter information exactly as written in the GAME CONTEXT.
46. NEVER invent or provide examples of Pokemon, moves, abilities, items or battle mechanics unless the specific example and its relevant properties are explicitly verified in the GAME CONTEXT.
47. When explaining an ability, explain ONLY the effects and limitations explicitly listed in the GAME CONTEXT. Do not add example moves or Pokemon to illustrate the effect unless those examples are explicitly verified.
48. Never guess what a move does, what effect it has on a stat, or whether it interacts with an ability. If move information is missing, do not mention specific moves.
49. Never invent Pokemon examples to explain ability limitations. For example, if an ability does not affect Pokemon with Levitate, do not name a Pokemon as an example unless its ability is verified in the GAME CONTEXT.
50. All strategic recommendations must be consistent with the verified type matchups, abilities, moves and other battle information in the GAME CONTEXT. Never recommend an action that contradicts this information.
51. If a strategic recommendation requires information that is missing from the GAME CONTEXT, explain that the information is not verified instead of guessing.
52. NEVER name a specific Pokemon as an example unless its relevant type or ability is explicitly verified in the GAME CONTEXT.
53. When the player asks which Pokemon can escape an ability, explain only the verified categories if individual Pokemon data is unavailable. Do not invent Pokemon examples.
54. Always distinguish between the Pokemon using an ability and the opposing Pokemon affected by that ability. Never confuse whose stats or actions are affected.
55. An ability only provides the effects explicitly listed in its knowledge base entry. Do not infer additional protections, immunities or interactions.
56. When giving battle advice, use verified type matchups as the basis for recommendations. Do not recommend specific moves or Pokemon unless their relevant information is verified.
57. If the available information is sufficient to answer only part of a question, answer that part and clearly identify what cannot be verified.


MISSING INFORMATION RESPONSE:
When the player asks for information that is not available in the GAME CONTEXT:
- Briefly explain that this information is not yet verified in the knowledge base.
- Do not provide guesses or speculative alternatives.
- Do not add an unverified strategy tip.
- You may suggest adding the missing information to the knowledge base.


COACHING STYLE:
- Be friendly, casual and supportive.
- Explain why a strategy could work.
- Discuss risks and alternatives instead of presenting one option as guaranteed.
- Ask for the player's team or available Pokémon when that information is needed.
- Keep the player's rules and preferences in mind.

GAME CONTEXT:
${dynamicContext || 'No specific game information was found for this question.'}`
    };
}

function findRecentKnowledgeEntity(prompt, messages) {
    const question = normalizeText(prompt);

    const isFollowUp =
        /\b(it|its|they|their|them|this|that|these|those)\b/.test(question) ||
        question.includes('what about') ||
        question.includes('does it also') ||
        question.includes('and its');

    if (!isFollowUp) return null;

    if (
        findPokemon(prompt).length > 0 ||
        findUnobtainablePokemon(prompt).length > 0 ||
        findAbilities(prompt).length > 0
    ) {
        return null;
    }

    const previousMessages = (messages || [])
        .filter(message => message.role === 'user')
        .slice(0, -1)
        .reverse();

    for (const message of previousMessages) {
        const previousPokemon = findPokemon(message.content || '');
        const previousAbilities = findAbilities(message.content || '');

        if (previousPokemon.length > 0 && previousAbilities.length > 0) {
            return null;
        }

        if (previousPokemon.length > 0) {
            return {
                type: 'pokemon',
                entry: previousPokemon[previousPokemon.length - 1]
            };
        }

        if (previousAbilities.length > 0) {
            return {
                type: 'ability',
                entry: previousAbilities[previousAbilities.length - 1]
            };
        }
    }

    return null;
}

function buildKnowledgeAnswer(prompt, messages = []) {
    const question = normalizeText(prompt);

    const recentEntity = findRecentKnowledgeEntity(prompt, messages);

    const currentAbilities = findAbilities(prompt);
    const currentPokemon = findPokemon(prompt);
    const currentUnobtainable = findUnobtainablePokemon(prompt);

    const abilities = currentAbilities.length > 0
        ? currentAbilities
        : recentEntity?.type === 'ability'
            ? [recentEntity.entry]
            : [];

    const pokemon = currentPokemon.length > 0
        ? currentPokemon
        : recentEntity?.type === 'pokemon'
            ? [recentEntity.entry]
            : [];

    // -------------------------------------------------------
    // 0. Niet-verkrijgbare Generation III Pokémon (zoals Nidoran-M)
    // -------------------------------------------------------
    if (currentUnobtainable.length > 0 && pokemon.length === 0) {
        const names = currentUnobtainable.join(', ');
        return `${names} exists in Generation III game data, but is not normally obtainable in-game in Pokemon Emerald (it requires trading from another Generation III game or an external event).`;
    }

    // -------------------------------------------------------
    // 0b. Pokémon uit Generatie IV of later (zoals Lucario)
    // -------------------------------------------------------
    const outOfGenPokemon = findOutOfGenerationPokemon(prompt);

    if (outOfGenPokemon.length > 0 && pokemon.length === 0) {
        const list = outOfGenPokemon
            .map(p => `${p.name} (Generation ${p.generation}, National Dex #${p.national_dex})`)
            .join(', ');

        return `${list} is not available in Pokemon Emerald. Pokemon Emerald is a Generation III game and only includes Pokemon up to National Dex #386.`;
    }

    // -------------------------------------------------------
    // 1. Welke Pokemon kunnen ontsnappen aan een ability?
    // -------------------------------------------------------
    const asksEscape =
        question.includes('escape') ||
        question.includes('avoid') ||
        question.includes('switch out') ||
        question.includes('flee');

    if (asksEscape && abilities.length > 0) {
        const ability = abilities[0];

        if (ability.data_status !== 'verified') {
            return `The effects of ${ability.name} have not yet been verified in the knowledge base.`;
        }

        const limitations = ability.limitations || [];

        if (limitations.length === 0) {
            return `The knowledge base does not contain verified information about how Pokemon can escape ${ability.name}.`;
        }

        return [
            `In Pokemon Emerald, the verified limitations of ${ability.name} are:`,
            ...limitations.map(item => `- ${item}`),
            '',
            'Individual Pokemon examples are not available in the current knowledge base.'
        ].join('\n');
    }

    // -------------------------------------------------------
    // 2. Wat doet een ability?
    // -------------------------------------------------------
    const asksAbilityEffect =
        question.includes('what does') ||
        question.includes('what is') ||
        question.includes('effect of') ||
        question.includes('how does');

    if (asksAbilityEffect && abilities.length > 0) {
        const ability = abilities[0];

        if (ability.data_status !== 'verified') {
            return `The effects of ${ability.name} have not yet been verified in the knowledge base.`;
        }

        const lines = [
            `${ability.name} in Pokemon Emerald:`
        ];

        if (ability.effects?.battle) {
            lines.push(`Battle effect: ${ability.effects.battle}`);
        }

        if (ability.effects?.overworld) {
            lines.push(`Overworld effect: ${ability.effects.overworld}`);
        }

        if (ability.limitations?.length > 0) {
            lines.push(
                'Limitations:',
                ...ability.limitations.map(item => `- ${item}`)
            );
        }

        return lines.join('\n');
    }

    // -------------------------------------------------------
    // 3. Welke aanvalstypes zijn effectief tegen een Pokemon?
    // -------------------------------------------------------
    const asksTypeEffectiveness =
        question.includes('what type') ||
        question.includes('which type') ||
        question.includes('what attacks') ||
        question.includes('which attacks') ||
        question.includes('weak against') ||
        question.includes('super effective');

    if (asksTypeEffectiveness && pokemon.length > 0) {
        const target = pokemon[0];
        const types = target.types || [];
        const targetAbilities = target.abilities || [];

        if (types.length === 0) {
            return `Verified type information for ${target.name} is not available.`;
        }

        return [
            `${target.name} (${types.join('/')}) in Pokemon Emerald:`,
            summarizeTypeMatchups(types, targetAbilities),
            '',
            'These matchups are calculated by the backend using the Generation III type chart and ability modifiers.',
            'This answer covers attack types, not individual moves.'
        ].join('\n');
    }

    // -------------------------------------------------------
    // 4. Evolutie van een Pokemon
    // -------------------------------------------------------
    const asksEvolution =
        question.includes('evolution') ||
        question.includes('evolve') ||
        question.includes('evolves');

    if (asksEvolution && pokemon.length > 0) {
        const target = pokemon[0];

        const evolvesInto = emeraldPokemon.pokemon.filter(
            other => other.evolution?.from === target.name
        );

        if (!target.evolution?.from && evolvesInto.length === 0) {
            return `${target.name} does not evolve from or into any other Pokemon in Generation III.`;
        }

        return `${target.name}: ${describeEvolution(target)}`;
    }

    // -------------------------------------------------------
    // 5. Moves van een Pokemon
    // -------------------------------------------------------
    const asksMoves =
        question.includes('what moves') ||
        question.includes('which moves') ||
        question.includes('moves does') ||
        question.includes('move learnset') ||
        question.includes('learnset') ||
        question.includes('moves can it learn');

    if (asksMoves && pokemon.length > 0) {
        const target = pokemon[0];

        return [
            `Move information for ${target.name} in Pokemon Emerald:`,
            describeMoves(target)
        ].join('\n');
    }

    return null;
}

// ---------------------------------------------------------------------------
// Debug-endpoint
// ---------------------------------------------------------------------------
app.get('/debug/context', (req, res) => {
    const question = String(req.query.q || '').trim();

    if (!question) {
        return res.status(400).json({
            error: 'Gebruik /debug/context?q=jouw vraag'
        });
    }

    const unsupported = isUnsupportedGameQuestion(question);

    res.json({
        question,
        unsupportedGame: unsupported,
        context: unsupported ? null : buildContext(question)
    });
});

// ---------------------------------------------------------------------------
// Chat endpoint
// ---------------------------------------------------------------------------
app.post('/chat', async (req, res) => {
    try {
        const { messages } = req.body;

        if (!Array.isArray(messages) || messages.length === 0) {
            return res.status(400).json({
                error: 'Er zijn geen geldige chatberichten ontvangen.'
            });
        }

        const lastMessage = messages[messages.length - 1];

        if (!lastMessage || typeof lastMessage.content !== 'string') {
            return res.status(400).json({
                error: 'Het laatste chatbericht is ongeldig.'
            });
        }

        if (isUnsupportedGameQuestion(lastMessage.content)) {
            return res.json({
                reply: "My current databank only supports Pokémon Emerald. Please use the internet to search what you're looking for."
            });
        }

        const knowledgeAnswer = buildKnowledgeAnswer(lastMessage.content, messages);

        if (knowledgeAnswer) {
            return res.json({
                reply: knowledgeAnswer
            });
        }

        const dynamicContext = buildContext(lastMessage.content);

        console.log('GAME CONTEXT:');
        console.log(dynamicContext);

        const systemPrompt = buildSystemPrompt(dynamicContext);

        const cleanHistory = messages
            .filter(
                message =>
                    message.role !== 'system' &&
                    ['user', 'assistant'].includes(message.role)
            )
            .slice(-MAX_HISTORY_MESSAGES);

        const allMessages = [systemPrompt, ...cleanHistory];

        const response = await fetch(OLLAMA_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: OLLAMA_MODEL,
                messages: allMessages,
                stream: false,
                think: true,
                options: {
                    num_predict: NUM_PREDICT,
                    num_ctx: NUM_CTX
                }
            })
        });

        if (!response.ok) {
            const errorText = await response.text();

            console.error('Ollama HTTP-fout:', response.status, errorText);

            return res.status(502).json({
                error: 'Ollama kon geen antwoord genereren.'
            });
        }

        const data = await response.json();

        console.log('Ollama status:', response.status);
        console.log('Ollama done_reason:', data.done_reason);
        console.log(
            `Tokens: prompt=${data.prompt_eval_count}, gegenereerd=${data.eval_count} (num_ctx=${NUM_CTX}, num_predict=${NUM_PREDICT})`
        );
        console.log('Ollama message:', data.message);

        if (data.prompt_eval_count && data.prompt_eval_count > NUM_CTX * 0.9) {
            console.warn(
                'WAARSCHUWING: de prompt vult bijna het hele contextvenster. Vergroot NUM_CTX of verklein de context.'
            );
        }

        if (data.done_reason === 'length') {
            console.warn(
                'WAARSCHUWING: het antwoord is afgekapt door num_predict. Het denken kan alle tokens hebben opgebruikt.'
            );
        }

        const reply = data.message?.content;

        if (typeof reply !== 'string' || !reply.trim()) {
            console.error('Ollama gaf geen antwoordtekst terug:', data);

            return res.status(502).json({
                error:
                    data.done_reason === 'length'
                        ? 'Het model had niet genoeg tokens om een antwoord te geven. Probeer het opnieuw of verhoog num_predict.'
                        : 'Ollama heeft geen antwoordtekst teruggegeven.'
            });
        }

        res.json({ reply });

    } catch (error) {
        console.error('Fout in server.js:', error);

        res.status(500).json({
            error: 'Interne fout in de backend.'
        });
    }
});

app.listen(PORT, () => {
    console.log(`Nuzlocke Mate backend draait op http://localhost:${PORT}`);
});