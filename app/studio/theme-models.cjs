'use strict';
// Full IDs verified against the live T3 model catalog on 2026-10-24.
const FAMILY_DEFAULT = Object.freeze({ opus: 'claude-opus-5-5', sonnet: 'claude-sonnet-5-5', haiku: 'claude-haiku-5-5' });
const CODEX_MODELS = Object.freeze(['gpt-6-astra', 'gpt-6.1-sol', 'gpt-6-luna']);
const ENGINE_IDS = Object.freeze(['offline', 'claude-sonnet', 'claude-opus', 'claude-haiku', 'claude-cli', 'codex-cli']);
const claudeModels = () => Object.entries(FAMILY_DEFAULT).map(([family, id]) => ({ id, label: family[0].toUpperCase() + family.slice(1) + ' 5.5' }));
function generatorChoices(hasApiKey) {
  return [
    { id: 'offline', label: 'Local templates · no AI', models: [] },
    { id: 'claude-cli', label: 'Claude Code CLI · account usage', defaultModel: FAMILY_DEFAULT.sonnet, models: claudeModels() },
    { id: 'codex-cli', label: 'Codex CLI · account usage', defaultModel: 'gpt-6.1-sol', models: CODEX_MODELS.map(id => ({ id, label: id })) },
    ...claudeModels().map(model => ({ id: 'claude-' + model.id.split('-')[1], label: 'Claude API · ' + model.label + (hasApiKey ? '' : ' · add API key first'), defaultModel: model.id, models: [model] })),
  ];
}
function selectedModel(engine, model) {
  const choice = generatorChoices(true).find(c => c.id === engine);
  if (!choice) throw Error('Unknown theme generator');
  if (engine === 'offline') return '';
  const id = model || choice.defaultModel;
  if (!choice.models.some(m => m.id === id)) throw Error('Choose a model offered by the selected generator');
  return id;
}
module.exports = { FAMILY_DEFAULT, CODEX_MODELS, ENGINE_IDS, generatorChoices, selectedModel };
