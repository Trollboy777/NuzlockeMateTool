const path = require('path');
const d = f => require(path.join(__dirname, '..', 'data', f));

const poke = d('pokemon/emerald-pokemon.json').pokemon;
const known = new Set(poke.map(p => p.name.toLowerCase()));
// keep in sync with EXTRA_GEN3_POKEMON_DATA in server.js
['meditite', 'lunatone', 'roselia', 'milotic', 'zangoose', 'medicham', 'surskit', 'masquerain', 'feebas'].forEach(n => known.add(n));

const teams = [];
d('trainers/emerald-trainers.json').trainers.forEach(t => teams.push([t.full_name || t.name, t.team]));
d('trainers/emerald-gyms.json').gyms.forEach(g => teams.push([g.leader, g.team]));
const league = d('trainers/emerald-pokemon-league.json');
league.elite_four.forEach(t => teams.push([t.name, t.team]));
if (league.champion) teams.push([league.champion.name, league.champion.team]);
d('trainers/emerald-boss-trainers.json').boss_trainers.forEach(b => teams.push([b.name, b.team]));

const missing = new Map();
for (const [owner, team] of teams) {
    for (const m of team || []) {
        if (!known.has(String(m.pokemon).toLowerCase())) {
            if (!missing.has(m.pokemon)) missing.set(m.pokemon, new Set());
            missing.get(m.pokemon).add(owner);
        }
    }
}
for (const [name, owners] of missing) {
    console.log(name.padEnd(12), [...owners].slice(0, 5).join(', '));
}
console.log(missing.size ? `\n${missing.size} opponent species lack stat/matchup data` : 'All opponent species covered');