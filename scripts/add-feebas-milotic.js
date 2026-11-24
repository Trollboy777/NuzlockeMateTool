const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'data', 'pokemon');
const pokePath = path.join(dir, 'emerald-pokemon.json');
const availPath = path.join(dir, 'emerald-availability.json');

const poke = JSON.parse(fs.readFileSync(pokePath, 'utf8'));
const avail = JSON.parse(fs.readFileSync(availPath, 'utf8'));
fs.copyFileSync(pokePath, pokePath + '.bak');
fs.copyFileSync(availPath, availPath + '.bak');

const newPokemon = [
    {
        national_dex: 349,
        hoenn_dex: 140,
        in_hoenn_dex: true,
        obtainable_in_emerald: true,
        obtainability_methods: ['wild'],
        name: 'Feebas',
        types: ['Water'],
        abilities: ['Swift Swim'],
        base_stats: { hp: 20, attack: 15, defense: 20, special_attack: 10, special_defense: 55, speed: 80 },
        evolution: null,
        data_status: 'verified'
    },
    {
        national_dex: 350,
        hoenn_dex: 141,
        in_hoenn_dex: true,
        obtainable_in_emerald: true,
        obtainability_methods: ['evolution'],
        name: 'Milotic',
        types: ['Water'],
        abilities: ['Marvel Scale'],
        base_stats: { hp: 95, attack: 60, defense: 79, special_attack: 100, special_defense: 125, speed: 81 },
        evolution: { from: 'Feebas', method: 'beauty', condition: { minimum: 170 }, trigger: 'level_up' },
        data_status: 'verified'
    }
];

const feebasConditions = [
    'Only appears when fishing on 6 specific water tiles of Route 119; the tile positions are randomised per save file.',
    'Not every cast on those tiles produces a Feebas.'
];

const newAvailability = [
    {
        pokemon: 'Feebas',
        methods: ['fishing_old_rod', 'fishing_good_rod', 'fishing_super_rod'].map(method => ({
            method,
            locations: [{ location: 'Route 119', level_range: [20, 25] }],
            special_conditions: feebasConditions
        })),
        data_status: 'verified'
    },
    {
        pokemon: 'Milotic',
        methods: [
            {
                method: 'evolution',
                details: 'Evolve from Feebas by leveling up with a Beauty condition of at least 170 (raised with Pokeblocks).'
            }
        ],
        data_status: 'verified'
    }
];

function insertAfter(list, key, afterName, items) {
    const have = new Set(list.map(x => x[key]));
    const toAdd = items.filter(i => !have.has(i[key]));
    const idx = list.findIndex(x => x[key] === afterName);
    list.splice(idx >= 0 ? idx + 1 : list.length, 0, ...toAdd);
    return toAdd.length;
}

const addedP = insertAfter(poke.pokemon, 'name', 'Wigglytuff', newPokemon);
const addedA = insertAfter(avail.availability, 'pokemon', 'Wigglytuff', newAvailability);

poke.unobtainable_in_emerald = poke.unobtainable_in_emerald.filter(n => n !== 'Feebas' && n !== 'Milotic');
poke.pokemon_count = poke.pokemon.length;
avail.availability_count = avail.availability.length;

fs.writeFileSync(pokePath, JSON.stringify(poke, null, 2));
fs.writeFileSync(availPath, JSON.stringify(avail, null, 2));
console.log(`Added ${addedP} Pokemon, ${addedA} availability entries.`);
console.log(`pokemon: ${poke.pokemon.length}, unobtainable: ${poke.unobtainable_in_emerald.length}, availability: ${avail.availability.length}`);