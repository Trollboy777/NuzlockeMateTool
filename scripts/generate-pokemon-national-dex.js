const fs = require('fs');
const path = require('path');

const POKEAPI_SPECIES_CSV_URL =
    'https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/pokemon_species.csv';

const OUTPUT_PATH = path.join(
    __dirname,
    '..',
    'data',
    'pokemon',
    'pokemon-national-dex.json'
);

// Uitzonderingen waarbij de schrijfwijze afwijkt van standaard spaties/hoofdletters
const NAME_OVERRIDES = {
    'nidoran-f': 'Nidoran-F',
    'nidoran-m': 'Nidoran-M',
    farfetchd: "Farfetch'd",
    sirfetchd: "Sirfetch'd",
    'mr-mime': 'Mr. Mime',
    'mr-rime': 'Mr. Rime',
    'mime-jr': 'Mime Jr.',
    'ho-oh': 'Ho-Oh',
    'porygon-z': 'Porygon-Z',
    'type-null': 'Type: Null',
    'jangmo-o': 'Jangmo-o',
    'hakamo-o': 'Hakamo-o',
    'kommo-o': 'Kommo-o',
    flabebe: 'Flabébé',
    'wo-chien': 'Wo-Chien',
    'chien-pao': 'Chien-Pao',
    'ting-lu': 'Ting-Lu',
    'chi-yu': 'Chi-Yu'
};

function formatSpeciesName(identifier) {
    if (NAME_OVERRIDES[identifier]) {
        return NAME_OVERRIDES[identifier];
    }

    return identifier
        .split('-')
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}

function parseSpeciesCsv(csvText) {
    const lines = csvText
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean);

    if (lines.length < 2) {
        throw new Error('CSV-bestand is leeg of ongeldig.');
    }

    const headers = lines[0].split(',');
    const idIndex = headers.indexOf('id');
    const identifierIndex = headers.indexOf('identifier');
    const generationIndex = headers.indexOf('generation_id');

    if (idIndex === -1 || identifierIndex === -1 || generationIndex === -1) {
        throw new Error(
            `Verwachte kolommen (id, identifier, generation_id) niet gevonden in header: ${lines[0]}`
        );
    }

    const speciesList = [];

    for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',');
        const nationalDex = Number(cols[idIndex]);
        const identifier = (cols[identifierIndex] || '').trim();
        const generation = Number(cols[generationIndex]);

        if (!Number.isFinite(nationalDex) || !identifier || !Number.isFinite(generation)) {
            continue;
        }

        speciesList.push({
            national_dex: nationalDex,
            name: formatSpeciesName(identifier),
            identifier,
            generation
        });
    }

    speciesList.sort((a, b) => a.national_dex - b.national_dex);
    return speciesList;
}

async function main() {
    console.log('Pokémon-soorten ophalen uit PokéAPI...');
    const response = await fetch(POKEAPI_SPECIES_CSV_URL);

    if (!response.ok) {
        throw new Error(`Kon pokemon_species.csv niet ophalen (HTTP ${response.status})`);
    }

    const csvText = await response.text();
    const pokemon = parseSpeciesCsv(csvText);

    if (pokemon.length < 900) {
        throw new Error(
            `Onverwacht laag aantal soorten ingelezen (${pokemon.length}). Bestand wordt niet overschreven.`
        );
    }

    const output = {
        source: 'PokeAPI (pokemon_species.csv)',
        total_species: pokemon.length,
        pokemon
    };

    fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), 'utf8');

    const lucario = pokemon.find(p => p.identifier === 'lucario');
    console.log(`Klaar! ${pokemon.length} Pokémon-soorten opgeslagen in ${OUTPUT_PATH}`);
    if (lucario) {
        console.log(
            `Controlecheck: ${lucario.name} (#${lucario.national_dex}, Generation ${lucario.generation})`
        );
    }
}

main().catch(error => {
    console.error('Genereren van pokemon-national-dex.json mislukt:', error.message);
    process.exit(1);
});