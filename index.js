// World Population Manager - Stage 5: Test AI connection (before real generation)
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

function onGenerateConfirm() {
    const count = Number($("#wpm_char_count").val());
    const instructions = String($("#wpm_generate_instructions").val());

    const generationContext = gatherGenerationContext(count, instructions);

    console.log(`[${extensionName}] Gathered generation context:`, generationContext);

    toastr.info(
        `Gathered context: character card ${generationContext.characterCard ? "✅" : "❌ (none)"}, ${generationContext.chatHistory.length} chat messages. Check console for details.`,
        "World Population Manager"
    );

    closeGeneratePopup();
}

async function onTestAiClick() {
    const context = getContext();

    if (typeof context.generateQuietPrompt !== "function") {
        console.warn(`[${extensionName}] context.generateQuietPrompt is not a function - hypothesis failed, need another approach.`);
        toastr.warning("generateQuietPrompt not found on context - check console for details.", "World Population Manager");
        return;
    }

    console.log(`[${extensionName}] Sending test prompt to AI via generateQuietPrompt...`);
    toastr.info("Sending test prompt to the AI, check console...", "World Population Manager");

    try {
        const result = await context.generateQuietPrompt("Reply with exactly one word: PONG");
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
});// World Population Manager - Stage 4: Gather real context (character card + chat history)
// Lorebook activation tracking is deliberately NOT included yet - see note below.
import { extension_settings, getContext, loadExtensionSettings } from "../../../extensions.js";
import { saveSettingsDebounced, eventSource, event_types } from "../../../../script.js";

const extensionName = "world-population-manager";
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;

const defaultSettings = {
    enabled: false,
};

// HYPOTHESIS TO TEST: SillyTavern emits an event when world info entries activate
// during generation, carrying the same entry objects we saw logged by world-info.js
// (uid, world, comment, content, key, etc). We listen for it here and stash the
// most recent batch. This needs to be confirmed against your actual SillyTavern
// version - watch the console for "[world-population-manager] WI activation event
// fired" and compare the count/content to the "[WI] Adding N entries to prompt"
// log line from world-info.js during your next generation.
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

// --- Context gathering ---

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

// Uses whatever the WORLD_INFO_ACTIVATED listener (above) most recently captured.
// If lastActivatedWorldInfo is empty, either nothing has activated yet this session,
// or the event hypothesis above didn't pan out - check the console warning at load time.
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

function onGenerateConfirm() {
    const count = Number($("#wpm_char_count").val());
    const instructions = String($("#wpm_generate_instructions").val());

    const generationContext = gatherGenerationContext(count, instructions);

    // For now, just log the full gathered context so we can verify it's correct
    // before wiring up the actual AI call in the next stage.
    console.log(`[${extensionName}] Gathered generation context:`, generationContext);

    toastr.info(
        `Gathered context: character card ${generationContext.characterCard ? "✅" : "❌ (none)"}, ${generationContext.chatHistory.length} chat messages. Check console for details.`,
        "World Population Manager"
    );

    closeGeneratePopup();
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

        loadSettings();

        console.log(`[${extensionName}] ✅ Loaded successfully`);
    } catch (error) {
        console.error(`[${extensionName}] ❌ Failed to load:`, error);
    }
});
