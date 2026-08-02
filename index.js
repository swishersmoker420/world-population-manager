// World Population Manager - Stage 7: Parse raw AI output into structured NPCs (not saved as lorebooks yet)
import { extension_settings, getContext, loadExtensionSettings } from "../../../extensions.js";
import { saveSettingsDebounced, eventSource, event_types } from "../../../../script.js";

const extensionName = "world-population-manager";
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;

const defaultSettings = {
    enabled: false,
};

let lastActivatedWorldInfo = [];

if (event_types && event_types.WORLD_INFO_ACTIVATED) {
    eventSource.on(event_types.WORLD_INFO_ACTIVATED, (entries) => {
        lastActivatedWorldInfo = Array.isArray(entries) ? entries : [];
        console.log(`[${extensionName}] WI activation event fired:`, lastActivatedWorldInfo);
    });
} else {
    console.warn(`[${extensionName}] event_types.WORLD_INFO_ACTIVATED not found - this SillyTavern version may name it differently. Lorebook context will be empty until this is fixed.`);
}

async function loadSettings() {
    extension_settings[extensionName] = extension_settings[extensionName] || {};
    if (Object.keys(extension_settings[extensionName]).length === 0) {
        Object.assign(extension_settings[extensionName], defaultSettings);
    }
    $("#wpm_enabled").prop("checked", extension_settings[extensionName].enabled);
}

function onEnabledChange(event) {
    const value = Boolean($(event.target).prop("checked"));
    extension_settings[extensionName].enabled = value;
    saveSettingsDebounced();
    console.log(`[${extensionName}] Setting saved: enabled =`, value);
}

function openGeneratePopup() {
    $("#wpm_generate_popup").show();
}

function closeGeneratePopup() {
    $("#wpm_generate_popup").hide();
}

function getCharacterCardContext() {
    const context = getContext();
    const character = context.characters ? context.characters[context.characterId] : null;

    if (!character) {
        console.warn(`[${extensionName}] No character card found (context.characterId / context.characters empty).`);
        return null;
    }

    return {
        name: character.name,
        description: character.description,
        personality: character.personality,
        scenario: character.scenario,
        first_mes: character.first_mes,
        mes_example: character.mes_example,
        creator_notes: character.creatorcomment || character.creator_notes || null,
    };
}

function getChatHistoryContext(maxMessages = 50) {
    const context = getContext();
    const chat = context.chat || [];
    const recent = chat.slice(-maxMessages);

    return recent.map(m => ({
        name: m.name,
        is_user: m.is_user,
        mes: m.mes,
    }));
}

function getActivatedLorebookContext() {
    return lastActivatedWorldInfo.map(entry => ({
        world: entry.world,
        comment: entry.comment,
        content: entry.content,
        key: entry.key,
    }));
}

function gatherGenerationContext(count, instructions) {
    const characterCard = getCharacterCardContext();
    const chatHistory = getChatHistoryContext();
    const activatedLorebooks = getActivatedLorebookContext();

    return {
        count,
        instructions,
        characterCard,
        chatHistory,
        activatedLorebooks,
    };
}

const NPC_TEMPLATE = [
    "Name:",
    "Age:",
    "Height:",
    "Weight:",
    "Ethnicity:",
    "Religion:",
    "Hair:",
    "Skin:",
    "Figure:",
    "Accessories:",
    "Clothing style:",
    "Notable clothing combos:",
    "Speech:",
    "Other mannerisms:",
].join("\n");

const NPC_DELIMITER = "===NPC===";

function buildGenerationPrompt(generationContext) {
    const { count, instructions, characterCard, chatHistory, activatedLorebooks } = generationContext;

    const lines = [];

    lines.push("[SYSTEM OVERRIDE - DO NOT CONTINUE THE ROLEPLAY SCENE]");
    lines.push("You are not a character in this story right now. You are a data-generation tool.");
    lines.push("Ignore the current scene's events. Do not narrate, do not roleplay, do not write dialogue as any character.");
    lines.push("Your ONLY task is to invent background NPCs (non-player characters) who could plausibly exist in this world.");
    lines.push("");

    if (characterCard) {
        lines.push("--- WORLD / CHARACTER CARD CONTEXT (for tone and setting only) ---");
        if (characterCard.name) lines.push(`Main character: ${characterCard.name}`);
        if (characterCard.description) lines.push(`Description: ${characterCard.description}`);
        if (characterCard.scenario) lines.push(`Scenario: ${characterCard.scenario}`);
        lines.push("");
    }

    if (chatHistory && chatHistory.length > 0) {
        lines.push("--- RECENT CHAT (for tone, setting, and continuity only - do not continue it) ---");
        for (const m of chatHistory) {
            lines.push(`${m.name}: ${m.mes}`);
        }
        lines.push("");
    }

    if (activatedLorebooks && activatedLorebooks.length > 0) {
        lines.push("--- EXISTING CHARACTER EXAMPLES (match this style and level of detail) ---");
        for (const entry of activatedLorebooks) {
            lines.push(entry.content);
            lines.push("");
        }
    }

    lines.push("--- YOUR TASK ---");
    lines.push(`Generate exactly ${count} new NPC(s) who fit naturally into this world.`);
    lines.push("Follow these user instructions as your primary guidance:");
    lines.push(instructions && instructions.trim().length > 0 ? instructions : "(No special instructions given - use your best judgment for a believable, varied population.)");
    lines.push("");
    lines.push("Each NPC MUST use exactly this template, with every field filled in with a detailed, natural description:");
    lines.push(NPC_TEMPLATE);
    lines.push("");
    lines.push(`Separate each NPC with a line containing exactly: ${NPC_DELIMITER}`);
    lines.push("Output ONLY the NPCs in this format. No preamble, no summary, no narration, no commentary.");

    return lines.join("\n");
}

const NPC_TEMPLATE_FIELDS = [
    "Name",
    "Age",
    "Height",
    "Weight",
    "Ethnicity",
    "Religion",
    "Hair",
    "Skin",
    "Figure",
    "Accessories",
    "Clothing style",
    "Notable clothing combos",
    "Speech",
    "Other mannerisms",
];

function parseNpcBlocks(rawText) {
    if (!rawText || typeof rawText !== "string") {
        return [];
    }

    const blocks = rawText
        .split(NPC_DELIMITER)
        .map(b => b.trim())
        .filter(b => b.length > 0);

    return blocks.map(block => {
        const fields = {};
        const lines = block.split("\n");

        let currentField = null;
        for (const line of lines) {
            const match = line.match(/^([A-Za-z /]+):\s*(.*)$/);
            const matchedFieldName = match
                ? NPC_TEMPLATE_FIELDS.find(f => f.toLowerCase() === match[1].trim().toLowerCase())
                : null;

            if (matchedFieldName) {
                currentField = matchedFieldName;
                fields[currentField] = match[2].trim();
            } else if (currentField) {
                fields[currentField] += " " + line.trim();
            }
        }

        return {
            name: fields["Name"] || "Unnamed NPC",
            fields,
            rawContent: block,
        };
    });
}

async function onGenerateConfirm() {
    const count = Number($("#wpm_char_count").val());
    const instructions = String($("#wpm_generate_instructions").val());

    const generationContext = gatherGenerationContext(count, instructions);
    const prompt = buildGenerationPrompt(generationContext);

    console.log(`[${extensionName}] Full generation prompt being sent:`, prompt);
    closeGeneratePopup();
    toastr.info(`Generating ${count} NPC(s), this may take a moment. Check console for raw output.`, "World Population Manager");

    const context = getContext();

    try {
        const result = await context.generateQuietPrompt({
            quietPrompt: prompt,
            skipWIAN: true,
            quietToLoud: false,
        });
        console.log(`[${extensionName}] RAW generation output:`, result);

        const parsedNpcs = parseNpcBlocks(result);
        console.log(`[${extensionName}] Parsed ${parsedNpcs.length} NPC(s) (requested ${count}):`, parsedNpcs);

        toastr.success(`Parsed ${parsedNpcs.length}/${count} NPC(s). Check console to verify accuracy (not saved as lorebooks yet).`, "World Population Manager");
    } catch (error) {
        console.error(`[${extensionName}] Generation failed:`, error);
        toastr.error("Generation failed - check console.", "World Population Manager");
    }
}

async function onTestAiClick() {
    const context = getContext();

    if (typeof context.generateQuietPrompt !== "function") {
        console.warn(`[${extensionName}] context.generateQuietPrompt is not a function - hypothesis failed, need another approach.`);
        toastr.warning("generateQuietPrompt not found on context - check console for details.", "World Population Manager");
        return;
    }

    const testPrompt = [
        "[SYSTEM OVERRIDE - DO NOT CONTINUE THE ROLEPLAY SCENE]",
        "You are not a character in this story right now. You are a data-generation tool.",
        "Ignore everything happening in the current scene.",
        "Your ONLY task: output exactly one word and nothing else, no narration, no dialogue, no formatting: PONG",
    ].join("\n");

    console.log(`[${extensionName}] Sending stronger override test prompt to AI...`);
    toastr.info("Sending test prompt to the AI, check console...", "World Population Manager");

    try {
        const result = await context.generateQuietPrompt({
            quietPrompt: testPrompt,
            skipWIAN: true,
            quietToLoud: false,
        });
        console.log(`[${extensionName}] AI test response:`, result);
        toastr.success(`AI responded: ${String(result).slice(0, 200)}`, "World Population Manager - Test OK");
    } catch (error) {
        console.error(`[${extensionName}] generateQuietPrompt threw an error:`, error);
        toastr.error("generateQuietPrompt threw an error - check console.", "World Population Manager");
    }
}

jQuery(async () => {
    console.log(`[${extensionName}] Loading...`);

    try {
        const settingsHtml = await $.get(`${extensionFolderPath}/example.html`);
        $("#extensions_settings2").append(settingsHtml);

        $("#wpm_enabled").on("input", onEnabledChange);
        $("#wpm_generate_characters").on("click", openGeneratePopup);
        $("#wpm_generate_confirm").on("click", onGenerateConfirm);
        $("#wpm_generate_cancel").on("click", closeGeneratePopup);
        $("#wpm_test_ai").on("click", onTestAiClick);

        loadSettings();

        console.log(`[${extensionName}] ✅ Loaded successfully`);
    } catch (error) {
        console.error(`[${extensionName}] ❌ Failed to load:`, error);
    }
});
