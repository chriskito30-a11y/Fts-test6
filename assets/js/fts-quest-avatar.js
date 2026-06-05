'use strict';

(function(){
  const D = window.FTSQuestData;
  const UI = window.FTSQuestUI;
  let avatar = UI.loadAvatar();

  function refresh(){
    const preview = UI.$('#avatarPreviewCard');
    if (preview) UI.renderPlayerCard(preview, avatar);
    const previewSmall = UI.$('#avatarPreviewCardSmall');
    if (previewSmall) UI.renderPlayerCard(previewSmall, avatar, true);
    const raw = UI.$('#avatarJson');
    if (raw) raw.textContent = JSON.stringify(avatar, null, 2);
    syncActiveStates();
  }

  function syncActiveStates(){
    UI.$$('.choice-card[data-kind]').forEach(btn => {
      const kind = btn.dataset.kind;
      const id = btn.dataset.id;
      const value = getValue(kind);
      btn.classList.toggle('active', id === value);
    });
    UI.$$('.color-dot[data-kind]').forEach(btn => {
      const kind = btn.dataset.kind;
      const value = getValue(kind);
      btn.classList.toggle('active', btn.dataset.value === value || btn.dataset.id === value);
    });
  }

  function getValue(kind){
    if (kind === 'palette') return avatar.palette;
    if (kind === 'skin') return avatar.skin;
    if (kind === 'hair') return avatar.hair;
    if (kind === 'eyes') return avatar.eyes;
    if (kind === 'eyeStyle') return avatar.eyeStyle;
    if (kind === 'accessory') return avatar.accessory;
    if (kind === 'frame') return avatar.frame;
    if (kind === 'base') return avatar.base;
    return avatar[kind];
  }

  function setValue(kind, id, value){
    if (kind === 'palette') avatar = UI.applyPalette(avatar, id);
    else if (kind === 'skin') avatar.skin = value;
    else if (kind === 'hair') avatar.hair = value;
    else if (kind === 'eyes') avatar.eyes = value;
    else avatar[kind] = id;
    refresh();
  }

  function renderBaseChoices(){
    const target = UI.$('#baseChoices');
    if (!target) return;
    target.innerHTML = D.bases.map(base => `
      <button class="choice-card avatar-choice" type="button" data-kind="base" data-id="${UI.escape(base.id)}">
        <span class="choice-glow"></span>
        <span class="avatar-choice-preview">${UI.renderAvatar({ ...avatar, base: base.id }, { size:'tiny' })}</span>
        <strong>${UI.escape(base.label)}</strong>
        <em>${UI.escape(base.family)} · ${UI.escape(base.rarity)}</em>
        <small>${UI.escape(base.description)}</small>
      </button>`).join('');
  }

  function renderPaletteChoices(){
    const palette = UI.$('#paletteChoices');
    if (palette) palette.innerHTML = D.palettes.map(item => `
      <button class="choice-card palette-card" type="button" data-kind="palette" data-id="${UI.escape(item.id)}">
        <span class="palette-preview" style="--p1:${item.primary};--p2:${item.secondary};--p3:${item.bg}"></span>
        <strong>${UI.escape(item.label)}</strong>
        <em>Palette</em>
      </button>`).join('');

    const skin = UI.$('#skinChoices');
    if (skin) skin.innerHTML = D.skins.map(item => `<button class="color-dot" type="button" title="${UI.escape(item.label)}" data-kind="skin" data-id="${UI.escape(item.id)}" data-value="${item.value}" style="--dot:${item.value}"><span>${UI.escape(item.label)}</span></button>`).join('');

    const hair = UI.$('#hairChoices');
    if (hair) hair.innerHTML = D.hairColors.map(item => `<button class="color-dot" type="button" title="${UI.escape(item.label)}" data-kind="hair" data-id="${UI.escape(item.id)}" data-value="${item.value}" style="--dot:${item.value}"><span>${UI.escape(item.label)}</span></button>`).join('');
  }

  function renderEyeChoices(){
    const styles = UI.$('#eyeStyleChoices');
    if (styles) styles.innerHTML = D.eyeStyles.map(item => UI.selectableCard(item, item.id === avatar.eyeStyle).replace('data-id=', 'data-kind="eyeStyle" data-id=')).join('');

    const colors = UI.$('#eyeColorChoices');
    if (colors) colors.innerHTML = D.eyeColors.map(item => `<button class="color-dot eye" type="button" title="${UI.escape(item.label)}" data-kind="eyes" data-id="${UI.escape(item.id)}" data-value="${item.value}" style="--dot:${item.value}"><span>${UI.escape(item.label)}</span></button>`).join('');
  }

  function renderAccessoryChoices(){
    const target = UI.$('#accessoryChoices');
    if (!target) return;
    target.innerHTML = D.accessories.map(item => `
      <button class="choice-card" type="button" data-kind="accessory" data-id="${UI.escape(item.id)}">
        <span class="choice-glow"></span>
        <strong>${UI.escape(item.label)}</strong>
        <em>${UI.escape(item.family)} · ${UI.escape(item.rarity)}</em>
      </button>`).join('');
  }

  function renderFrameChoices(){
    const target = UI.$('#frameChoices');
    if (!target) return;
    target.innerHTML = D.frames.map(item => `
      <button class="choice-card frame-choice frame-${UI.escape(item.id)}" type="button" data-kind="frame" data-id="${UI.escape(item.id)}">
        <span class="choice-glow"></span>
        <strong>${UI.escape(item.label)}</strong>
        <em>${UI.escape(item.rarity)}</em>
      </button>`).join('');
  }

  function initBuilderTabs(){
    UI.$$('.builder-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        UI.$$('.builder-tab').forEach(item => item.classList.remove('active'));
        UI.$$('.builder-panel').forEach(item => item.classList.remove('active'));
        btn.classList.add('active');
        const panel = UI.$(`#builder-${btn.dataset.builderTab}`);
        if (panel) panel.classList.add('active');
      });
    });
  }

  function initChoices(){
    document.addEventListener('click', event => {
      const choice = event.target.closest('[data-kind]');
      if (!choice) return;
      setValue(choice.dataset.kind, choice.dataset.id, choice.dataset.value || choice.dataset.id);
    });
  }

  function initActions(){
    const save = UI.$('#saveAvatar');
    if (save) save.addEventListener('click', () => {
      UI.saveAvatar(avatar);
      const feedback = UI.$('#saveFeedback');
      if (feedback) {
        feedback.textContent = 'Avatar sauvegardé dans le navigateur. Il s’affichera dans le hub.';
        feedback.classList.add('success');
      }
      refresh();
    });

    const reset = UI.$('#resetAvatar');
    if (reset) reset.addEventListener('click', () => {
      avatar = { ...D.avatarDefault };
      refresh();
      UI.log('Avatar réinitialisé sur le modèle par défaut.');
    });

    const random = UI.$('#randomAvatar');
    if (random) random.addEventListener('click', () => {
      const pick = list => list[Math.floor(Math.random() * list.length)];
      const palette = pick(D.palettes);
      avatar = {
        ...avatar,
        base: pick(D.bases).id,
        palette: palette.id,
        primary: palette.primary,
        secondary: palette.secondary,
        skin: pick(D.skins).value,
        hair: pick(D.hairColors).value,
        eyes: pick(D.eyeColors).value,
        eyeStyle: pick(D.eyeStyles).id,
        accessory: pick(D.accessories).id,
        frame: pick(D.frames).id
      };
      refresh();
      UI.log('Avatar aléatoire généré.');
    });
  }

  function init(){
    renderBaseChoices();
    renderPaletteChoices();
    renderEyeChoices();
    renderAccessoryChoices();
    renderFrameChoices();
    initBuilderTabs();
    initChoices();
    initActions();
    UI.renderLog();
    UI.initReveal();
    refresh();
  }

  document.addEventListener('DOMContentLoaded', function(){
    try { init(); } catch(err) {
      console.error('FTS Quest Avatar init error:', err);
      if (window.FTSQuestUI && window.FTSQuestUI.log) window.FTSQuestUI.log('Erreur init Avatar : ' + err.message);
    }
  });
})();
