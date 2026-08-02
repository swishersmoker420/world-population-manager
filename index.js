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
