(function(window){
  'use strict';

  const FTS = window.FTS = window.FTS || {};
  let db = null;
  let products = {};
  let seasonShopOptions = {};

  const $ = id => document.getElementById(id);
  const esc = v => FTS.esc ? FTS.esc(v == null ? '' : v) : String(v == null ? '' : v).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const euro = c => (Number(c || 0) / 100).toLocaleString('fr-FR', { style:'currency', currency:'EUR' });

  const EXCEPTIONAL_AMOUNTS = [50, 80, 100, 120, 150, 200];
  const DROPDOWN_CATEGORY_PREFIX = 'Liste déroulante — ';
  const EXCEPTIONAL_CATEGORY = DROPDOWN_CATEGORY_PREFIX + 'Règlement exceptionnel';
  function seasonOptionKey(productId) {
    return String(productId || '').replace(/[.#$\[\]\/]/g, '_');
  }

  function hasSeasonOption(productId) {
    const key = seasonOptionKey(productId);
    return !!key && Object.prototype.hasOwnProperty.call(seasonShopOptions, key);
  }

  function seasonOptionEnabled(product) {
    const id = product && product.id;
    const key = seasonOptionKey(id);
    if (key && Object.prototype.hasOwnProperty.call(seasonShopOptions, key)) return seasonShopOptions[key] === true;
    return String(product && product.category || '') !== EXCEPTIONAL_CATEGORY;
  }

  function cleanLegacySeasonMarkers(text) {
    return String(text || '')
      .split(/\n+/)
      .filter(line => {
        const value = line.trim();
        return value !== '__FTS_SAISON_ON__' && value !== '__FTS_SAISON_OFF__';
      })
      .join('\n')
      .trim();
  }

  async function saveSeasonOption(productId, enabled) {
    const key = seasonOptionKey(productId);
    if (!key) throw new Error('Identifiant article introuvable pour le réglage Saison.');
    await db.ref('fts_saison/config/shopOptions/' + key).set(!!enabled);
    db.ref('fts_saison/shopOptions/' + key).set(!!enabled).catch(err => console.warn('[FTS Boutique Saison compat]', err));
    seasonShopOptions[key] = !!enabled;
  }

  function exceptionalPayload(amount, index) {
    const cents = Math.round(Number(amount || 0) * 100);
    return {
      id: 'reglement-exceptionnel-' + amount,
      name: 'Règlement exceptionnel — ' + amount + ' €',
      description: 'À utiliser uniquement si l’administration Fais Ton Show vous a demandé de régler ce complément précis.',
      priceCents: cents,
      stock: 0,
      category: EXCEPTIONAL_CATEGORY,
      order: 900 + Number(index || 0),
      imageUrl: '',
      variantsText: 'Motif : Complément formule spéciale, Option adulte complémentaire, Régularisation inscription, Différence tarifaire, Autre cas validé',
      active: true
    };
  }

  async function createExceptionalProducts() {
    const btn = $('shop-seed-exceptional');
    if (!confirm('Créer / mettre à jour les règlements exceptionnels 50, 80, 100, 120, 150 et 200 € ?\n\nTu pourras ensuite les masquer, modifier ou supprimer un par un dans la boutique.')) return;
    const old = btn ? btn.textContent : '';
    try {
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Création…';
      }
      for (let i = 0; i < EXCEPTIONAL_AMOUNTS.length; i += 1) {
        const payload = exceptionalPayload(EXCEPTIONAL_AMOUNTS[i], i);
        const existingEnabled = hasSeasonOption(payload.id) ? seasonOptionEnabled({ id:payload.id, category:payload.category }) : false;
        await api('/admin/catalog/product', { method:'POST', body:JSON.stringify(payload) });
        await saveSeasonOption(payload.id, existingEnabled);
      }
      msg('Règlements exceptionnels créés / mis à jour');
      await load();
    } catch(err) {
      console.warn(err);
      msg('Erreur création règlements : ' + err.message, false);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = old || 'Créer règlements exceptionnels';
      }
    }
  }


  function slug(v) {
    return String(v || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  function dropdownCategoryName(name) {
    const clean = String(name || '').trim() || 'Règlement exceptionnel';
    return DROPDOWN_CATEGORY_PREFIX + clean;
  }

  function setDropdownCategory() {
    const listName = $('p-dropdown-list') ? $('p-dropdown-list').value.trim() : '';
    if (!listName) return msg('Indique le nom de la liste déroulante', false);
    $('p-category').value = dropdownCategoryName(listName);
    msg('Catégorie réglée pour la liste : ' + listName);
  }

  async function createDropdownProduct() {
    const btn = $('shop-create-dropdown-product');
    const listName = $('quick-dropdown-list') ? $('quick-dropdown-list').value.trim() : '';
    const label = $('quick-dropdown-label') ? $('quick-dropdown-label').value.trim() : '';
    const price = $('quick-dropdown-price') ? Number(String($('quick-dropdown-price').value || '0').replace(',', '.')) : 0;
    if (!listName) return msg('Indique le nom de la liste déroulante', false);
    if (!label) return msg('Indique le nom affiché dans la liste', false);
    if (!price || price < 0) return msg('Indique un tarif valide', false);

    const cents = Math.round(price * 100);
    const id = 'dropdown-' + slug(listName) + '-' + slug(label || price) + '-' + cents;
    const payload = {
      id,
      name: label,
      description: 'Paiement ponctuel ajouté depuis l’administration Fais Ton Show.',
      priceCents: cents,
      stock: 0,
      category: dropdownCategoryName(listName),
      order: 900 + Math.round(price),
      imageUrl: '',
      variantsText: 'Motif : Complément formule spéciale, Option adulte complémentaire, Régularisation inscription, Différence tarifaire, Autre cas validé',
      active: true
    };

    const old = btn ? btn.textContent : '';
    try {
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Ajout…';
      }
      await api('/admin/catalog/product', { method:'POST', body:JSON.stringify(payload) });
      await saveSeasonOption(id, false);
      msg('Produit ajouté à la liste déroulante : ' + listName);
      if ($('quick-dropdown-label')) $('quick-dropdown-label').value = '';
      if ($('quick-dropdown-price')) $('quick-dropdown-price').value = '';
      await load();
    } catch(err) {
      console.warn(err);
      msg('Erreur ajout liste : ' + err.message, false);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = old || 'Ajouter à la liste';
      }
    }
  }

  function worker() {
    return String((FTS.PAYMENT && FTS.PAYMENT.workerUrl) || 'https://fts-helloasso-api.gros-christophe.workers.dev').replace(/\/+$/, '');
  }

  async function token() {
    return firebase.auth().currentUser.getIdToken(true);
  }

  async function api(path, opts) {
    const res = await fetch(worker() + path, Object.assign({
      headers: {
        'Content-Type':'application/json',
        'Authorization':'Bearer ' + await token()
      }
    }, opts || {}));
    const data = await res.json().catch(() => null);
    if (!res.ok || !data || data.ok === false) throw new Error((data && data.error) || ('HTTP ' + res.status));
    return data;
  }

  function msg(t, ok = true) {
    const el = $('shop-msg');
    if (el) {
      el.textContent = t;
      el.className = 'shop-msg ' + (ok ? 'ok' : 'bad');
      setTimeout(() => { el.textContent = ''; }, 2600);
    }
  }

  function uploadStatus(text, ok = true) {
    const el = $('shop-upload-status');
    if (!el) return;
    el.textContent = text || '';
    el.className = 'shop-upload-status ' + (ok ? 'ok' : 'bad');
  }

  function updatePreview(url) {
    const box = $('shop-image-preview');
    if (!box) return;
    const clean = String(url || '').trim();
    if (!clean) {
      box.hidden = true;
      box.innerHTML = '';
      return;
    }
    box.hidden = false;
    box.innerHTML = `<img src="${esc(clean)}" alt="Aperçu image article"/><span>Aperçu de l’image boutique</span>`;
  }

  function reset() {
    ['p-id','p-name','p-description','p-price','p-stock','p-category','p-order','p-image','p-variants'].forEach(id => { $(id).value = ''; });
    const file = $('p-image-file');
    if (file) file.value = '';
    $('p-active').checked = true;
    if ($('p-season-option')) $('p-season-option').checked = true;
    uploadStatus('');
    updatePreview('');
  }

  function fill(p) {
    $('p-id').value = p.id || '';
    $('p-name').value = p.name || '';
    $('p-description').value = p.description || '';
    $('p-price').value = p.priceCents ? String(Number(p.priceCents) / 100) : '';
    $('p-stock').value = p.stock || '';
    $('p-category').value = p.category || '';
    $('p-order').value = p.order || '';
    $('p-image').value = p.imageUrl || '';
    $('p-variants').value = cleanLegacySeasonMarkers(p.variantsText || '');
    $('p-active').checked = p.active !== false;
    if ($('p-season-option')) $('p-season-option').checked = seasonOptionEnabled(p);
    const file = $('p-image-file');
    if (file) file.value = '';
    uploadStatus('');
    updatePreview(p.imageUrl || '');
  }

  function render() {
    const box = $('shop-products');
    const rows = Object.entries(products)
      .map(([id, p]) => Object.assign({ id }, p || {}))
      .sort((a, b) => Number(a.order || 999) - Number(b.order || 999) || String(a.name || '').localeCompare(String(b.name || ''), 'fr'));

    if (!rows.length) {
      box.innerHTML = '<div class="shop-empty">Aucun article pour le moment.</div>';
      return;
    }

    box.innerHTML = rows.map(p => `
      <article class="shop-product ${p.active === false ? 'off' : ''}" data-product="${esc(p.id)}">
        <div>${p.imageUrl ? `<img src="${esc(p.imageUrl)}" alt=""/>` : '<div class="shop-product-icon">🛍️</div>'}</div>
        <div>
          <strong>${esc(p.name || 'Article')}</strong>
          <span>${esc(p.category || 'Boutique')} · ${euro(p.priceCents)}</span>
          <small>${p.stock ? esc(p.stock) + ' en stock' : 'Stock non limité'}${p.active === false ? ' · masqué' : ''}${seasonOptionEnabled(p) ? ' · Saison' : ' · hors Saison'}</small>
        </div>
      </article>`).join('');

    box.querySelectorAll('[data-product]').forEach(el => {
      el.addEventListener('click', () => fill(products[el.getAttribute('data-product')] || {}));
    });
  }

  async function load() {
    const [data, configOptionSnap, legacyOptionSnap] = await Promise.all([
      api('/admin/catalog', { method:'GET' }),
      db.ref('fts_saison/config/shopOptions').once('value').catch(err => { console.warn('[FTS Boutique Saison options config]', err); return null; }),
      db.ref('fts_saison/shopOptions').once('value').catch(err => { console.warn('[FTS Boutique Saison options compat]', err); return null; })
    ]);
    const configOptions = configOptionSnap && configOptionSnap.val ? (configOptionSnap.val() || {}) : {};
    const legacyOptions = legacyOptionSnap && legacyOptionSnap.val ? (legacyOptionSnap.val() || {}) : {};
    seasonShopOptions = Object.assign({}, legacyOptions, configOptions);
    if (Object.keys(seasonShopOptions).length) {
      db.ref('fts_saison/config/shopOptions').update(seasonShopOptions).catch(err => console.warn('[FTS Boutique Saison migration]', err));
    }
    products = Object.fromEntries(Object.entries(data.products || {}).filter(([, p]) => !String(p && p.category || '').startsWith('__PIECES__:')));
    render();
  }

  async function uploadImage() {
    const input = $('p-image-file');
    const file = input && input.files && input.files[0];

    if (!file) {
      uploadStatus('Choisis d’abord une image depuis ton appareil.', false);
      return;
    }

    if (!/^image\//.test(file.type || '')) {
      uploadStatus('Le fichier choisi n’est pas une image.', false);
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      uploadStatus('Image trop lourde. Essaie une image de moins de 8 Mo.', false);
      return;
    }

    if (!FTS.uploadCloudinary) {
      uploadStatus('Upload Cloudinary indisponible : fts-utils.js n’est pas chargé.', false);
      return;
    }

    try {
      uploadStatus('Upload 0%…');
      const url = await FTS.uploadCloudinary(file, pct => uploadStatus('Upload ' + pct + '%…'));
      $('p-image').value = url;
      updatePreview(url);
      uploadStatus('Image envoyée. Le lien est prêt à être enregistré.');
      msg('Image ajoutée à l’article');
    } catch (err) {
      console.warn(err);
      uploadStatus('Erreur upload : ' + err.message, false);
    }
  }

  async function save(e) {
    e.preventDefault();
    const payload = {
      id: $('p-id').value.trim(),
      name: $('p-name').value.trim(),
      description: $('p-description').value.trim(),
      priceCents: Math.round(Number(String($('p-price').value || '0').replace(',', '.')) * 100),
      stock: Number($('p-stock').value || 0) || 0,
      category: $('p-category').value.trim(),
      order: Number($('p-order').value || 999) || 999,
      imageUrl: $('p-image').value.trim(),
      variantsText: cleanLegacySeasonMarkers($('p-variants').value.trim()),
      active: $('p-active').checked
    };
    const seasonEnabled = $('p-season-option') ? $('p-season-option').checked : true;

    try {
      const saved = await api('/admin/catalog/product', { method:'POST', body:JSON.stringify(payload) });
      let savedId = payload.id || (saved && (saved.productId || saved.id || saved.key)) || (saved && saved.product && saved.product.id) || '';
      if (!savedId) {
        const refreshed = await api('/admin/catalog', { method:'GET' });
        const matches = Object.entries(refreshed.products || {}).filter(([, p]) =>
          String(p && p.name || '') === payload.name &&
          String(p && p.category || '') === payload.category &&
          Number(p && p.priceCents || 0) === payload.priceCents
        );
        if (matches.length === 1) savedId = matches[0][0];
      }
      if (savedId) await saveSeasonOption(savedId, seasonEnabled);
      else throw new Error('Article enregistré, mais impossible d’enregistrer son affichage Saison. Rouvre l’article et réessaie.');
      msg('Article enregistré');
      reset();
      await load();
    } catch(err) {
      console.warn(err);
      msg('Erreur : ' + err.message, false);
    }
  }

  async function remove() {
    const id = $('p-id').value.trim();
    if (!id) return msg('Sélectionne un article', false);
    if (!confirm('Masquer cet article ?')) return;

    try {
      await api('/admin/catalog/product/delete', { method:'POST', body:JSON.stringify({ id }) });
      msg('Article masqué');
      reset();
      await load();
    } catch(err) {
      msg('Erreur : ' + err.message, false);
    }
  }

  function boot() {
    db = FTS.initFirebase();
    firebase.auth().onAuthStateChanged(async user => {
      if (!user) {
        location.href = 'auth.html';
        return;
      }

      const snap = await db.ref('fts_users/' + user.uid).once('value');
      const profile = snap.val() || {};

      if (String(profile.status || '').toLowerCase() !== 'active') {
        await firebase.auth().signOut();
        location.href = 'auth.html';
        return;
      }

      if (String(profile.role || '').toLowerCase() !== 'admin') {
        location.href = 'membres.html';
        return;
      }

      $('shop-admin-loading').style.display = 'none';
      $('shop-admin-shell').hidden = false;
      $('shop-form').addEventListener('submit', save);
      $('shop-new').addEventListener('click', reset);
      const exceptionalBtn = $('shop-seed-exceptional');
      if (exceptionalBtn) exceptionalBtn.addEventListener('click', createExceptionalProducts);
      const createDropdownBtn = $('shop-create-dropdown-product');
      if (createDropdownBtn) createDropdownBtn.addEventListener('click', createDropdownProduct);
      const applyDropdownBtn = $('shop-apply-dropdown-category');
      if (applyDropdownBtn) applyDropdownBtn.addEventListener('click', setDropdownCategory);
      $('shop-reset').addEventListener('click', reset);
      $('shop-delete').addEventListener('click', remove);
      $('shop-upload-image').addEventListener('click', uploadImage);
      $('p-image').addEventListener('input', e => updatePreview(e.target.value));
      $('p-image-file').addEventListener('change', () => uploadStatus('Image prête. Clique sur “Envoyer l’image”.'));

      await load().catch(e => {
        $('shop-admin-error').textContent = 'Impossible de charger le catalogue : ' + e.message;
      });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window);
