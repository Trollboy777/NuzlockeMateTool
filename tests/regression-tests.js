const assert = require('node:assert/strict');

const BASE_URL = 'http://localhost:3000';

async function getContext(question, ruleset) {
    const url = new URL(`${BASE_URL}/debug/context`);
    url.searchParams.set('q', question);
    if (ruleset) {
        url.searchParams.set('ruleset', ruleset);
    }

    const res = await fetch(url);
    assert.equal(res.status, 200, `Debug endpoint gaf status ${res.status}`);
    return res.json();
}

async function askChat(question, ruleset) {
    const payload = {
        messages: [{ role: 'user', content: question }]
    };
    if (ruleset) {
        payload.ruleset = ruleset;
    }

    const res = await fetch(`${BASE_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    assert.equal(res.status, 200, `Chat endpoint gaf status ${res.status}`);
    const data = await res.json();
    return data.reply;
}

const tests = [
    {
        name: 'Context: Breloom bevat level-up én TM/HM moves',
        run: async () => {
            const data = await getContext('What moves can Breloom learn?');
            assert.match(data.context, /Level-up:.*Mach Punch/);
            assert.match(data.context, /TM:.*TM01 Focus Punch/);
        }
    },
    {
        name: 'Context: Shroomish heeft Petalburg Woods als vangstlocatie',
        run: async () => {
            const data = await getContext('Where can I catch Shroomish?');
            assert.match(data.context, /Petalburg Woods/i);
        }
    },
    {
        name: 'Context: Gym Leader Juan krijgt automatisch Water/Dragon voor Kingdra',
        run: async () => {
            const data = await getContext('What team does Juan have?');
            assert.match(data.context, /Kingdra \(Level 46 \| Type: Water\/Dragon/);
        }
    },
    {
        name: 'Chat: Nidoran-M wordt herkend als Gen III maar niet verkrijgbaar in Emerald',
        run: async () => {
            const reply = await askChat('Where can I catch Nidoran-M in Emerald?');
            assert.match(reply, /not normally obtainable/i);
            assert.doesNotMatch(reply, /Route \d+/i);
        }
    },
    {
        name: 'Chat: Lucario (Gen IV) wordt afgewezen voor Emerald',
        run: async () => {
            const reply = await askChat('Should I use Lucario against Norman in Emerald?');
            assert.match(reply, /not available|Generation III|not in Pokemon Emerald/i);
        }
    },
    {
        name: 'Chat: Geverifieerde ability (Effect Spore) geeft exact Gen III-effect',
        run: async () => {
            const reply = await askChat('What does Effect Spore do in Pokemon Emerald?');
            assert.match(reply, /10%.*Poison, Paralysis, or Sleep/i);
        }
    },
    {
        name: 'Context: Tate & Liza Claydol krijgt Ground-immuniteit door Levitate',
        run: async () => {
            const data = await getContext('How do I beat Tate & Liza?');
            assert.match(data.context, /Claydol \(Ground\/Psychic\):.*Immune to:.*Ground \(Levitate\)/);
        }
    },
    {
        name: 'Context: Level + Nature berekent Gen III stat-bereik (Jolly Grovyle Lv 24)',
        run: async () => {
            const data = await getContext('Can my level 24 Jolly Grovyle outspeed Wattson?');
            assert.match(data.context, /Calculated Gen III stat range at Level 24 \(Jolly nature/);
            assert.match(data.context, /Manectric[\s\S]*Calculated Gen III stats \(Lv\.24/);
        }
    },
    {
        name: 'Context: Paralysis en Dragon Dance krijgen exacte Gen III-multipliers',
        run: async () => {
            const data = await getContext('How does Paralysis affect Winona Dragon Dance Altaria?');
            assert.match(data.context, /Speed x0\.25|0\.25x/);
            assert.match(data.context, /Dragon Dance \(setup\): Raises user's Attack by \+1 stage \(1\.5x\) and Speed by \+1 stage \(1\.5x\)/);
        }
    },
    {
        name: 'Chat: Ander spel (Platinum) wordt direct geblokkeerd',
        run: async () => {
            const reply = await askChat('What is the level cap for Cynthia in Platinum?');
            assert.match(reply, /only supports Pokémon Emerald/i);
        }
    },
    {
        name: 'Context: Reguliere trainers in Petalburg Woods worden herkend zonder rematches',
        run: async () => {
            const data = await getContext(
                'Which trainers will I encounter in Petalburg Woods?'
            );

            assert.match(data.context, /Team Aqua Grunt/);
            assert.match(data.context, /Bug Catcher Lyle/);
            assert.match(data.context, /Bug Catcher James/);

            // Rematchteams mogen niet in de standaardcontext voorkomen.
            assert.doesNotMatch(data.context, /Ninjask/);
            assert.doesNotMatch(data.context, /Level: 27/);
            assert.doesNotMatch(data.context, /Level: 29/);
            assert.doesNotMatch(data.context, /Level: 31/);
            assert.doesNotMatch(data.context, /Level: 33/);
        }
    },
    {
        name: 'Context: Bug Catcher James geeft alleen zijn oorspronkelijke team',
        run: async () => {
            const data = await getContext(
                'Tell me about Bug Catcher James in Petalburg Woods.'
            );

            assert.match(data.context, /Trainer: Bug Catcher James/);
            assert.match(data.context, /Nincada \(Level 6/);

            // Geen latere rematchteams.
            assert.doesNotMatch(data.context, /Ninjask/);
            assert.doesNotMatch(data.context, /Dustox/);
        }
    },
    {
        name: 'Context: Expliciete vraag naar James rematches geeft alleen rematches',
        run: async () => {
            const data = await getContext(
                "What is Bug Catcher James's rematch team?"
            );

            assert.match(data.context, /Ninjask/);
            assert.match(data.context, /Dustox/);

            // Het oorspronkelijke team mag niet worden meegenomen.
            assert.doesNotMatch(data.context, /Nincada \(Level 6/);
        }
    },
    {
        name: 'Context: Rematches in Petalburg Woods bevatten alleen rematchtrainers',
        run: async () => {
            const data = await getContext(
                'Which rematches can I find in Petalburg Woods?'
            );

            assert.match(data.context, /Ninjask/);
            assert.match(data.context, /Dustox/);

            // Reguliere teams mogen niet worden meegenomen.
            assert.doesNotMatch(data.context, /Nincada \(Level 6/);
        }
    },

    // -----------------------------------------------------------------------
    // Nieuwe regressietests (Gen III Moves, EV/IV, Items, Standard/Hardcore)
    // -----------------------------------------------------------------------
    {
        name: 'Context: Gen III Move-details geven juiste Power, Accuracy en Physical/Special-split',
        run: async () => {
            const data = await getContext('Compare Shadow Ball and Crunch in Pokemon Emerald.');
            assert.match(data.context, /VERIFIED GENERATION III MOVE DATA:/);
            assert.match(data.context, /Shadow Ball \(Ghost, Physical \| Power: 80 \| Acc: 100%/);
            assert.match(data.context, /Crunch \(Dark, Special \| Power: 80 \| Acc: 100%/);
        }
    },
    {
        name: 'Context: Wattson laadt move-details + Sitrus Berry maar laat EV/IV-regels weg',
        run: async () => {
            const data = await getContext('How do I beat Wattson?');
            assert.match(data.context, /Quick Attack \(Normal, Physical \| Power: 40 \| Acc: 100% \| PP: 30 \| Priority: \+1\)/);
            assert.match(data.context, /Shock Wave \(Electric, Special \| Power: 60 \| Acc: — \| PP: 20\): Never misses\./);
            assert.match(data.context, /VERIFIED POKEMON EMERALD ITEM DATA:[\s\S]*Sitrus Berry:/);
            assert.doesNotMatch(data.context, /GENERATION III IV & EV MECHANICS:/);
        }
    },
    {
        name: 'Context: EV-vraag geeft exacte EV yield van Zigzagoon en Macho Brace-regels',
        run: async () => {
            const data = await getContext('What EV yield does Zigzagoon give and how does Macho Brace work?');
            assert.match(data.context, /GENERATION III IV & EV MECHANICS:/);
            assert.match(data.context, /Macho Brace doubles EVs gained/);
            assert.match(data.context, /Zigzagoon: \+1 speed \(Total: 1\)/);
        }
    },
    {
        name: 'Context: Vraag naar Speed EV training geeft verkrijgbare Emerald-Pokémon',
        run: async () => {
            const data = await getContext('Which Pokemon give Speed EVs in Emerald?');
            assert.match(data.context, /OBTAINABLE EMERALD POKEMON THAT YIELD SPEED EVs/);
            assert.match(data.context, /Zigzagoon \(\+1\)/);
        }
    },
    {
        name: 'Context: Items en TM-vindplaatsen worden herkend (Leftovers & TM26)',
        run: async () => {
            const data = await getContext('Where can I find Leftovers and TM26 in Emerald?');
            assert.match(data.context, /VERIFIED POKEMON EMERALD ITEM DATA:/);
            assert.match(data.context, /Leftovers:[\s\S]*S\.S\. Tidal/);
            assert.match(data.context, /TM26:[\s\S]*Seafloor Cavern/);
        }
    },
    {
        name: 'Context: Standard Nuzlocke is standaard zonder level caps',
        run: async () => {
            const data = await getContext('How do I beat Wattson?');
            assert.equal(data.ruleset, 'standard');
            assert.match(data.context, /NUZLOCKE RULESET: Standard Nuzlocke/);
            assert.match(data.context, /Highest level: 24/);
            assert.doesNotMatch(data.context, /Level cap:/i);
        }
    },
    {
        name: 'Context: Hardcore Nuzlocke schakelt level caps en item-verbod in (via parameter en prompt)',
        run: async () => {
            const byParam = await getContext('How do I beat Wattson?', 'hardcore');
            assert.equal(byParam.ruleset, 'hardcore');
            assert.match(byParam.context, /NUZLOCKE RULESET: Hardcore Nuzlocke/);
            assert.match(byParam.context, /Level cap: 24/);
            assert.match(byParam.context, /No items may be used from the bag during battle/);

            const byPrompt = await getContext('How do I beat Flannery in a hardcore nuzlocke?');
            assert.match(byPrompt.context, /NUZLOCKE RULESET: Hardcore Nuzlocke/);
            assert.match(byPrompt.context, /Level cap: 29/);
        }
    },
    {
        name: 'Context: Feebas is verkrijgbaar op Route 119 met hengels en 6-tile voorwaarde',
        run: async () => {
            const data = await getContext('Where can I catch Feebas?');
            assert.match(data.context, /Route 119/i);
            assert.match(data.context, /fishing_old_rod/);
            assert.match(data.context, /fishing_super_rod/);
            assert.match(data.context, /6 specific water tiles/i);
        }
    }
];

async function main() {
    let passed = 0;

    for (const test of tests) {
        try {
            await test.run();
            passed++;
            console.log(`[PASS] ${test.name}`);
        } catch (err) {
            console.error(`[FAIL] ${test.name}`);
            console.error(`       ${err.message}`);
        }
    }

    console.log(`\nResultaat: ${passed}/${tests.length} tests geslaagd.`);
    if (passed !== tests.length) process.exit(1);
}

main();