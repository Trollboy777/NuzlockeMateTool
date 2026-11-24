const path = require('path');
const load = f => require(path.join(__dirname, '..', 'data', 'pokemon', f));

const poke = load('emerald-pokemon.json');
const avail = load('emerald-availability.json');
const dex = load('pokemon-national-dex.json');
const ev = load('emerald-ev-yields.json');

const pokeNames = new Set(poke.pokemon.map(p => p.name));
const unob = new Set(poke.unobtainable_in_emerald);
const availNames = new Set(avail.availability.map(a => a.pokemon));
const gen3 = dex.pokemon.filter(p => p.generation <= 3);

const report = (title, list) => {
    console.log(`\n== ${title} (${list.length}) ==`);
    list.forEach(x => console.log('  ' + x));
};

// 1. Declared counts vs real counts
console.log('pokemon_count field:', poke.pokemon_count, '| real:', poke.pokemon.length);
console.log('availability_count field:', avail.availability_count, '| real:', avail.availability.length);
console.log('data_scope says:', avail.data_scope);

// 2. In both lists (contradiction)
report('In pokemon AND unobtainable list', [...pokeNames].filter(n => unob.has(n)));

// 3. Availability entry exists but species is in the unobtainable list
report('Has availability entry BUT listed as unobtainable', [...availNames].filter(n => unob.has(n)));

// 4. Obtainable species with no availability entry
report('In emerald-pokemon but NO availability entry', [...pokeNames].filter(n => !availNames.has(n)));

// 5. Availability entry for a species not in emerald-pokemon
report('Availability entry but NOT in emerald-pokemon', [...availNames].filter(n => !pokeNames.has(n)));

// 6. Gen 1-3 species that appear in neither list
report('Gen 1-3 species in NEITHER list', gen3.map(p => p.name).filter(n => !pokeNames.has(n) && !unob.has(n)));

// 7. Names in your lists that don't exist in the national dex (typos)
const dexNames = new Set(dex.pokemon.map(p => p.name));
report('Names not found in national dex', [...pokeNames, ...unob].filter(n => !dexNames.has(n)));

// 8. Evolution-only species whose pre-evolution is not obtainable
report('Evolution entry but pre-evolution not obtainable',
    poke.pokemon.filter(p => p.evolution?.from && !pokeNames.has(p.evolution.from))
        .map(p => `${p.name} <- ${p.evolution.from}`));

// 9. hoenn_dex above the real regional range
report('hoenn_dex > 202 (check each)', poke.pokemon.filter(p => p.hoenn_dex > 202)
    .map(p => `${p.name} (#${p.hoenn_dex}, ${p.obtainability_methods.join(',')})`));

// 10. Availability methods that mention unsourced/suspicious text
report('Availability details mentioning "Johto"',
    avail.availability.filter(a => JSON.stringify(a).includes('Johto')).map(a => a.pokemon));

// 11. EV yields coverage
const evNames = new Set(ev.pokemon.map(e => e.name));
report('Obtainable species missing from EV yields', [...pokeNames].filter(n => !evNames.has(n)));