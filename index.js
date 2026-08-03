// World Population Manager - Stage 8: Configurable character template fields
import { extension_settings, getContext, loadExtensionSettings } from "../../../extensions.js";
import { saveSettingsDebounced, eventSource, event_types } from "../../../../script.js";

const extensionName = "world-population-manager";
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;

const DEFAULT_FIELDS = [
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

const defaultSettings = {
    enabled: false,
    fields: DEFAULT_FIELDS.slice(),
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

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

async function loadSettings() {
    extension_settings[extensionName] = extension_settings[extensionName] || {};
    if (Object.keys(extension_settings[extensionName]).length === 0) {
        Object.assign(extension_settings[extensionName], {
            enabled: defaultSettings.enabled,
            fields: DEFAULT_FIELDS.slice(),
        });
    }
    if (!Array.isArray(extension_settings[extensionName].fields) || extension_settings[extensionName].fields.length === 0) {
        extension_settings[extensionName].fields = DEFAULT_FIELDS.slice();
    }

    $("#wpm_enabled").prop("checked", extension_settings[extensionName].enabled);
    renderFieldsList();
}

function onEnabledChange(event) {
    const value = Boolean($(event.target).prop("checked"));
    extension_settings[extensionName].enabled = value;
    saveSettingsDebounced();
    console.log(`[${extensionName}] Setting saved: enabled =`, value);
}

// --- Field management ---

function getCurrentFields() {
    return extension_settings[extensionName].fields || DEFAULT_FIELDS.slice();
}

function renderFieldsList() {
    const fields = getCurrentFields();
    const $list = $("#wpm_fields_list");
    $list.empty();

    fields.forEach((field, index) => {
        const $row = $(
            `<div class="wpm-field-row" data-index="${index}">
                <input type="text" class="wpm-field-name-input" value="${escapeHtml(field)}" />
                <input type="button" class="menu_button wpm-remove-field-btn" value="Remove" />
            </div>`
        );
        $list.append($row);
    });
}

function onFieldNameChange(event) {
    const index = Number($(event.target).closest(".wpm-field-row").data("index"));
    const newValue = String($(event.target).val()).trim();

    if (!newValue) {
        // Don't allow blank field names - revert display on next render
        toastr.warning("Field name can't be empty.", "World Population Manager");
        renderFieldsList();
        return;
    }

    extension_settings[extensionName].fields[index] = newValue;
    saveSettingsDebounced();
    console.log(`[${extensionName}] Field ${index} renamed to:`, newValue);
}

function onRemoveFieldClick(event) {
    const index = Number($(event.target).closest(".wpm-field-row").data("index"));
    const fields = extension_settings[extensionName].fields;

    if (fields.length <= 1) {
        toastr.warning("You need at least one field.", "World Population Manager");
        return;
    }

    const removed = fields.splice(index, 1);
    saveSettingsDebounced();
    renderFieldsList();
    console.log(`[${extensionName}] Field removed:`, removed[0]);
}

function onAddFieldClick() {
    const newFieldName = String($("#wpm_new_field_name").val()).trim();

    if (!newFieldName) {
        toastr.warning("Enter a field name first.", "World Population Manager");
        return;
    }

    const fields = extension_settings[extensionName].fields;
    const alreadyExists = fields.some(f => f.toLowerCase() === newFieldName.toLowerCase());

    if (alreadyExists) {
        toastr.warning(`Field "${newFieldName}" already exists.`, "World Population Manager");
        return;
    }

    fields.push(newFieldName);
    saveSettingsDebounced();
    $("#wpm_new_field_name").val("");
    renderFieldsList();
    console.log(`[${extensionName}] Field added:`, newFieldName);
}

function onResetFieldsClick() {
    extension_settings[extensionName].fields = DEFAULT_FIELDS.slice();
    saveSettingsDebounced();
    renderFieldsList();
    toastr.info("Fields reset to defaults.", "World Population Manager");
    console.log(`[${extensionName}] Fields reset to defaults.`);
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

const NPC_DELIMITER = "===NPC===";

function buildNpcTemplateText() {
    return getCurrentFields().map(f => `${f}:`).join("\n");
}

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
        lines.push("--- EXISTING CHARACTER EXAMPLES ---");
        lines.push("IMPORTANT: These examples may use a DIFFERENT field structure than your task below.");
        lines.push("Only copy their writing tone, level of detail, and vocabulary. Do NOT copy their field names or field structure.");
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
    lines.push("Each NPC MUST use EXACTLY this field structure and ONLY these fields, in this exact order, with every field filled in with a detailed, natural description:");
    lines.push(buildNpcTemplateText());
    lines.push("");
    lines.push("Do not add fields that aren't listed above. Do not omit any field listed above. Do not use any other template you may have seen in the examples above.");
    lines.push("");
    lines.push(`Separate each NPC with a line containing exactly: ${NPC_DELIMITER}`);
    lines.push("Output ONLY the NPCs in this format. No preamble, no summary, no narration, no commentary.");
    lines.push("");
    lines.push("REMINDER - the exact fields to use, in order, one per line, nothing else:");
    lines.push(buildNpcTemplateText());

    return lines.join("\n");
}

function parseNpcBlocks(rawText) {
    if (!rawText || typeof rawText !== "string") {
        return [];
    }

    const currentFields = getCurrentFields();

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
                ? currentFields.find(f => f.toLowerCase() === match[1].trim().toLowerCase())
                : null;

            if (matchedFieldName) {
                currentField = matchedFieldName;
                fields[currentField] = match[2].trim();
            } else if (currentField) {
                fields[currentField] += " " + line.trim();
            }
        }

        // Try to find a name field regardless of exact casing/label the user chose
        const nameField = currentFields.find(f => f.toLowerCase() === "name");
        const name = (nameField && fields[nameField]) || "Unnamed NPC";

        return {
            name,
            fields,
            rawContent: block,
        };
    });
}

// Saves parsed NPCs as real lorebook entries. Only creates a new lorebook if
// the name genuinely doesn't exist yet, to avoid createNewWorldInfo's
// overwrite-existing-data behavior touching something the user already has.
async function saveNpcsToLorebook(worldName, parsedNpcs) {
    const worldInfoModule = await import("../../../world-info.js");
    const { loadWorldInfo, saveWorldInfo, createWorldInfoEntry, createNewWorldInfo, world_names } = worldInfoModule;

    const exists = world_names.includes(worldName);

    if (!exists) {
        console.log(`[${extensionName}] Lorebook "${worldName}" doesn't exist yet, creating it...`);
        const created = await createNewWorldInfo(worldName, { interactive: false });
        if (!created) {
            throw new Error(`Failed to create lorebook "${worldName}"`);
        }
    }

    const data = await loadWorldInfo(worldName);
    if (!data) {
        throw new Error(`Failed to load lorebook "${worldName}"`);
    }
    if (!data.entries) {
        data.entries = {};
    }

    let savedCount = 0;
    for (const npc of parsedNpcs) {
        const entry = createWorldInfoEntry(worldName, data);
        if (!entry) {
            console.warn(`[${extensionName}] Failed to create entry for NPC:`, npc.name);
            continue;
        }
        entry.comment = npc.name;
        entry.key = [npc.name];
        entry.content = npc.rawContent;
        savedCount++;
    }

    await saveWorldInfo(worldName, data, true);
    console.log(`[${extensionName}] Saved ${savedCount} NPC(s) to lorebook "${worldName}"`, data);

    return savedCount;
}

async function onGenerateConfirm() {
    const count = Number($("#wpm_char_count").val());
    const instructions = String($("#wpm_generate_instructions").val());
    const lorebookName = String($("#wpm_lorebook_name").val()).trim();

    if (!lorebookName) {
        toastr.warning("Enter a lorebook name to save NPCs into.", "World Population Manager");
        return;
    }

    const generationContext = gatherGenerationContext(count, instructions);
    const prompt = buildGenerationPrompt(generationContext);

    console.log(`[${extensionName}] Full generation prompt being sent:`, prompt);
    closeGeneratePopup();
    toastr.info(`Generating ${count} NPC(s), this may take a moment.`, "World Population Manager");

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

        if (parsedNpcs.length === 0) {
            toastr.error("No NPCs could be parsed from the AI output - check console.", "World Population Manager");
            return;
        }

        const savedCount = await saveNpcsToLorebook(lorebookName, parsedNpcs);
        toastr.success(`Saved ${savedCount}/${count} NPC(s) to lorebook "${lorebookName}".`, "World Population Manager");
    } catch (error) {
        console.error(`[${extensionName}] Generation/save failed:`, error);
        toastr.error("Generation or save failed - check console.", "World Population Manager");
    }
}

async function onInspectContextClick() {
    const context = getContext();
    const allKeys = Object.keys(context);
    const worldRelatedKeys = allKeys.filter(k => /world|lore|book/i.test(k));

    console.log(`[${extensionName}] Full context object:`, context);
    console.log(`[${extensionName}] All context keys:`, allKeys);
    console.log(`[${extensionName}] World/lorebook-related keys found:`, worldRelatedKeys);

    toastr.info(`Found ${worldRelatedKeys.length} world/lorebook-related keys. Check console.`, "World Population Manager");
}

// getContext() didn't expose world-info functions directly, but we saw
// "world-info.js:4990 [WI] ..." log lines earlier, confirming that file exists.
// First attempt (4 levels up, same depth as script.js) 404'd, so world-info.js
// is not at server root - trying 3 levels up (inside a scripts/ subfolder) instead.
async function onInspectWorldInfoModuleClick() {
    try {
        const worldInfoModule = await import("../../../world-info.js");
        const exportNames = Object.keys(worldInfoModule);

        console.log(`[${extensionName}] world-info.js module:`, worldInfoModule);
        console.log(`[${extensionName}] world-info.js export names:`, exportNames);

        toastr.info(`world-info.js has ${exportNames.length} exports. Check console.`, "World Population Manager");
    } catch (error) {
        console.error(`[${extensionName}] Failed to import world-info.js:`, error);
        toastr.error("Failed to import world-info.js - check console for the exact error/path issue.", "World Population Manager");
    }
}

// Now that we know the export names, print the actual source of the ones we
// likely need so we can see their real parameters instead of guessing.
async function onInspectWorldInfoSignaturesClick() {
    try {
        const worldInfoModule = await import("../../../world-info.js");

        const functionsToInspect = [
            "createWorldInfoEntry",
            "saveWorldInfo",
            "loadWorldInfo",
            "createNewWorldInfo",
            "newWorldInfoEntryTemplate",
            "newWorldInfoEntryDefinition",
            "assignLorebookToChat",
            "getFreeWorldName",
            "world_names",
        ];

        for
