const fs = require('fs');
const path = require('path');

const OUTPUT_PATH = path.join(
    __dirname,
    '..',
    'data',
    'pokemon',
    'emerald-abilities.json'
);

const GEN3_ABILITIES = [
    {
        name: 'Stench',
        battle: 'No battle effect in Generation III.',
        overworld: 'Halves the wild Pokemon encounter rate when the Pokemon is first in the party.',
        limitations: []
    },
    {
        name: 'Drizzle',
        battle: 'Summons permanent Rain upon entering battle until replaced by another weather effect.',
        overworld: null,
        limitations: []
    },
    {
        name: 'Speed Boost',
        battle: 'Raises Speed by +1 stage at the end of each turn.',
        overworld: null,
        limitations: ['Does not activate on the turn the Pokemon switches in.']
    },
    {
        name: 'Battle Armor',
        battle: 'Protects the Pokemon from critical hits.',
        overworld: null,
        limitations: []
    },
    {
        name: 'Sturdy',
        battle: 'Blocks one-hit KO moves (Fissure, Guillotine, Horn Drill, Sheer Cold).',
        overworld: null,
        limitations: ['In Generation III, Sturdy does NOT allow surviving regular fatal hits at 1 HP (that mechanic was added in Generation V).']
    },
    {
        name: 'Damp',
        battle: 'Prevents all Pokemon on the field from using Selfdestruct or Explosion.',
        overworld: null,
        limitations: []
    },
    {
        name: 'Limber',
        battle: 'Prevents the Pokemon from becoming Paralyzed.',
        overworld: null,
        limitations: []
    },
    {
        name: 'Sand Veil',
        battle: 'Raises Evasion by 20% during a Sandstorm and grants immunity to Sandstorm damage.',
        overworld: 'Halves wild encounter rate during a Sandstorm when first in the party.',
        limitations: []
    },
    {
        name: 'Static',
        battle: '30% chance to Paralyze an attacker that makes physical contact.',
        overworld: 'Increases the chance of encountering Electric-type wild Pokemon when first in the party (Emerald).',
        limitations: []
    },
    {
        name: 'Volt Absorb',
        battle: 'Grants immunity to Electric-type moves and restores up to 25% of max HP when hit by one.',
        overworld: null,
        limitations: []
    },
    {
        name: 'Water Absorb',
        battle: 'Grants immunity to Water-type moves and restores up to 25% of max HP when hit by one.',
        overworld: null,
        limitations: []
    },
    {
        name: 'Oblivious',
        battle: 'Prevents the Pokemon from becoming infatuated (Attract).',
        overworld: null,
        limitations: ['Does not block Taunt or Intimidate in Generation III.']
    },
    {
        name: 'Cloud Nine',
        battle: 'Negates all active weather effects while the Pokemon is on the field.',
        overworld: null,
        limitations: []
    },
    {
        name: 'Compoundeyes',
        battle: 'Multiplies the accuracy of the user’s moves by 1.3x.',
        overworld: 'Increases the chance that wild Pokemon hold an item when first in the party (Emerald).',
        limitations: []
    },
    {
        name: 'Insomnia',
        battle: 'Prevents the Pokemon from falling asleep (including via Rest).',
        overworld: null,
        limitations: []
    },
    {
        name: 'Color Change',
        battle: 'Changes the user’s type to match the type of the last damaging move that hit it.',
        overworld: null,
        limitations: []
    },
    {
        name: 'Immunity',
        battle: 'Prevents the Pokemon from being Poisoned or Badly Poisoned.',
        overworld: null,
        limitations: []
    },
    {
        name: 'Flash Fire',
        battle: 'Grants immunity to Fire-type moves and boosts the user’s own Fire-type attacks by 1.5x once hit by a Fire move.',
        overworld: null,
        limitations: ['Does not activate if the user is Frozen.']
    },
    {
        name: 'Shield Dust',
        battle: 'Blocks additional secondary effects of damaging moves (such as flinches, stat drops, or status chances) against the user.',
        overworld: null,
        limitations: ['Does not block standalone status moves like Thunder Wave or Toxic.']
    },
    {
        name: 'Own Tempo',
        battle: 'Prevents the Pokemon from becoming Confused.',
        overworld: null,
        limitations: []
    },
    {
        name: 'Suction Cups',
        battle: 'Prevents forced switches caused by Roar or Whirlwind.',
        overworld: 'Increases bite rate when fishing if first in the party (Emerald).',
        limitations: []
    },
    {
        name: 'Intimidate',
        battle: 'Lowers the Attack stat of all opposing active Pokemon by -1 stage (0.67x) upon entering battle.',
        overworld: 'Reduces wild encounters with lower-level Pokemon by 50% when first in the party (Emerald).',
        limitations: ['Blocked by Clear Body, White Smoke, and Hyper Cutter.']
    },
    {
        name: 'Shadow Tag',
        battle: 'Prevents grounded and non-grounded opposing Pokemon from switching out or fleeing.',
        overworld: null,
        limitations: ['In Generation III, even Ghost-types and other Shadow Tag users cannot switch out against Shadow Tag unless using Baton Pass.']
    },
    {
        name: 'Rough Skin',
        battle: 'Damages an attacker for 1/16 of its max HP when it makes physical contact.',
        overworld: null,
        limitations: []
    },
    {
        name: 'Wonder Guard',
        battle: 'Only super-effective damaging moves can hit this Pokemon; all neutral or resisted damaging moves deal 0 damage.',
        overworld: null,
        limitations: ['Does not block indirect damage from weather, status conditions, Leech Seed, Struggle, or Future Sight.']
    },
    {
        name: 'Levitate',
        battle: 'Grants complete immunity to Ground-type moves (0x), Spikes, and Arena Trap.',
        overworld: null,
        limitations: []
    },
    {
        name: 'Effect Spore',
        battle: '10% total chance to inflict Poison, Paralysis, or Sleep when hit by a contact move.',
        overworld: null,
        limitations: []
    },
    {
        name: 'Synchronize',
        battle: 'Passes Burn, Poison, or Paralysis back to the opponent that inflicted it.',
        overworld: '50% chance in Emerald for encountered wild Pokemon to have the same Nature as the lead Pokemon.',
        limitations: ['Does not pass Sleep or Freeze.']
    },
    {
        name: 'Clear Body',
        battle: 'Prevents opponents from lowering any of this Pokemon’s stats.',
        overworld: null,
        limitations: ['Does not prevent self-inflicted stat drops such as Overheat or Curse.']
    },
    {
        name: 'Natural Cure',
        battle: 'Cures non-volatile status conditions (Burn, Freeze, Paralysis, Poison, Sleep) upon switching out.',
        overworld: null,
        limitations: []
    },
    {
        name: 'Lightningrod',
        battle: 'In Double Battles, draws all single-target Electric-type moves to this Pokemon.',
        overworld: 'Increases trainer rematch calls in Emerald when first in the party.',
        limitations: ['In Generation III, Lightningrod does NOT grant immunity to Electric moves and does NOT boost Special Attack.']
    },
    {
        name: 'Serene Grace',
        battle: 'Doubles the probability of secondary effects on damaging moves.',
        overworld: null,
        limitations: []
    },
    {
        name: 'Swift Swim',
        battle: 'Doubles Speed (2.0x) during Rain.',
        overworld: null,
        limitations: []
    },
    {
        name: 'Chlorophyll',
        battle: 'Doubles Speed (2.0x) during Harsh Sunlight.',
        overworld: null,
        limitations: []
    },
    {
        name: 'Illuminate',
        battle: 'No battle effect.',
        overworld: 'Doubles the wild Pokemon encounter rate when first in the party.',
        limitations: []
    },
    {
        name: 'Trace',
        battle: 'Copies a random active opponent’s ability upon switching in.',
        overworld: null,
        limitations: ['Cannot copy Forecast or another Trace.']
    },
    {
        name: 'Huge Power',
        battle: 'Doubles the user’s Attack stat (2.0x) in battle.',
        overworld: null,
        limitations: []
    },
    {
        name: 'Poison Point',
        battle: '30% chance to Poison an attacker that makes physical contact.',
        overworld: null,
        limitations: []
    },
    {
        name: 'Inner Focus',
        battle: 'Prevents the Pokemon from flinching.',
        overworld: null,
        limitations: []
    },
    {
        name: 'Magma Armor',
        battle: 'Prevents the Pokemon from becoming Frozen.',
        overworld: 'Halves the number of steps required to hatch Eggs in the party (Emerald).',
        limitations: []
    },
    {
        name: 'Water Veil',
        battle: 'Prevents the Pokemon from becoming Burned.',
        overworld: null,
        limitations: []
    },
    {
        name: 'Magnet Pull',
        battle: 'Prevents opposing Steel-type Pokemon from switching out or fleeing.',
        overworld: 'Increases the chance of encountering Steel-type wild Pokemon when first in the party (Emerald).',
        limitations: ['Only traps Steel-type Pokemon; Baton Pass still allows switching.']
    },
    {
        name: 'Soundproof',
        battle: 'Grants immunity to sound-based moves (such as Perish Song, Sing, Supersonic, Screech, Uproar, Hyper Voice, and Roar).',
        overworld: null,
        limitations: ['In Generation III, Heal Bell also fails to cure a Soundproof ally.']
    },
    {
        name: 'Rain Dish',
        battle: 'Restores 1/16 of max HP at the end of each turn during Rain.',
        overworld: null,
        limitations: []
    },
    {
        name: 'Sand Stream',
        battle: 'Summons a permanent Sandstorm upon entering battle until replaced by another weather effect.',
        overworld: null,
        limitations: []
    },
    {
        name: 'Pressure',
        battle: 'Causes opposing moves targeting this Pokemon to consume 2 PP instead of 1.',
        overworld: 'Increases the chance of encountering higher-level wild Pokemon when first in the party (Emerald).',
        limitations: []
    },
    {
        name: 'Thick Fat',
        battle: 'Halves damage taken from Fire-type and Ice-type moves (0.5x multiplier).',
        overworld: null,
        limitations: []
    },
    {
        name: 'Early Bird',
        battle: 'Cuts Sleep duration in half (rounds down), allowing faster wake-up.',
        overworld: null,
        limitations: []
    },
    {
        name: 'Flame Body',
        battle: '30% chance to Burn an attacker that makes physical contact.',
        overworld: 'Halves the number of steps required to hatch Eggs in the party (Emerald).',
        limitations: []
    },
    {
        name: 'Run Away',
        battle: 'Guarantees fleeing from wild Pokemon battles.',
        overworld: null,
        limitations: ['Does not allow switching out against trapping moves or abilities like Shadow Tag or Mean Look.']
    },
    {
        name: 'Keen Eye',
        battle: 'Prevents opponents from lowering this Pokemon’s Accuracy.',
        overworld: 'Reduces wild encounters with lower-level Pokemon by 50% when first in the party (Emerald).',
        limitations: ['Does not ignore opponent Evasion boosts in Generation III.']
    },
    {
        name: 'Hyper Cutter',
        battle: 'Prevents opponents from lowering this Pokemon’s Attack stat (including via Intimidate).',
        overworld: 'Doubles the grass-cutting radius of HM01 Cut in Emerald.',
        limitations: []
    },
    {
        name: 'Pickup',
        battle: 'No battle effect in Generation III.',
        overworld: '10% chance after winning a battle to pick up a level-scaled item if not already holding one.',
        limitations: []
    },
    {
        name: 'Truant',
        battle: 'The Pokemon can only execute a move every second turn, loafing around on alternating turns.',
        overworld: null,
        limitations: []
    },
    {
        name: 'Hustle',
        battle: 'Boosts Attack by 1.5x, but reduces the accuracy of Physical moves to 80% (0.8x).',
        overworld: 'Increases the chance of encountering higher-level wild Pokemon when first in the party (Emerald).',
        limitations: []
    },
    {
        name: 'Cute Charm',
        battle: '30% chance to Infatuate an opposite-gender attacker that makes physical contact.',
        overworld: 'Increases encounters with opposite-gender wild Pokemon when first in the party (Emerald).',
        limitations: []
    },
    {
        name: 'Plus',
        battle: 'Boosts Special Attack by 1.5x in Double Battles if an active partner has Minus.',
        overworld: null,
        limitations: ['In Generation III, only pairs with Minus (not another Plus).']
    },
    {
        name: 'Minus',
        battle: 'Boosts Special Attack by 1.5x in Double Battles if an active partner has Plus.',
        overworld: null,
        limitations: ['In Generation III, only pairs with Plus (not another Minus).']
    },
    {
        name: 'Forecast',
        battle: 'Changes Castform’s type and form to Water in Rain, Fire in Harsh Sunlight, and Ice in Hail.',
        overworld: null,
        limitations: []
    },
    {
        name: 'Sticky Hold',
        battle: 'Prevents the Pokemon’s held item from being removed by Thief, Covet, Knock Off, or Trick.',
        overworld: 'Increases bite rate when fishing if first in the party (Emerald).',
        limitations: []
    },
    {
        name: 'Shed Skin',
        battle: '30% chance at the end of each turn to cure non-volatile status conditions.',
        overworld: null,
        limitations: []
    },
    {
        name: 'Guts',
        battle: 'Boosts Attack by 1.5x when Burned, Paralyzed, Poisoned, or Asleep, and ignores Burn’s 0.5x Physical attack drop.',
        overworld: null,
        limitations: []
    },
    {
        name: 'Marvel Scale',
        battle: 'Boosts Defense by 1.5x when affected by a non-volatile status condition.',
        overworld: null,
        limitations: []
    },
    {
        name: 'Liquid Ooze',
        battle: 'Damages attackers that use HP-draining moves (such as Leech Seed, Giga Drain, or Absorb) instead of healing them.',
        overworld: null,
        limitations: []
    },
    {
        name: 'Overgrow',
        battle: 'Multiplies the power of Grass-type moves by 1.5x when HP is at or below 1/3 of max HP.',
        overworld: null,
        limitations: []
    },
    {
        name: 'Blaze',
        battle: 'Multiplies the power of Fire-type moves by 1.5x when HP is at or below 1/3 of max HP.',
        overworld: null,
        limitations: []
    },
    {
        name: 'Torrent',
        battle: 'Multiplies the power of Water-type moves by 1.5x when HP is at or below 1/3 of max HP.',
        overworld: null,
        limitations: []
    },
    {
        name: 'Swarm',
        battle: 'Multiplies the power of Bug-type moves by 1.5x when HP is at or below 1/3 of max HP.',
        overworld: null,
        limitations: []
    },
    {
        name: 'Rock Head',
        battle: 'Prevents recoil damage from moves like Double-Edge, Take Down, and Submission.',
        overworld: null,
        limitations: ['Does not prevent Struggle recoil or Crash damage from Hi Jump Kick / Jump Kick.']
    },
    {
        name: 'Drought',
        battle: 'Summons permanent Harsh Sunlight upon entering battle until replaced by another weather effect.',
        overworld: null,
        limitations: []
    },
    {
        name: 'Arena Trap',
        battle: 'Prevents grounded opposing Pokemon from switching out or fleeing.',
        overworld: 'Doubles the wild Pokemon encounter rate when first in the party.',
        limitations: ['Does not trap Flying-type Pokemon or Pokemon with Levitate.']
    },
    {
        name: 'Vital Spirit',
        battle: 'Prevents the Pokemon from falling asleep (including via Rest).',
        overworld: 'Increases the chance of encountering higher-level wild Pokemon when first in the party (Emerald).',
        limitations: []
    },
    {
        name: 'White Smoke',
        battle: 'Prevents opponents from lowering any of this Pokemon’s stats.',
        overworld: 'Halves the wild Pokemon encounter rate when first in the party.',
        limitations: []
    },
    {
        name: 'Pure Power',
        battle: 'Doubles the user’s Attack stat (2.0x) in battle.',
        overworld: null,
        limitations: []
    },
    {
        name: 'Shell Armor',
        battle: 'Protects the Pokemon from critical hits.',
        overworld: null,
        limitations: []
    },
    {
        name: 'Air Lock',
        battle: 'Negates all active weather effects while the Pokemon is on the field.',
        overworld: null,
        limitations: []
    }
];

const formatted = GEN3_ABILITIES.map(item => ({
    name: item.name,
    generation: 3,
    data_status: 'verified',
    effects: {
        ...(item.battle ? { battle: item.battle } : {}),
        ...(item.overworld ? { overworld: item.overworld } : {})
    },
    limitations: item.limitations
}));

const output = {
    game: 'Pokemon Emerald',
    generation: 3,
    total_abilities: formatted.length,
    abilities: formatted
};

fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), 'utf8');
console.log(`Klaar! ${formatted.length} Generation III-abilities opgeslagen in ${OUTPUT_PATH}`);