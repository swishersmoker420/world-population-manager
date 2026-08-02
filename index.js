// World Population Manager - Stage 3: Generation window UI shell (no real generation yet)
// Import from SillyTavern core
import { extension_settings, getContext, loadExtensionSettings } from "../../../extensions.js";
import { saveSettingsDebounced } from "../../../../script.js";

// Extension name MUST match folder name
const extensionName = "world-population-manager";
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;

const defaultSettings = {
    enabled: false,
};

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

function onGenerateConfirm() {
    const count = Number($("#wpm_char_count").val());
    const instructions = String($("#wpm_generate_instructions").val());

    console.log(`[${extensionName}] Generate requested:`, { count, instructions });
    toastr.info(`Would generate ${count} character(s). (No AI call wired up yet.)`, "World Population Manager");

    closeGeneratePopup();
}

jQuery(async
