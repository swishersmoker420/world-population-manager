// World Population Manager - Stage 8: Configurable character template fields
import { extension_settings, getContext, loadExtensionSettings } from "../../../extensions.js";
import { saveSettingsDebounced, eventSource, event_types, extension_prompt_types, extension_prompt_roles } from "../../../../script.js";

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

// Builds the trigger keywords for an NPC: first name and full name, deduped.
function buildKeywordsForName(fullName) {
    const trimmed = String(fullName || "").trim();
    if (!trimmed) {
        return ["Unnamed NPC"];
    }

    const firstName = trimmed.split(/\s+/)[0];
    const keywords = [trimmed];

    if (firstName && firstName.toLowerCase() !== trimmed.toLowerCase()) {
        keywords.unshift(firstName);
    }

    return keywords;
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
        entry.key = buildKeywordsForName(npc.name);
        entry.content = npc.rawContent;
        savedCount++;
    }

    await saveWorldInfo(worldName, data, true);
    console.log(`[${extensionName}] Saved ${savedCount} NPC(s) to lorebook "${worldName}"`, data);

    return savedCount;
}

// Binds a lorebook to the current chat (chat_metadata[METADATA_KEY] = worldName),
// the same mechanism SillyTavern's own "chat lorebook" feature uses. Called
// automatically on every generation, unconditionally - the extension always
// keeps the chat pointed at whichever lorebook it most recently saved NPCs
// into, overwriting any previous binding (including stale ones from before
// this behavior existed).
async function bindLorebookToChat(worldName) {
    const worldInfoModule = await import("../../../world-info.js");
    const { METADATA_KEY } = worldInfoModule;

    const context = getContext();
    if (!context.chatMetadata) {
        console.warn(`[${extensionName}] context.chatMetadata not available - can't bind lorebook to chat.`);
        return false;
    }

    const previousBinding = context.chatMetadata[METADATA_KEY];
    if (previousBinding && previousBinding !== worldName) {
        console.log(`[${extensionName}] Replacing previously bound lorebook "${previousBinding}" with "${worldName}" for this chat.`);
    }

    context.chatMetadata[METADATA_KEY] = worldName;

    if (typeof context.saveMetadataDebounced === "function") {
        context.saveMetadataDebounced();
    } else if (typeof context.saveMetadata === "function") {
        await context.saveMetadata();
    } else {
        console.warn(`[${extensionName}] No saveMetadata function found on context - binding may not persist.`);
    }

    console.log(`[${extensionName}] Bound lorebook "${worldName}" to current chat (METADATA_KEY: ${METADATA_KEY}).`);
    return true;
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
        await bindLorebookToChat(lorebookName);

        toastr.success(`Saved ${savedCount}/${count} NPC(s) to lorebook "${lorebookName}" and bound it to this chat.`, "World Population Manager");
    } catch (error) {
        console.error(`[${extensionName}] Generation/save failed:`, error);
        toastr.error("Generation or save failed - check console.", "World Population Manager");
    }
}

// --- Scene Pipeline: Stage 1 - Scene Analysis ---
function buildSceneAnalysisPrompt(generationContext) {
    const { characterCard, chatHistory } = generationContext;
    const lines = [];

    lines.push("[SYSTEM OVERRIDE - DO NOT CONTINUE THE ROLEPLAY SCENE]");
    lines.push("You are not a character in this story right now. You are a scene-analysis tool.");
    lines.push("Do not narrate, do not roleplay, do not write dialogue as any character.");
    lines.push("");

    if (characterCard) {
        lines.push("--- WORLD / CHARACTER CARD CONTEXT ---");
        if (characterCard.name) lines.push(`Main character: ${characterCard.name}`);
        if (characterCard.description) lines.push(`Description: ${characterCard.description}`);
        if (characterCard.scenario) lines.push(`Scenario: ${characterCard.scenario}`);
        lines.push("");
    }

    if (chatHistory && chatHistory.length > 0) {
        lines.push("--- RECENT CHAT ---");
        for (const m of chatHistory) {
            lines.push(`${m.name}: ${m.mes}`);
        }
        lines.push("");
    }

    lines.push("--- YOUR TASK ---");
    lines.push("Based on the current location, conversation, and activity, decide whether it would be natural for a new background character to appear or be mentioned RIGHT NOW.");
    lines.push("Be conservative - most moments should NOT introduce anyone new. Only recommend it when the scene genuinely calls for it (e.g. entering a new populated location, a name is mentioned, someone is clearly expected).");
    lines.push("");
    lines.push('If nobody new should appear, output EXACTLY: NONE');
    lines.push("If someone should appear, output a single short sentence describing what kind of person and why (not a name, just a description and reason).");
    lines.push("Output ONLY that - no preamble, no explanation, no formatting.");

    return lines.join("\n");
}

const ACTIVE_NPC_PROMPT_KEY = "wpm_active_npcs";

// --- Scene Pipeline: Stage 3 - Lorebook Injection ---
function updateActiveNpcInjection(namesText, npcs) {
    const context = getContext();

    if (typeof context.setExtensionPrompt !== "function") {
        console.warn(`[${extensionName}] setExtensionPrompt not available - cannot inject NPC into scene.`);
        return [];
    }

    const requestedNames = String(namesText)
        .split("\n")
        .map(n => n.trim())
        .filter(n => n.length > 0);

    const matchedNpcs = npcs.filter(npc =>
        requestedNames.some(reqName => reqName.toLowerCase() === npc.name.toLowerCase())
    );

    if (matchedNpcs.length === 0) {
        context.setExtensionPrompt(ACTIVE_NPC_PROMPT_KEY, "", extension_prompt_types.IN_CHAT, 0, false, extension_prompt_roles.SYSTEM);
        console.log(`[${extensionName}] Cleared active NPC injection (nobody matched).`);
        return [];
    }

    const injectedText = matchedNpcs
        .map(npc => `[${npc.name} is present in the scene]\n${npc.content}`)
        .join("\n\n");

    context.setExtensionPrompt(
        ACTIVE_NPC_PROMPT_KEY,
        injectedText,
        extension_prompt_types.IN_CHAT,
        0,
        false,
        extension_prompt_roles.SYSTEM
    );

    console.log(`[${extensionName}] Injected NPC(s) into scene:`, matchedNpcs.map(n => n.name));
    return matchedNpcs;
}

let isScenePipelineRunning = false;

async function runScenePipeline(showToasts) {
    if (isScenePipelineRunning) {
        console.log(`[${extensionName}] Scene pipeline already running, skipping this trigger.`);
        return;
    }
    isScenePipelineRunning = true;

    try {
        const generationContext = gatherGenerationContext(0, "");
        const prompt = buildSceneAnalysisPrompt(generationContext);

        console.log(`[${extensionName}] Scene analysis prompt:`, prompt);
        if (showToasts) toastr.info("Analyzing scene, check console...", "World Population Manager");

        const context = getContext();

        const analysisResult = await context.generateQuietPrompt({
            quietPrompt: prompt,
            skipWIAN: true,
            quietToLoud: false,
        });
        console.log(`[${extensionName}] Scene analysis result:`, analysisResult);

        const trimmedAnalysis = String(analysisResult).trim();

        if (trimmedAnalysis.toUpperCase().startsWith("NONE")) {
            if (showToasts) toastr.info("Scene analysis: no new NPCs recommended.", "World Population Manager");
            return;
        }

        if (showToasts) toastr.info(`Scene analysis recommends: ${trimmedAnalysis}. Checking existing NPCs...`, "World Population Manager");

        // --- Stage 2: NPC Director ---
        const { worldName, npcs } = await getAllNpcsFromBoundLorebook();

        if (!worldName) {
            console.warn(`[${extensionName}] No bound lorebook found (chat_metadata[METADATA_KEY] is empty).`);
            if (showToasts) toastr.warning("No lorebook is bound to this chat, so there's no NPC list to pick from.", "World Population Manager");
            return;
        }

        if (npcs.length === 0) {
            if (showToasts) toastr.warning(`Bound lorebook "${worldName}" has no NPC entries yet.`, "World Population Manager");
            return;
        }

        const directorPrompt = buildNpcDirectorPrompt(trimmedAnalysis, npcs);
        console.log(`[${extensionName}] NPC Director prompt:`, directorPrompt);

        const directorResult = await context.generateQuietPrompt({
            quietPrompt: directorPrompt,
            skipWIAN: true,
            quietToLoud: false,
        });
        console.log(`[${extensionName}] NPC Director result:`, directorResult);

        const trimmedDirector = String(directorResult).trim();

        if (trimmedDirector.toUpperCase().startsWith("NONE")) {
            updateActiveNpcInjection("", npcs);
            if (showToasts) toastr.info(`Scene called for someone, but no existing NPC in "${worldName}" fits. Would need Generate Characters instead.`, "World Population Manager");
        } else {
            const matchedNpcs = updateActiveNpcInjection(trimmedDirector, npcs);
            if (matchedNpcs.length === 0) {
                if (showToasts) toastr.warning(`Director said "${trimmedDirector}" but that didn't match any real NPC name - nothing injected.`, "World Population Manager");
            } else {
                toastr.success(`${matchedNpcs.map(n => n.name).join(", ")} will join the scene.`, "World Population Manager");
            }
        }
    } catch (error) {
        console.error(`[${extensionName}] Scene pipeline failed:`, error);
        if (showToasts) toastr.error("Scene pipeline failed - check console.", "World Population Manager");
    } finally {
        isScenePipelineRunning = false;
    }
}

async function onAnalyzeSceneClick() {
    await runScenePipeline(true);
}

async function getBoundLorebookName() {
    const worldInfoModule = await import("../../../world-info.js");
    const { METADATA_KEY } = worldInfoModule;
    const context = getContext();
    return context.chatMetadata ? context.chatMetadata[METADATA_KEY] : null;
}

async function getAllNpcsFromBoundLorebook() {
    const worldName = await getBoundLorebookName();
    if (!worldName) {
        return { worldName: null, npcs: [] };
    }

    const worldInfoModule = await import("../../../world-info.js");
    const { loadWorldInfo } = worldInfoModule;
    const data = await loadWorldInfo(worldName);

    if (!data || !data.entries) {
        return { worldName, npcs: [] };
    }

    const npcs = Object.values(data.entries)
        .filter(entry => entry.comment)
        .map(entry => ({
            name: entry.comment,
            content: entry.content || "",
        }));

    return { worldName, npcs };
}

function buildNpcDirectorPrompt(sceneRecommendation, npcs) {
    const lines = [];

    lines.push("[SYSTEM OVERRIDE - DO NOT CONTINUE THE ROLEPLAY SCENE]");
    lines.push("You are not a character in this story right now. You are a casting director tool.");
    lines.push("Do not narrate, do not roleplay, do not invent new characters.");
    lines.push("");
    lines.push("--- SCENE RECOMMENDATION ---");
    lines.push(sceneRecommendation);
    lines.push("");
    lines.push("--- EXISTING NPCs AVAILABLE (you may ONLY choose from this list) ---");
    npcs.forEach((npc, i) => {
        const excerpt = npc.content.slice(0, 300).replace(/\n/g, " ");
        lines.push(`${i + 1}. ${npc.name}: ${excerpt}${npc.content.length > 300 ? "..." : ""}`);
    });
    lines.push("");
    lines.push("--- YOUR TASK ---");
    lines.push("Decide whether any of the EXISTING NPCs listed above naturally fit the scene recommendation.");
    lines.push("Do NOT invent a new character, even if none of the existing ones fit perfectly.");
    lines.push("If one or more existing NPCs fit, output their exact name(s) from the list above, one per line, and nothing else.");
    lines.push("If none of them genuinely fit, output EXACTLY: NONE");
    lines.push("Output ONLY names or NONE - no explanation, no formatting.");

    return lines.join("\n");
}

async function onInspectReloadEditorClick() {
    try {
        const wi = await import("../../../world-info.js");
        console.log(`[${extensionName}] reloadEditor source:`, wi.reloadEditor ? wi.reloadEditor.toString() : "not found");
        console.log(`[${extensionName}] updateWorldInfoList source:`, wi.updateWorldInfoList ? wi.updateWorldInfoList.toString() : "not found");
        toastr.info("Printed reloadEditor/updateWorldInfoList source to console.", "World Population Manager");
    } catch (error) {
        console.error(`[${extensionName}] Failed to inspect:`, error);
    }
}

function onInspectEventTypesClick() {
    console.log(`[${extensionName}] Full event_types object:`, event_types);
    console.log(`[${extensionName}] event_types keys:`, Object.keys(event_types || {}));
    toastr.info("Printed event_types to console.", "World Population Manager");
}

// Automatically run the scene pipeline whenever the user sends a message,
// so it's already injected before the AI's response generates - same
// end result as manually clicking "Analyze Scene" beforehand.
if (event_types && event_types.MESSAGE_SENT) {
    eventSource.on(event_types.MESSAGE_SENT, () => {
        runScenePipeline(false);
    });
} else {
    console.warn(`[${extensionName}] event_types.MESSAGE_SENT not found - automatic scene analysis won't trigger. Use the "Analyze Scene" button manually instead.`);
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
        $("#wpm_analyze_scene").on("click", onAnalyzeSceneClick);
        $("#wpm_inspect_reload").on("click", onInspectReloadEditorClick);
        $("#wpm_inspect_events").on("click", onInspectEventTypesClick);

        $("#wpm_fields_list").on("change", ".wpm-field-name-input", onFieldNameChange);
        $("#wpm_fields_list").on("click", ".wpm-remove-field-btn", onRemoveFieldClick);
        $("#wpm_add_field_btn").on("click", onAddFieldClick);
        $("#wpm_reset_fields_btn").on("click", onResetFieldsClick);

        loadSettings();

        console.log(`[${extensionName}] ✅ Loaded successfully`);
    } catch (error) {
        console.error(`[${extensionName}] ❌ Failed to load:`, error);
    }
});
