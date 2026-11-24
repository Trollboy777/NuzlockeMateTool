import test from "node:test";
import assert from "node:assert/strict";

const BASE_URL = "http://localhost:3000";

async function getContext(question) {
    const url = `${BASE_URL}/debug/context?q=${encodeURIComponent(question)}`;

    const response = await fetch(url);

    assert.equal(
        response.status,
        200,
        `Debug endpoint returned status ${response.status}`
    );

    return response.json();
}

test("Breloom has the correct Generation III typing", async () => {
    const data = await getContext("What type is Breloom?");

    assert.equal(data.unsupportedGame, false);
    assert.match(data.context, /Pokemon: Breloom/);
    assert.match(data.context, /Grass\/Fighting/);
    assert.match(data.context, /Flying 4x/);
});

test("Feebas has the correct Emerald location", async () => {
    const data = await getContext("Where can I catch Feebas?");

    assert.match(data.context, /Pokemon: Feebas/);
    assert.match(data.context, /Route 119/);
    assert.match(data.context, /six special water tiles/i);
});

test("Lucario is not incorrectly marked as unavailable", async () => {
    const data = await getContext("Is Lucario available in Emerald?");

    assert.match(data.context, /Only 26 species are currently loaded/);
    assert.match(data.context, /That does NOT mean it is unavailable/);
    assert.doesNotMatch(data.context, /Pokemon: Lucario/);
});

test("Treecko's unresearched learnset is identified", async () => {
    const data = await getContext("What moves does Treecko learn?");

    assert.match(data.context, /Pokemon: Treecko/);
    assert.match(data.context, /Move learnset: NOT YET RESEARCHED/);
});

test("Wallace has the correct Champion team", async () => {
    const data = await getContext("What team does Wallace have?");

    assert.match(data.context, /Champion: Wallace/);
    assert.match(data.context, /Wailord \(Level 57/);
    assert.match(data.context, /Tentacruel \(Level 55/);
    assert.match(data.context, /Whiscash \(Level 56/);
    assert.match(data.context, /Ludicolo \(Level 56/);
    assert.match(data.context, /Gyarados \(Level 56/);
    assert.match(data.context, /Milotic \(Level 58/);
    assert.match(data.context, /Level cap: 58/);
});

test("Emerald has exactly eight Gym Leaders", async () => {
    const data = await getContext("How many gyms are in Emerald?");

    assert.match(data.context, /exactly 8 Gym Leaders/);
    assert.match(data.context, /Juan/);
    assert.match(data.context, /There is no Gym 9/);
});

test("Generation III damage categories are included", async () => {
    const data = await getContext("How does physical and special damage work?");

    assert.match(data.context, /Physical types: Normal, Fighting/);
    assert.match(data.context, /Special types: Fire, Water/);
    assert.match(data.context, /not by the individual move/);
});


test("Breloom has the correct ability and base stats", async () => {
    const data = await getContext("What are Breloom's ability and base stats?");

    assert.match(data.context, /Abilities \(Generation III\): Effect Spore/);
    assert.match(data.context, /HP: 60/);
    assert.match(data.context, /Attack: 130/);
    assert.match(data.context, /Defense: 80/);
    assert.match(data.context, /Special Attack: 60/);
    assert.match(data.context, /Special Defense: 60/);
    assert.match(data.context, /Speed: 70/);
});

test("Aggron has the correct types, abilities and base stats", async () => {
    const data = await getContext("What are Aggron's stats and abilities?");

    assert.match(data.context, /Type \(Generation III\): Steel\/Rock/);
    assert.match(data.context, /Abilities \(Generation III\): Sturdy, Rock Head/);
    assert.match(data.context, /Defense: 180/);
});

test("Trapinch has both Generation III abilities", async () => {
    const data = await getContext("What abilities can Trapinch have?");

    assert.match(data.context, /Hyper Cutter, Arena Trap/);
});


test("Feebas evolves into Milotic through Beauty", async () => {
    const data = await getContext("How does Milotic evolve?");

    assert.match(data.context, /Pokemon: Milotic/);
    assert.match(data.context, /Evolution: Evolves from Feebas/);
    assert.match(data.context, /beauty/i);
});
